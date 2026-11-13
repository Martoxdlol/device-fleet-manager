use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::model::AgentKey;
use fleet_lib::repo::fleets::KeyDelete;
use serde::Deserialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Validator, conflict,
    not_found, page_limit, repo_error, split_page,
};
use super::scope::OrgScope;
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_keys, create_key))
        .routes(routes!(rename_key, delete_key))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct KeyName {
    pub name: String,
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/agent-keys", tag = "agent-keys",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), Pagination),
    responses((status = OK, body = Page<AgentKey>), (status = NOT_FOUND, body = ApiError))
)]
async fn list_keys(
    State(state): State<AppState>,
    scope: OrgScope,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<AgentKey>>> {
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let keys = state
        .ctx
        .repos
        .fleets
        .keys(scope.org_id(), after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(keys, limit, |key| {
        Cursor::encode("id", &[serde_json::json!(key.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs/{org_id}/agent-keys", tag = "agent-keys",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    request_body = KeyName,
    responses(
        (status = CREATED, body = AgentKey),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn create_key(
    State(state): State<AppState>,
    scope: OrgScope,
    Json(body): Json<KeyName>,
) -> ApiResult<(StatusCode, Json<AgentKey>)> {
    scope.require_admin()?;
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.finish()?;
    let key = state
        .ctx
        .repos
        .fleets
        .create_key(scope.org_id(), body.name.trim(), &state.ctx.master_key)
        .await
        .map_err(repo_error)?;
    Ok((StatusCode::CREATED, Json(key)))
}

#[utoipa::path(
    patch, path = "/orgs/{org_id}/agent-keys/{key_id}", tag = "agent-keys",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("key_id" = Uuid, Path)),
    request_body = KeyName,
    responses(
        (status = OK, body = AgentKey),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn rename_key(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
    Json(body): Json<KeyName>,
) -> ApiResult<Json<AgentKey>> {
    let (_, key_id) = path;
    scope.require_admin()?;
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.finish()?;
    state
        .ctx
        .repos
        .fleets
        .rename_key(scope.org_id(), key_id, body.name.trim())
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::AgentKeyNotFound))
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}/agent-keys/{key_id}", tag = "agent-keys",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("key_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn delete_key(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, key_id) = path;
    scope.require_admin()?;
    match state
        .ctx
        .repos
        .fleets
        .delete_key(scope.org_id(), key_id)
        .await
        .map_err(repo_error)?
    {
        KeyDelete::Deleted => Ok(StatusCode::NO_CONTENT),
        KeyDelete::NotFound => Err(not_found(M::AgentKeyNotFound)),
        KeyDelete::InUse => Err(conflict(M::AgentKeyInUse)),
    }
}
