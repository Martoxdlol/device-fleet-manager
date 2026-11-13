use std::time::Duration;

use axum::body::Body;
use axum::extract::MatchedPath;
use axum::http::{Request, Response};
use tracing::Span;
use tracing::field::Empty;

pub fn make_span(request: &Request<Body>) -> Span {
    let method = request.method();
    let path = request.uri().path();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str);
    tracing::info_span!(
        "http_request",
        otel.name = route.map_or_else(|| method.to_string(), |route| format!("{method} {route}")),
        otel.kind = "server",
        http.request.method = %method,
        http.route = route,
        url.path = path,
        http.response.status_code = Empty,
    )
}

pub fn make_internal_span(request: &Request<Body>) -> Span {
    let span = make_span(request);
    fleet_lib::telemetry::continue_trace(&span, request.headers());
    span
}

pub fn on_response(response: &Response<Body>, _latency: Duration, span: &Span) {
    span.record("http.response.status_code", response.status().as_u16());
}
