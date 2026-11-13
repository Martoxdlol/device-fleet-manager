use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use fleet_lib::auth::hash_password;
use fleet_lib::model::{Invitation, OrgRole, Organization};
use fleet_lib::repo::orgs::{Acceptance, InvitationCreate, InvitedSignup};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::auth::SetupResponse;
use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Validator, conflict,
    forbidden, not_found, page_limit, repo_error, split_page,
};
use super::scope::{OrgScope, Principal, user_agent};
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_invitations, create_invitation))
        .routes(routes!(revoke_invitation))
        .routes(routes!(preview_invitation))
        .routes(routes!(accept_invitation))
        .routes(routes!(signup_invited))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateInvitation {
    pub email: String,
    pub role: OrgRole,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreatedInvitation {
    pub invitation: Invitation,
    pub token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InvitationPreview {
    pub email: String,
    pub role: OrgRole,
    pub org_name: String,
    pub org_slug: String,
    pub account_exists: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InvitedSignupRequest {
    pub name: String,
    pub password: String,
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/invitations", tag = "invitations",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), Pagination),
    responses(
        (status = OK, body = Page<Invitation>),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn list_invitations(
    State(state): State<AppState>,
    scope: OrgScope,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<Invitation>>> {
    scope.require_admin()?;
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let invitations = state
        .ctx
        .repos
        .orgs
        .invitations(scope.org_id(), after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(invitations, limit, |invitation| {
        Cursor::encode("id", &[serde_json::json!(invitation.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs/{org_id}/invitations", tag = "invitations",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    request_body = CreateInvitation,
    responses(
        (status = CREATED, body = CreatedInvitation),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn create_invitation(
    State(state): State<AppState>,
    scope: OrgScope,
    Json(body): Json<CreateInvitation>,
) -> ApiResult<(StatusCode, Json<CreatedInvitation>)> {
    scope.require_admin()?;
    if body.role == OrgRole::Owner {
        scope.require_owner()?;
    }
    let email = body.email.trim();
    let mut v = Validator::new();
    v.email("email", email);
    v.finish()?;
    match state
        .ctx
        .repos
        .orgs
        .invite(scope.org_id(), email, body.role, scope.user_id())
        .await
        .map_err(repo_error)?
    {
        InvitationCreate::Created(invitation, token) => Ok((
            StatusCode::CREATED,
            Json(CreatedInvitation { invitation, token }),
        )),
        InvitationCreate::AlreadyMember => Err(conflict(M::AlreadyMember)),
    }
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}/invitations/{invitation_id}", tag = "invitations",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("invitation_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn revoke_invitation(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, invitation_id) = path;
    scope.require_admin()?;
    let revoked = state
        .ctx
        .repos
        .orgs
        .revoke_invitation(scope.org_id(), invitation_id)
        .await
        .map_err(repo_error)?;
    if revoked {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found(M::InvitationNotFound))
    }
}

#[utoipa::path(
    get, path = "/invitations/{token}", tag = "invitations",
    params(("token" = String, Path)),
    responses((status = OK, body = InvitationPreview), (status = NOT_FOUND, body = ApiError))
)]
async fn preview_invitation(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> ApiResult<Json<InvitationPreview>> {
    let preview = state
        .ctx
        .repos
        .orgs
        .preview_invitation(&token)
        .await
        .map_err(repo_error)?
        .ok_or_else(|| not_found(M::InvitationNotFound))?;
    Ok(Json(InvitationPreview {
        email: preview.invitation.email,
        role: preview.invitation.role,
        org_name: preview.org_name,
        org_slug: preview.org_slug,
        account_exists: preview.account_exists,
        expires_at: preview.invitation.expires_at,
    }))
}

#[utoipa::path(
    post, path = "/invitations/{token}/accept", tag = "invitations",
    security(("bearer" = [])),
    params(("token" = String, Path)),
    responses(
        (status = OK, body = Organization),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn accept_invitation(
    State(state): State<AppState>,
    principal: Principal,
    Path(token): Path<String>,
) -> ApiResult<Json<Organization>> {
    match state
        .ctx
        .repos
        .orgs
        .accept_invitation(&token, principal.user_id())
        .await
        .map_err(repo_error)?
    {
        Acceptance::Joined(org) => Ok(Json(org)),
        Acceptance::NotFound => Err(not_found(M::InvitationNotFound)),
        Acceptance::WrongEmail => Err(forbidden(M::InvitationWrongEmail)),
    }
}

#[utoipa::path(
    post, path = "/invitations/{token}/signup", tag = "invitations",
    params(("token" = String, Path)),
    request_body = InvitedSignupRequest,
    responses(
        (status = CREATED, body = SetupResponse),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn signup_invited(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(token): Path<String>,
    Json(body): Json<InvitedSignupRequest>,
) -> ApiResult<(StatusCode, Json<SetupResponse>)> {
    let mut v = Validator::new();
    v.short_name("name", &body.name);
    v.password("password", &body.password);
    v.finish()?;
    match state
        .ctx
        .repos
        .orgs
        .signup_invited(
            &token,
            body.name.trim(),
            &hash_password(&body.password),
            user_agent(&headers),
        )
        .await
        .map_err(repo_error)?
    {
        InvitedSignup::Joined(joined) => Ok((StatusCode::CREATED, Json(joined.into()))),
        InvitedSignup::NotFound => Err(not_found(M::InvitationNotFound)),
        InvitedSignup::AccountExists => Err(conflict(M::AccountExistsSignIn)),
    }
}
