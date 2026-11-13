use axum::body::{Body, HttpBody, to_bytes};
use axum::extract::Request;
use axum::http::{HeaderValue, header};
use axum::middleware::Next;
use axum::response::Response;
use uuid::Uuid;

use crate::handlers::common::{Language, Unrendered};

pub const HEADER: &str = "x-request-id";
const MAX_ERROR_BODY: usize = 64 * 1024;

pub async fn layer(request: Request, next: Next) -> Response {
    let id = fleet_lib::telemetry::trace_id().unwrap_or_else(|| Uuid::now_v7().to_string());
    let language = Language::of(request.headers());
    let response = next.run(request).await;
    let (mut parts, body) = response.into_parts();
    if let Ok(value) = HeaderValue::from_str(&id) {
        parts.headers.insert(HEADER, value);
    }
    if let Some(Unrendered(error)) = parts.extensions.remove::<Unrendered>() {
        let mut body = error.body(language.0);
        body.request_id = Some(id);
        return envelope(parts, &body);
    }
    let is_json_error = !parts.status.is_success()
        && !parts.status.is_redirection()
        && parts
            .headers
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.starts_with("application/json"));
    let small = body
        .size_hint()
        .exact()
        .is_some_and(|len| len <= MAX_ERROR_BODY as u64);
    if !is_json_error || !small {
        return Response::from_parts(parts, body);
    }
    let bytes = match to_bytes(body, MAX_ERROR_BODY).await {
        Ok(bytes) => bytes,
        Err(_) => return Response::from_parts(parts, Body::empty()),
    };
    let body = match serde_json::from_slice::<serde_json::Value>(&bytes) {
        Ok(serde_json::Value::Object(mut map)) => {
            map.insert("request_id".into(), serde_json::Value::String(id));
            let rewritten = serde_json::Value::Object(map).to_string();
            parts.headers.remove(header::CONTENT_LENGTH);
            Body::from(rewritten)
        }
        _ => Body::from(bytes),
    };
    Response::from_parts(parts, body)
}

pub async fn render_errors(request: Request, next: Next) -> Response {
    let language = Language::of(request.headers());
    let (mut parts, body) = next.run(request).await.into_parts();
    match parts.extensions.remove::<Unrendered>() {
        Some(Unrendered(error)) => envelope(parts, &error.body(language.0)),
        None => Response::from_parts(parts, body),
    }
}

fn envelope(mut parts: axum::http::response::Parts, body: &impl serde::Serialize) -> Response {
    let bytes = serde_json::to_vec(body).expect("the error envelope serializes");
    parts.headers.remove(header::CONTENT_LENGTH);
    parts.headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    Response::from_parts(parts, Body::from(bytes))
}
