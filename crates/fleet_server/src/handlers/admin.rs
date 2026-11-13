use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::model::User;
use fleet_lib::repo::accounts::InstanceAdminChange;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Search, conflict, not_found,
    page_limit, repo_error, split_page,
};
use super::scope::Principal;
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_users))
        .routes(routes!(update_user))
        .routes(routes!(create_password_reset))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateUser {
    pub instance_admin: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PasswordResetLink {
    pub token: String,
}

#[utoipa::path(
    get, path = "/admin/users", tag = "admin",
    security(("bearer" = [])),
    params(Pagination, Search),
    responses((status = OK, body = Page<User>), (status = FORBIDDEN, body = ApiError))
)]
async fn list_users(
    State(state): State<AppState>,
    principal: Principal,
    Query(page): Query<Pagination>,
    Query(search): Query<Search>,
) -> ApiResult<Json<Page<User>>> {
    principal.require_instance_admin()?;
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let users = state
        .ctx
        .repos
        .accounts
        .list_users(search.term()?, after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(users, limit, |user| {
        Cursor::encode("id", &[serde_json::json!(user.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    patch, path = "/admin/users/{user_id}", tag = "admin",
    security(("bearer" = [])),
    params(("user_id" = Uuid, Path)),
    request_body = UpdateUser,
    responses(
        (status = OK, body = User),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn update_user(
    State(state): State<AppState>,
    principal: Principal,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateUser>,
) -> ApiResult<Json<User>> {
    principal.require_instance_admin()?;
    match state
        .ctx
        .repos
        .accounts
        .set_instance_admin(user_id, body.instance_admin)
        .await
        .map_err(repo_error)?
    {
        InstanceAdminChange::Done(user) => Ok(Json(user)),
        InstanceAdminChange::NotFound => Err(not_found(M::UserNotFound)),
        InstanceAdminChange::LastAdmin => Err(conflict(M::LastInstanceAdmin)),
    }
}

#[utoipa::path(
    post, path = "/admin/users/{user_id}/password-reset", tag = "admin",
    security(("bearer" = [])),
    params(("user_id" = Uuid, Path)),
    responses(
        (status = CREATED, body = PasswordResetLink),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn create_password_reset(
    State(state): State<AppState>,
    principal: Principal,
    Path(user_id): Path<Uuid>,
) -> ApiResult<(StatusCode, Json<PasswordResetLink>)> {
    principal.require_instance_admin()?;
    state
        .ctx
        .repos
        .accounts
        .create_password_reset(user_id, principal.user_id())
        .await
        .map_err(repo_error)?
        .map(|token| (StatusCode::CREATED, Json(PasswordResetLink { token })))
        .ok_or_else(|| not_found(M::UserNotFound))
}
