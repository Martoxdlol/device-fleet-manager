use std::time::Duration;

use axum::Router;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::header::InvalidHeaderValue;
use axum::http::{HeaderName, HeaderValue, Method, StatusCode, header};
use axum::response::{IntoResponse, Response};
use fleet_lib::AppContext;
use sqlx::PgPool;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub mod handlers;
pub mod messages;
pub mod request_id;
pub mod trace;

#[cfg(test)]
mod tests;

pub const API_V1_PREFIX: &str = "/api/v1";

const MAX_JSON_BODY: usize = 1024 * 1024;
const PREFLIGHT_MAX_AGE: Duration = Duration::from_secs(2 * 60 * 60);

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub ctx: AppContext,
    pub app_url: String,
}

#[derive(OpenApi)]
#[openapi(
    info(title = "Fleet API", description = "HTTP API of the fleet server.", version = "0.1.0"),
    modifiers(&BearerScheme)
)]
pub struct ApiDoc;

struct BearerScheme;

impl Modify for BearerScheme {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        openapi
            .components
            .get_or_insert_with(Default::default)
            .add_security_scheme(
                "bearer",
                SecurityScheme::Http(HttpBuilder::new().scheme(HttpAuthScheme::Bearer).build()),
            );
    }
}

pub fn build_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(root))
        .routes(routes!(health))
        .nest(API_V1_PREFIX, handlers::router())
}

pub fn app(state: AppState, cors: Option<CorsLayer>) -> Router {
    let (router, _) = build_router().split_for_parts();
    let api = router
        .fallback(route_not_found)
        .method_not_allowed_fallback(method_not_allowed)
        .with_state(state)
        .layer(DefaultBodyLimit::max(MAX_JSON_BODY))
        .layer(CatchPanicLayer::custom(panic_response));
    let api = match cors {
        Some(cors) => api.layer(cors),
        None => api,
    };
    api.layer(axum::middleware::from_fn(request_id::layer))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::make_span)
                .on_response(trace::on_response),
        )
}

async fn route_not_found() -> Response {
    handlers::common::not_found(messages::Message::RouteNotFound).into_response()
}

async fn method_not_allowed() -> Response {
    handlers::common::error(
        StatusCode::METHOD_NOT_ALLOWED,
        "method_not_allowed",
        messages::Message::MethodNotAllowed,
    )
    .into_response()
}

fn panic_response(_: Box<dyn std::any::Any + Send + 'static>) -> Response {
    tracing::error!("request handler panicked");
    handlers::common::internal_error(messages::Message::Unexpected).into_response()
}

pub fn cors_layer(origins: &[String]) -> Result<Option<CorsLayer>, InvalidHeaderValue> {
    if origins.is_empty() && !cfg!(debug_assertions) {
        return Ok(None);
    }

    let allowed = origins
        .iter()
        .map(|origin| HeaderValue::from_str(origin))
        .collect::<Result<Vec<_>, _>>()?;

    let allow_origin = if cfg!(debug_assertions) {
        AllowOrigin::predicate(move |origin, _| {
            allowed.contains(origin) || is_localhost_origin(origin)
        })
    } else {
        AllowOrigin::list(allowed)
    };

    Ok(Some(
        CorsLayer::new()
            .allow_origin(allow_origin)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                HeaderName::from_static("last-event-id"),
            ])
            .expose_headers([HeaderName::from_static(request_id::HEADER)])
            .max_age(PREFLIGHT_MAX_AGE),
    ))
}

fn is_localhost_origin(origin: &HeaderValue) -> bool {
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let Some(host_port) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    let host = match host_port.strip_prefix('[') {
        Some(rest) => rest.split(']').next().unwrap_or(""),
        None => host_port.split(':').next().unwrap_or(host_port),
    };
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

#[utoipa::path(get, path = "/", responses((status = OK, description = "Server is up", body = String)))]
async fn root() -> &'static str {
    fleet_brand::NAME
}

#[utoipa::path(
    get, path = "/health",
    responses(
        (status = OK, description = "Database reachable", body = String),
        (status = SERVICE_UNAVAILABLE, description = "Database unreachable", body = String),
    )
)]
async fn health(State(state): State<AppState>) -> Result<String, (StatusCode, String)> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .map(|value| format!("db ok: {value}"))
        .map_err(|err| {
            tracing::error!(error = %err, "health probe could not reach the database");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "database unreachable".to_string(),
            )
        })
}
