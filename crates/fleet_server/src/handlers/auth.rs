use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use fleet_lib::auth::{dummy_verify, hash_password, verify_password};
use fleet_lib::model::{Organization, RESERVED_ORG_SLUGS, Signup, User};
use fleet_lib::repo::accounts::{Joined, NewAdmin, SetupOutcome};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use super::common::{
    ApiError, ApiResult, Json, Validator, conflict, error, forbidden, not_found, repo_error,
};
use super::scope::{Principal, user_agent};
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(instance))
        .routes(routes!(setup))
        .routes(routes!(login))
        .routes(routes!(signup))
        .routes(routes!(logout))
        .routes(routes!(reset_password))
}

#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Password,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InstanceInfo {
    pub setup_required: bool,
    pub signup: Signup,
    pub providers: Vec<Provider>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Session {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SetupRequest {
    pub token: String,
    pub email: String,
    pub name: String,
    pub password: String,
    pub org_name: String,
    pub org_slug: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SetupResponse {
    pub token: String,
    pub user: User,
    pub org: Organization,
}

impl From<Box<Joined>> for SetupResponse {
    fn from(joined: Box<Joined>) -> Self {
        let Joined { user, org, token } = *joined;
        Self { token, user, org }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SignupRequest {
    pub email: String,
    pub name: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub password: String,
}

#[utoipa::path(
    get, path = "/instance", tag = "auth",
    responses((status = OK, body = InstanceInfo))
)]
async fn instance(State(state): State<AppState>) -> ApiResult<Json<InstanceInfo>> {
    let setup_required = state
        .ctx
        .repos
        .accounts
        .setup_required()
        .await
        .map_err(repo_error)?;
    Ok(Json(InstanceInfo {
        setup_required,
        signup: state.ctx.signup,
        providers: vec![Provider::Password],
    }))
}

#[utoipa::path(
    post, path = "/setup", tag = "auth",
    request_body = SetupRequest,
    responses(
        (status = CREATED, body = SetupResponse),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    )
)]
async fn setup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SetupRequest>,
) -> ApiResult<(StatusCode, Json<SetupResponse>)> {
    let email = body.email.trim();
    let mut v = Validator::new();
    v.email("email", email);
    v.short_name("name", &body.name);
    v.password("password", &body.password);
    v.name("org_name", &body.org_name);
    v.slug("org_slug", &body.org_slug, RESERVED_ORG_SLUGS);
    v.finish()?;
    let password_hash = hash_password(&body.password);
    let outcome = state
        .ctx
        .repos
        .accounts
        .setup(
            &body.token,
            NewAdmin {
                email,
                name: body.name.trim(),
                password_hash: &password_hash,
                org_name: body.org_name.trim(),
                org_slug: &body.org_slug,
            },
            &state.ctx.master_key,
            user_agent(&headers),
        )
        .await
        .map_err(repo_error)?;
    match outcome {
        SetupOutcome::Done(joined) => Ok((StatusCode::CREATED, Json(joined.into()))),
        SetupOutcome::BadToken => Err(forbidden(M::SetupTokenInvalid)),
    }
}

#[utoipa::path(
    post, path = "/auth/login", tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = OK, body = Session),
        (status = UNAUTHORIZED, body = ApiError),
    )
)]
async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Json<Session>> {
    let found = state
        .ctx
        .repos
        .accounts
        .password_login(body.email.trim())
        .await
        .map_err(repo_error)?;
    let user = match found {
        Some((user, Some(phc))) if verify_password(&body.password, &phc) => user,
        Some((_, Some(_))) => return Err(invalid_credentials()),
        _ => {
            dummy_verify(&body.password);
            return Err(invalid_credentials());
        }
    };
    let token = state
        .ctx
        .repos
        .accounts
        .start_session(user.id, user_agent(&headers))
        .await
        .map_err(repo_error)?;
    Ok(Json(Session { token, user }))
}

#[utoipa::path(
    post, path = "/auth/signup", tag = "auth",
    request_body = SignupRequest,
    responses(
        (status = CREATED, body = Session),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn signup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SignupRequest>,
) -> ApiResult<(StatusCode, Json<Session>)> {
    if state.ctx.signup != Signup::Open {
        return Err(forbidden(M::SignupClosed));
    }
    let email = body.email.trim();
    let mut v = Validator::new();
    v.email("email", email);
    v.short_name("name", &body.name);
    v.password("password", &body.password);
    v.finish()?;
    let created = state
        .ctx
        .repos
        .accounts
        .signup(
            email,
            body.name.trim(),
            &hash_password(&body.password),
            user_agent(&headers),
        )
        .await
        .map_err(repo_error)?;
    match created {
        Some((user, token)) => Ok((StatusCode::CREATED, Json(Session { token, user }))),
        None => Err(conflict(M::EmailTaken)),
    }
}

#[utoipa::path(
    post, path = "/auth/logout", tag = "auth",
    security(("bearer" = [])),
    responses(
        (status = NO_CONTENT),
        (status = UNAUTHORIZED, body = ApiError),
    )
)]
async fn logout(State(state): State<AppState>, principal: Principal) -> ApiResult<StatusCode> {
    state
        .ctx
        .repos
        .accounts
        .end_session(principal.0.session_id)
        .await
        .map_err(repo_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post, path = "/auth/password-reset", tag = "auth",
    request_body = ResetPasswordRequest,
    responses(
        (status = OK, body = Session),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn reset_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ResetPasswordRequest>,
) -> ApiResult<Json<Session>> {
    let mut v = Validator::new();
    v.password("password", &body.password);
    v.finish()?;
    let reset = state
        .ctx
        .repos
        .accounts
        .reset_password(
            &body.token,
            &hash_password(&body.password),
            user_agent(&headers),
        )
        .await
        .map_err(repo_error)?;
    match reset {
        Some((user, token)) => Ok(Json(Session { token, user })),
        None => Err(not_found(M::ResetLinkInvalid)),
    }
}

fn invalid_credentials() -> super::common::ErrorResponse {
    error(
        StatusCode::UNAUTHORIZED,
        "invalid_credentials",
        M::InvalidCredentials,
    )
}
