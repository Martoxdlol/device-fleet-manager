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
    let response = app(offline_state(), None, None)
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

#[tokio::test]
async fn the_console_is_served_beside_the_api() {
    let web = std::env::temp_dir().join(format!("fleet-web-{}", uuid::Uuid::now_v7()));
    std::fs::create_dir_all(web.join("assets")).unwrap();
    std::fs::write(web.join("index.html"), "console").unwrap();
    std::fs::write(web.join("assets/app.js"), "script").unwrap();
    let app = app(offline_state(), None, Some(&web));
    let get = |path: &str| {
        let app = app.clone();
        let path = path.to_string();
        async move {
            let response = app
                .oneshot(Request::get(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            let status = response.status();
            let body = to_bytes(response.into_body(), 64 * 1024).await.unwrap();
            (status, String::from_utf8_lossy(&body).into_owned())
        }
    };

    assert_eq!(get("/").await, (StatusCode::OK, "console".into()));
    assert_eq!(
        get("/acme/servers").await,
        (StatusCode::OK, "console".into())
    );
    assert_eq!(
        get("/assets/app.js").await,
        (StatusCode::OK, "script".into())
    );
    for path in ["/api", "/api/v1", "/api/v1/nothing-here", "/api/v2/x"] {
        let (status, body) = get(path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        let error: ApiError = serde_json::from_str(&body).unwrap();
        assert_eq!(error.error, "not_found", "{path}");
    }
    std::fs::remove_dir_all(web).unwrap();
}
