use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::model::{Group, Member};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Validator, bad_request,
    not_found, page_limit, repo_error, split_page,
};
use super::scope::OrgScope;
use crate::AppState;
use crate::messages::Message as M;

pub const MAX_BATCH: usize = 500;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_groups, create_group))
        .routes(routes!(rename_group, delete_group))
        .routes(routes!(list_group_members, add_group_members))
        .routes(routes!(remove_group_member))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct GroupName {
    pub name: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct AddGroupMembers {
    pub user_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Added {
    pub added: i64,
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/groups", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), Pagination),
    responses((status = OK, body = Page<Group>), (status = NOT_FOUND, body = ApiError))
)]
async fn list_groups(
    State(state): State<AppState>,
    scope: OrgScope,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<Group>>> {
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let groups = state
        .ctx
        .repos
        .groups
        .list(scope.org_id(), after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(groups, limit, |group| {
        Cursor::encode("id", &[serde_json::json!(group.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs/{org_id}/groups", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    request_body = GroupName,
    responses(
        (status = CREATED, body = Group),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn create_group(
    State(state): State<AppState>,
    scope: OrgScope,
    Json(body): Json<GroupName>,
) -> ApiResult<(StatusCode, Json<Group>)> {
    scope.require_admin()?;
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.finish()?;
    let group = state
        .ctx
        .repos
        .groups
        .create(scope.org_id(), body.name.trim())
        .await
        .map_err(repo_error)?;
    Ok((StatusCode::CREATED, Json(group)))
}

#[utoipa::path(
    patch, path = "/orgs/{org_id}/groups/{group_id}", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("group_id" = Uuid, Path)),
    request_body = GroupName,
    responses(
        (status = OK, body = Group),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn rename_group(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
    Json(body): Json<GroupName>,
) -> ApiResult<Json<Group>> {
    let (_, group_id) = path;
    scope.require_admin()?;
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.finish()?;
    state
        .ctx
        .repos
        .groups
        .rename(scope.org_id(), group_id, body.name.trim())
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::GroupNotFound))
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}/groups/{group_id}", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("group_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn delete_group(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, group_id) = path;
    scope.require_admin()?;
    let deleted = state
        .ctx
        .repos
        .groups
        .delete(scope.org_id(), group_id)
        .await
        .map_err(repo_error)?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found(M::GroupNotFound))
    }
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/groups/{group_id}/members", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("group_id" = Uuid, Path), Pagination),
    responses((status = OK, body = Page<Member>), (status = NOT_FOUND, body = ApiError))
)]
async fn list_group_members(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<Member>>> {
    let (_, group_id) = path;
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "user")?;
    let members = state
        .ctx
        .repos
        .groups
        .members(scope.org_id(), group_id, after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(members, limit, |member| {
        Cursor::encode("user", &[serde_json::json!(member.user_id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs/{org_id}/groups/{group_id}/members", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("group_id" = Uuid, Path)),
    request_body = AddGroupMembers,
    responses(
        (status = OK, body = Added),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn add_group_members(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
    Json(body): Json<AddGroupMembers>,
) -> ApiResult<Json<Added>> {
    let (_, group_id) = path;
    scope.require_admin()?;
    if body.user_ids.is_empty() || body.user_ids.len() > MAX_BATCH {
        return Err(bad_request(M::InvalidValue {
            detail: format!("user_ids must have 1 to {MAX_BATCH} ids"),
        }));
    }
    let added = state
        .ctx
        .repos
        .groups
        .add_members(scope.org_id(), group_id, &body.user_ids)
        .await
        .map_err(repo_error)?
        .ok_or_else(|| not_found(M::GroupNotFound))?;
    Ok(Json(Added { added }))
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}/groups/{group_id}/members/{user_id}", tag = "groups",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("group_id" = Uuid, Path), ("user_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn remove_group_member(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, group_id, user_id) = path;
    scope.require_admin()?;
    let removed = state
        .ctx
        .repos
        .groups
        .remove_member(scope.org_id(), group_id, user_id)
        .await
        .map_err(repo_error)?;
    if removed {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found(M::MemberNotFound))
    }
}
