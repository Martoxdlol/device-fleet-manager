use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::auth::{hash_password, verify_password};
use fleet_lib::model::User;
use serde::Deserialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use super::common::{ApiError, ApiResult, Json, Validator, bad_request, not_found, repo_error};
use super::scope::Principal;
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(me, update_me))
        .routes(routes!(change_password))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateMe {
    pub name: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ChangePassword {
    pub current_password: Option<String>,
    pub new_password: String,
}

#[utoipa::path(
    get, path = "/me", tag = "me",
    security(("bearer" = [])),
    responses((status = OK, body = User), (status = UNAUTHORIZED, body = ApiError))
)]
async fn me(State(state): State<AppState>, principal: Principal) -> ApiResult<Json<User>> {
    state
        .ctx
        .repos
        .accounts
        .user(principal.user_id())
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::UserNotFound))
}

#[utoipa::path(
    patch, path = "/me", tag = "me",
    security(("bearer" = [])),
    request_body = UpdateMe,
    responses(
        (status = OK, body = User),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
    )
)]
async fn update_me(
    State(state): State<AppState>,
    principal: Principal,
    Json(body): Json<UpdateMe>,
) -> ApiResult<Json<User>> {
    let mut v = Validator::new();
    v.short_name("name", &body.name);
    v.finish()?;
    state
        .ctx
        .repos
        .accounts
        .rename(principal.user_id(), body.name.trim())
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::UserNotFound))
}

#[utoipa::path(
    put, path = "/me/password", tag = "me",
    security(("bearer" = [])),
    request_body = ChangePassword,
    responses(
        (status = NO_CONTENT),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
    )
)]
async fn change_password(
    State(state): State<AppState>,
    principal: Principal,
    Json(body): Json<ChangePassword>,
) -> ApiResult<StatusCode> {
    let mut v = Validator::new();
    v.password("new_password", &body.new_password);
    v.finish()?;
    let accounts = &state.ctx.repos.accounts;
    let current = accounts
        .password_hash(principal.user_id())
        .await
        .map_err(repo_error)?;
    if let Some(phc) = current {
        let matches = body
            .current_password
            .as_deref()
            .is_some_and(|password| verify_password(password, &phc));
        if !matches {
            return Err(bad_request(M::CurrentPasswordWrong));
        }
    }
    accounts
        .change_password(
            principal.user_id(),
            &hash_password(&body.new_password),
            principal.0.session_id,
        )
        .await
        .map_err(repo_error)?;
    Ok(StatusCode::NO_CONTENT)
}
