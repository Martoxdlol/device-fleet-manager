use axum::extract::State;
use axum::http::StatusCode;
use fleet_lib::model::{Member, MyOrganization, OrgRole, Organization, RESERVED_ORG_SLUGS, Signup};
use fleet_lib::repo::orgs::MemberChange;
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

use super::common::{
    ApiError, ApiResult, Cursor, Json, Page, Pagination, Path, Query, Search, Validator, conflict,
    forbidden, not_found, page_limit, repo_error, split_page,
};
use super::scope::{Bearer, OrgScope, Principal};
use crate::AppState;
use crate::messages::Message as M;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_orgs, create_org))
        .routes(routes!(get_org, update_org, delete_org))
        .routes(routes!(resolve))
        .routes(routes!(list_members))
        .routes(routes!(update_member, remove_member))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateOrg {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateOrg {
    pub name: Option<String>,
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateMember {
    pub role: OrgRole,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ResolveQuery {
    pub org: String,
    pub fleet: Option<String>,
}

#[derive(Debug, serde::Serialize, ToSchema)]
pub struct Resolved {
    pub org_id: Uuid,
    pub fleet_id: Option<Uuid>,
}

#[utoipa::path(
    get, path = "/orgs", tag = "orgs",
    security(("bearer" = [])),
    params(Pagination),
    responses((status = OK, body = Page<MyOrganization>), (status = UNAUTHORIZED, body = ApiError))
)]
async fn list_orgs(
    State(state): State<AppState>,
    principal: Principal,
    Query(page): Query<Pagination>,
) -> ApiResult<Json<Page<MyOrganization>>> {
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "id")?;
    let orgs = state
        .ctx
        .repos
        .orgs
        .list_mine(principal.user_id(), after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(orgs, limit, |org| {
        Cursor::encode("id", &[serde_json::json!(org.id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    post, path = "/orgs", tag = "orgs",
    security(("bearer" = [])),
    request_body = CreateOrg,
    responses(
        (status = CREATED, body = Organization),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn create_org(
    State(state): State<AppState>,
    principal: Principal,
    Json(body): Json<CreateOrg>,
) -> ApiResult<(StatusCode, Json<Organization>)> {
    if state.ctx.signup == Signup::Invite && !principal.0.instance_admin {
        return Err(forbidden(M::OrgCreationAdminsOnly));
    }
    let mut v = Validator::new();
    v.name("name", &body.name);
    v.slug("slug", &body.slug, RESERVED_ORG_SLUGS);
    v.finish()?;
    let org = state
        .ctx
        .repos
        .orgs
        .create(
            body.name.trim(),
            &body.slug,
            principal.user_id(),
            &state.ctx.master_key,
        )
        .await
        .map_err(repo_error)?;
    Ok((StatusCode::CREATED, Json(org)))
}

#[utoipa::path(
    get, path = "/orgs/{org_id}", tag = "orgs",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    responses((status = OK, body = MyOrganization), (status = NOT_FOUND, body = ApiError))
)]
async fn get_org(scope: OrgScope) -> ApiResult<Json<MyOrganization>> {
    let org = scope.org().clone();
    Ok(Json(MyOrganization {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: scope.role(),
        created_at: org.created_at,
        updated_at: org.updated_at,
    }))
}

#[utoipa::path(
    patch, path = "/orgs/{org_id}", tag = "orgs",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    request_body = UpdateOrg,
    responses(
        (status = OK, body = Organization),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn update_org(
    State(state): State<AppState>,
    scope: OrgScope,
    Json(body): Json<UpdateOrg>,
) -> ApiResult<Json<Organization>> {
    scope.require_admin()?;
    let mut v = Validator::new();
    if let Some(name) = &body.name {
        v.name("name", name);
    }
    if let Some(slug) = &body.slug {
        v.slug("slug", slug, RESERVED_ORG_SLUGS);
    }
    v.finish()?;
    state
        .ctx
        .repos
        .orgs
        .update(
            scope.org_id(),
            body.name.as_deref().map(str::trim),
            body.slug.as_deref(),
        )
        .await
        .map_err(repo_error)?
        .map(Json)
        .ok_or_else(|| not_found(M::OrganizationNotFound))
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}", tag = "orgs",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    )
)]
async fn delete_org(State(state): State<AppState>, scope: OrgScope) -> ApiResult<StatusCode> {
    scope.require_owner()?;
    state
        .ctx
        .repos
        .orgs
        .delete(scope.org_id())
        .await
        .map_err(repo_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/resolve", tag = "orgs",
    security(("bearer" = [])),
    params(ResolveQuery),
    responses(
        (status = OK, body = Resolved),
        (status = NOT_FOUND, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
    )
)]
async fn resolve(
    State(state): State<AppState>,
    bearer: Bearer,
    Query(query): Query<ResolveQuery>,
) -> ApiResult<Json<Resolved>> {
    let (_, ids) = state
        .ctx
        .access
        .resolve(bearer.token_hash(), &query.org, query.fleet.as_deref())
        .await
        .map_err(repo_error)?
        .ok_or_else(super::common::unauthenticated)?;
    let org_id = ids
        .org_id
        .ok_or_else(|| not_found(M::OrganizationNotFound))?;
    if query.fleet.is_some() && ids.fleet_id.is_none() {
        return Err(not_found(M::FleetNotFound));
    }
    Ok(Json(Resolved {
        org_id,
        fleet_id: ids.fleet_id,
    }))
}

#[utoipa::path(
    get, path = "/orgs/{org_id}/members", tag = "members",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), Pagination, Search),
    responses((status = OK, body = Page<Member>), (status = NOT_FOUND, body = ApiError))
)]
async fn list_members(
    State(state): State<AppState>,
    scope: OrgScope,
    Query(page): Query<Pagination>,
    Query(search): Query<Search>,
) -> ApiResult<Json<Page<Member>>> {
    let limit = page_limit(&page);
    let after = Cursor::uuid(&page, "user")?;
    let members = state
        .ctx
        .repos
        .orgs
        .members(scope.org_id(), search.term()?, after, limit)
        .await
        .map_err(repo_error)?;
    let (items, next_cursor) = split_page(members, limit, |member| {
        Cursor::encode("user", &[serde_json::json!(member.user_id)])
    });
    Ok(Json(Page { items, next_cursor }))
}

#[utoipa::path(
    patch, path = "/orgs/{org_id}/members/{user_id}", tag = "members",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("user_id" = Uuid, Path)),
    request_body = UpdateMember,
    responses(
        (status = OK, body = Member),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn update_member(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMember>,
) -> ApiResult<Json<Member>> {
    let (_, user_id) = path;
    scope.require_admin()?;
    member_change(
        state
            .ctx
            .repos
            .orgs
            .set_role(
                scope.org_id(),
                scope.role() == OrgRole::Owner,
                user_id,
                body.role,
            )
            .await
            .map_err(repo_error)?,
    )
    .map(Json)
}

#[utoipa::path(
    delete, path = "/orgs/{org_id}/members/{user_id}", tag = "members",
    security(("bearer" = [])),
    params(("org_id" = Uuid, Path), ("user_id" = Uuid, Path)),
    responses(
        (status = NO_CONTENT),
        (status = FORBIDDEN, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    )
)]
async fn remove_member(
    State(state): State<AppState>,
    scope: OrgScope,
    Path(path): Path<(Uuid, Uuid)>,
) -> ApiResult<StatusCode> {
    let (_, user_id) = path;
    let leaving = user_id == scope.user_id();
    if !leaving {
        scope.require_admin()?;
    }
    let change = state
        .ctx
        .repos
        .orgs
        .remove_member(
            scope.org_id(),
            leaving || scope.role() == OrgRole::Owner,
            user_id,
        )
        .await
        .map_err(repo_error)?;
    match change {
        MemberChange::Removed => Ok(StatusCode::NO_CONTENT),
        other => member_change(other).map(|_| StatusCode::NO_CONTENT),
    }
}

fn member_change(change: MemberChange) -> ApiResult<Member> {
    match change {
        MemberChange::Done(member) => Ok(member),
        MemberChange::Removed | MemberChange::NotFound => Err(not_found(M::MemberNotFound)),
        MemberChange::OwnerRequired => Err(forbidden(M::OwnerRequired)),
        MemberChange::LastOwner => Err(conflict(M::LastOwner)),
    }
}
