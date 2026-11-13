use axum::body::{Body, to_bytes};
use axum::http::{Request, StatusCode};
use fleet_lib::AppContext;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

use crate::handlers::common::ApiError;
use crate::{AppState, app, build_router};

const OPENAPI_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../packages/fleet_client/openapi.json"
);

fn offline_state() -> AppState {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://offline@127.0.0.1:1/offline")
        .expect("a lazy pool needs no connection");
    AppState {
        db: pool.clone(),
        ctx: AppContext::new(pool),
        app_url: "http://localhost:5173".into(),
    }
}

#[test]
fn the_openapi_document_is_current() {
    let (_, api) = build_router().split_for_parts();
    let expected = format!("{}\n", api.to_pretty_json().unwrap());
    let committed = std::fs::read_to_string(OPENAPI_PATH).unwrap_or_default();
    assert!(
        committed == expected,
        "packages/fleet_client/openapi.json is out of date; run `bun run codegen`"
    );
}

#[tokio::test]
async fn unknown_routes_answer_the_error_envelope_in_the_requested_language() {
    let response = app(offline_state(), None)
        .oneshot(
            Request::get("/api/v1/nothing-here")
                .header("accept-language", "es-AR,es;q=0.9")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let request_id = response
        .headers()
        .get(crate::request_id::HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = to_bytes(response.into_body(), 64 * 1024).await.unwrap();
    let error: ApiError = serde_json::from_slice(&body).unwrap();
    assert_eq!(error.error, "not_found");
    assert_eq!(error.message, "Ninguna ruta coincide con esta dirección");
    assert!(error.request_id.is_some());
    assert_eq!(error.request_id, request_id);
}
