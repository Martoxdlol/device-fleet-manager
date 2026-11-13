use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Redirect, Response};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use fleet_lib::model::Signup;
use fleet_lib::oidc::OidcKind;
use fleet_lib::repo::accounts::{OidcLogin, OidcOutcome};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::OffsetDateTime;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::auth::Session;
use super::common::{
    ApiError, ApiResult, Json, Path, Query, Validator, bad_request, error, not_found, repo_error,
    unauthenticated,
};
use super::scope::{bearer_token, user_agent};
use crate::AppState;
use crate::messages::Message as M;

const COOKIE: &str = "fleet_oidc";
const COOKIE_PATH: &str = "/api/v1/auth/oidc";
const LOGIN_LABEL: &[u8] = b"fleet.oidc-login";
const CLAIM_LABEL: &[u8] = b"fleet.session-claim";
const LOGIN_TTL: i64 = 10 * 60;
const CLAIM_TTL: i64 = 2 * 60;
const MAX_RETURN_TO: usize = 2048;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(start_oidc))
        .routes(routes!(oidc_callback))
        .routes(routes!(exchange_code))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct StartOidc {
    pub code_challenge: String,
    pub return_to: Option<String>,
    pub invitation: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StartedOidc {
    pub url: String,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct CallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ExchangeRequest {
    pub code: String,
    pub code_verifier: String,
}

#[derive(Serialize, Deserialize)]
struct LoginState {
    provider: OidcKind,
    state: String,
    nonce: String,
    pkce_verifier: String,
    spa_challenge: String,
    return_to: Option<String>,
    invitation: Option<String>,
    link_user: Option<Uuid>,
    expires: i64,
}

#[derive(Serialize, Deserialize)]
struct Claim {
    user_id: Uuid,
    spa_challenge: String,
    expires: i64,
}

#[utoipa::path(
    post, path = "/auth/oidc/{provider}/start", tag = "auth",
    params(("provider" = inline(OidcKind), Path)),
    request_body = StartOidc,
    responses(
        (status = OK, body = StartedOidc),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn start_oidc(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(provider): Path<String>,
    Json(body): Json<StartOidc>,
) -> ApiResult<Response> {
    let kind = configured(&state, &provider)?;
    let mut v = Validator::new();
    if !is_challenge(&body.code_challenge) {
        v.push("code_challenge", "format", M::CodeChallengeFormat);
    }
    if body
        .return_to
        .as_deref()
        .is_some_and(|path| !is_local_path(path))
    {
        v.push("return_to", "format", M::ReturnToFormat);
    }
    v.finish()?;
    let link_user = match bearer_token(&headers) {
        Some(token) => Some(
            state
                .ctx
                .access
                .principal(&fleet_lib::auth::hash(token))
                .await
                .map_err(repo_error)?
                .ok_or_else(unauthenticated)?
                .user_id,
        ),
        None => None,
    };
    let authorization = state
        .ctx
        .oidc
        .authorize(kind, &redirect_url(&state, kind))
        .await
        .map_err(|failure| {
            tracing::error!(provider = kind.as_str(), %failure, "OIDC authorization failed");
            error(
                StatusCode::BAD_GATEWAY,
                "provider_unavailable",
                M::ProviderUnavailable,
            )
        })?;
    let login = LoginState {
        provider: kind,
        state: authorization.state,
        nonce: authorization.nonce,
        pkce_verifier: authorization.pkce_verifier,
        spa_challenge: body.code_challenge,
        return_to: body.return_to,
        invitation: body.invitation,
        link_user,
        expires: now() + LOGIN_TTL,
    };
    let sealed = seal(&state, LOGIN_LABEL, &login);
    let cookie = format!(
        "{COOKIE}={sealed}; Path={COOKIE_PATH}; Max-Age={LOGIN_TTL}; HttpOnly; SameSite=Lax{}",
        if state.app_url.starts_with("https://") {
            "; Secure"
        } else {
            ""
        }
    );
    let mut response = Json(StartedOidc {
        url: authorization.url,
    })
    .into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).expect("the cookie is ASCII"),
    );
    Ok(response)
}

#[utoipa::path(
    get, path = "/auth/oidc/{provider}/callback", tag = "auth",
    params(("provider" = inline(OidcKind), Path), CallbackQuery),
    responses((status = SEE_OTHER, description = "Back to the console"))
)]
async fn oidc_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Response {
    let complete = |params: &str| {
        let mut response =
            Redirect::to(&format!("{}/auth/complete?{params}", state.app_url)).into_response();
        response.headers_mut().insert(
            header::SET_COOKIE,
            HeaderValue::from_static(
                "fleet_oidc=; Path=/api/v1/auth/oidc; Max-Age=0; HttpOnly; SameSite=Lax",
            ),
        );
        response
    };
    let fail = |code: &str| complete(&format!("error={code}"));
    let Some(login) = cookie(&headers)
        .and_then(|sealed| open::<LoginState>(&state, LOGIN_LABEL, sealed))
        .filter(|login| login.expires > now())
        .filter(|login| Some(login.provider.as_str()) == Some(provider.as_str()))
        .filter(|login| query.state.as_deref() == Some(login.state.as_str()))
    else {
        return fail("state_invalid");
    };
    if query.error.is_some() {
        return fail("provider_denied");
    }
    let Some(code) = query.code else {
        return fail("provider_failed");
    };
    let identity = match state
        .ctx
        .oidc
        .exchange(
            login.provider,
            &redirect_url(&state, login.provider),
            &code,
            &login.pkce_verifier,
            &login.nonce,
        )
        .await
    {
        Ok(identity) => identity,
        Err(failure) => {
            tracing::warn!(provider = login.provider.as_str(), %failure, "OIDC sign-in failed");
            return fail("provider_failed");
        }
    };
    let outcome = state
        .ctx
        .repos
        .accounts
        .oidc_login(OidcLogin {
            provider: login.provider,
            identity: &identity,
            link_user: login.link_user,
            invitation: login.invitation.as_deref(),
            open_signup: state.ctx.signup == Signup::Open,
        })
        .await;
    let user = match outcome {
        Ok(OidcOutcome::SignedIn(user)) => user,
        Ok(OidcOutcome::NoAccount) => return fail("no_account"),
        Ok(OidcOutcome::EmailTaken) => return fail("email_taken"),
        Ok(OidcOutcome::EmailUnverified) => return fail("email_unverified"),
        Ok(OidcOutcome::IdentityTaken) => return fail("identity_taken"),
        Ok(OidcOutcome::ProviderAlreadyLinked) => return fail("provider_already_linked"),
        Ok(OidcOutcome::InvitationInvalid) => return fail("invitation_invalid"),
        Err(failure) => {
            tracing::error!(%failure, "OIDC sign-in could not be stored");
            return fail("unavailable");
        }
    };
    let claim = seal(
        &state,
        CLAIM_LABEL,
        &Claim {
            user_id: user.id,
            spa_challenge: login.spa_challenge,
            expires: now() + CLAIM_TTL,
        },
    );
    let mut params = format!("code={claim}");
    if let Some(return_to) = &login.return_to {
        params.push_str("&return_to=");
        params.push_str(&encode_component(return_to));
    }
    complete(&params)
}

#[utoipa::path(
    post, path = "/auth/exchange", tag = "auth",
    request_body = ExchangeRequest,
    responses(
        (status = OK, body = Session),
        (status = BAD_REQUEST, body = ApiError),
    )
)]
async fn exchange_code(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ExchangeRequest>,
) -> ApiResult<Json<Session>> {
    let claim = open::<Claim>(&state, CLAIM_LABEL, &body.code)
        .filter(|claim| claim.expires > now())
        .filter(|claim| challenge_of(&body.code_verifier) == claim.spa_challenge)
        .ok_or_else(|| bad_request(M::SignInCodeInvalid))?;
    let accounts = &state.ctx.repos.accounts;
    let user = accounts
        .user(claim.user_id)
        .await
        .map_err(repo_error)?
        .ok_or_else(|| bad_request(M::SignInCodeInvalid))?;
    let token = accounts
        .start_session(user.id, user_agent(&headers))
        .await
        .map_err(repo_error)?;
    Ok(Json(Session { token, user }))
}

pub fn configured(state: &AppState, provider: &str) -> ApiResult<OidcKind> {
    OidcKind::parse(provider)
        .filter(|kind| state.ctx.oidc.is_configured(*kind))
        .ok_or_else(|| not_found(M::ProviderNotConfigured))
}

fn redirect_url(state: &AppState, kind: OidcKind) -> String {
    format!(
        "{}/api/v1/auth/oidc/{}/callback",
        state.app_url,
        kind.as_str()
    )
}

fn seal<T: Serialize>(state: &AppState, label: &[u8], value: &T) -> String {
    let plaintext = serde_json::to_vec(value).expect("login state serializes");
    URL_SAFE_NO_PAD.encode(state.ctx.master_key.seal(label, &plaintext))
}

fn open<T: for<'de> Deserialize<'de>>(state: &AppState, label: &[u8], sealed: &str) -> Option<T> {
    let bytes = URL_SAFE_NO_PAD.decode(sealed).ok()?;
    let plaintext = state.ctx.master_key.open(label, &bytes).ok()?;
    serde_json::from_slice(&plaintext).ok()
}

fn cookie(headers: &HeaderMap) -> Option<&str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == COOKIE)
        .map(|(_, value)| value)
}

fn challenge_of(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn is_challenge(value: &str) -> bool {
    value.len() == 43
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn is_local_path(path: &str) -> bool {
    path.len() <= MAX_RETURN_TO
        && path.starts_with('/')
        && !path.starts_with("//")
        && !path.contains('\\')
        && !path.chars().any(char::is_control)
}

fn encode_component(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn now() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn return_paths_stay_on_this_origin() {
        assert!(is_local_path("/acme/lab"));
        assert!(is_local_path("/invite/abc?x=1"));
        assert!(!is_local_path("//evil.example.com"));
        assert!(!is_local_path("https://evil.example.com"));
        assert!(!is_local_path("/\\evil.example.com"));
        assert_eq!(encode_component("/invite/a b&c"), "/invite/a%20b%26c");
    }
}
