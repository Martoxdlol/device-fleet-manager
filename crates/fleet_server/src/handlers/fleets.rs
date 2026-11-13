use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::model::{AccessLevel, Fleet, Grant, RESERVED_FLEET_SLUGS, VisibleFleet};
use fleet_lib::repo::fleets::{FleetCreate, GrantSubject};
use serde::Deserialize;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Validator, bad_request,
    not_found, page_limit, repo_error, split_page,
};
use super::scope::{FleetScope, OrgScope};
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_fleets, create_fleet))
        .routes(routes!(get_fleet, update_fleet, delete_fleet))
        .routes(routes!(list_grants, create_grant))
        .routes(routes!(update_grant, delete_grant))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateFleet {
    pub name: String,
    pub slug: String,
    pub agent_key_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateFleet {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub agent_key_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateGrant {
    pub user_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub level: AccessLevel,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateGrant {
    pub level: AccessLevel,
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/fleets", tag = "fleets",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), Pagination),
    responses((status = OK, body = Page<VisibleFleet>), (status = NOT_FOUND, body = ApiError))
)]
async fn list_fleets(
    State(state): State<AppState>,
    scope: OrgScope,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<VisibleFleet>>> {
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let fleets = state
        .ctx
        .repos
        .fleets
        .visible(
            scope.org_id(),
            scope.user_id(),
            scope.role().is_admin(),
            after,
            limit,
        )
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(fleets, limit, |fleet| {
        Cursor::encode("id", &[serde_json::json!(fleet.fleet.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs/{org_id}/fleets", tag = "fleets",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    request_body = CreateFleet,
    responses(
        (status = CREATED, body = Fleet),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn create_fleet(
    State(state): State<AppState>,
    scope: OrgScope,
    Json(body): Json<CreateFleet>,
) -> ApiResult<(StatusCode, Json<Fleet>)> {
    scope.require_admin()?;
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.slug("slug", &body.slug, RESERVED_FLEET_SLUGS);
    v.finish()?;
    match state
        .ctx
        .repos
        .fleets
        .create(
            scope.org_id(),
            body.name.trim(),
            &body.slug,
            body.agent_key_id,
        )
        .await
        .map_err(repo_error)?
    {
        FleetCreate::Created(fleet) => Ok((StatusCode::CREATED, Json(fleet))),
        FleetCreate::NoKey => Err(bad_request(M::NoAgentKey)),
    }
}

#[utoipa::path(
    get, path = "/fleets/{fleet_id}", tag = "fleets",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path)),
    responses((status = OK, body = VisibleFleet), (status = NOT_FOUND, body = ApiError))
)]
async fn get_fleet(scope: FleetScope) -> ApiResult<Json<VisibleFleet>> {
    Ok(Json(VisibleFleet {
        fleet: scope.fleet().clone(),
        access: scope.level(),
    }))
}

#[utoipa::path(
    patch, path = "/fleets/{fleet_id}", tag = "fleets",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path)),
    request_body = UpdateFleet,
    responses(
        (status = OK, body = Fleet),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn update_fleet(
    State(state): State<AppState>,
    scope: FleetScope,
    Json(body): Json<UpdateFleet>,
) -> ApiResult<Json<Fleet>> {
    scope.require(AccessLevel::Admin)?;
    let mut v = Validator::new();
    if let Some(name) = &body.name {
        v.name("name", name);
    }
    if let Some(slug) = &body.slug {
        v.slug("slug", slug, RESERVED_FLEET_SLUGS);
    }
    v.finish()?;
    state
        .ctx
        .repos
        .fleets
        .update(
            scope.fleet_id(),
            body.name.as_deref().map(str::trim),
            body.slug.as_deref(),
            body.agent_key_id,
        )
        .await
        .map_err(|error| match error {
            fleet_lib::error::RepoError::Database(ref db)
                if db.as_database_error().and_then(|e| e.constraint())
                    == Some("fleets_agent_key_fkey") =>
            {
                bad_request(M::NoAgentKey)
            }
            other => repo_error(other),
        })?
        .map(Json)
        .ok_or_else(|| not_found(M::FleetNotFound))
}

#[utoipa::path(
    delete, path = "/fleets/{fleet_id}", tag = "fleets",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn delete_fleet(State(state): State<AppState>, scope: FleetScope) -> ApiResult<StatusCode> {
    scope.require(AccessLevel::Admin)?;
    state
        .ctx
        .repos
        .fleets
        .delete(scope.fleet_id())
        .await
        .map_err(repo_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/fleets/{fleet_id}/grants", tag = "grants",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path), Pagination),
    responses(
        (status = OK, body = Page<Grant>),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn list_grants(
    State(state): State<AppState>,
    scope: FleetScope,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<Grant>>> {
    scope.require(AccessLevel::Admin)?;
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let grants = state
        .ctx
        .repos
        .fleets
        .grants(scope.fleet_id(), after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(grants, limit, |grant| {
        Cursor::encode("id", &[serde_json::json!(grant.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/fleets/{fleet_id}/grants", tag = "grants",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path)),
    request_body = CreateGrant,
    responses(
        (status = CREATED, body = Grant),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn create_grant(
    State(state): State<AppState>,
    scope: FleetScope,
    Json(body): Json<CreateGrant>,
) -> ApiResult<(StatusCode, Json<Grant>)> {
    scope.require(AccessLevel::Admin)?;
    let subject = match (body.user_id, body.group_id) {
        (Some(user_id), None) => GrantSubject::User(user_id),
        (None, Some(group_id)) => GrantSubject::Group(group_id),
        _ => return Err(bad_request(M::GrantSubject)),
    };
    state
        .ctx
        .repos
        .fleets
        .grant(
            scope.org_id(),
            scope.fleet_id(),
            subject,
            body.level,
            scope.user_id(),
        )
        .await
        .map_err(repo_error)?
        .map(|grant| (StatusCode::CREATED, Json(grant)))
        .ok_or_else(|| not_found(M::ReferencedNotFound))
}

#[utoipa::path(
    patch, path = "/fleets/{fleet_id}/grants/{grant_id}", tag = "grants",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path), ("grant_id" = Uuid, Path)),
    request_body = UpdateGrant,
    responses(
        (status = OK, body = Grant),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn update_grant(
    State(state): State<AppState>,
    scope: FleetScope,
    Path(path): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateGrant>,
) -> ApiResult<Json<Grant>> {
    let (_, grant_id) = path;
    scope.require(AccessLevel::Admin)?;
    state
        .ctx
        .repos
        .fleets
        .set_grant_level(scope.fleet_id(), grant_id, body.level)
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::GrantNotFound))
}

#[utoipa::path(
    delete, path = "/fleets/{fleet_id}/grants/{grant_id}", tag = "grants",
    security(("bearer" = [])),
    params(("fleet_id" = Uuid, Path), ("grant_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn delete_grant(
    State(state): State<AppState>,
    scope: FleetScope,
    Path(path): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, grant_id) = path;
    scope.require(AccessLevel::Admin)?;
    let revoked = state
        .ctx
        .repos
        .fleets
        .revoke(scope.fleet_id(), grant_id)
        .await
        .map_err(repo_error)?;
    if revoked {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found(M::GrantNotFound))
    }
}
