use std::borrow::Cow;
use std::sync::Arc;

use axum::extract::rejection::{JsonRejection, PathRejection, QueryRejection};
use axum::extract::{FromRequest, FromRequestParts, Request};
use axum::http::request::Parts;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use fleet_i18n::{Lang, Localize};
use fleet_lib::error::RepoError;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::messages::Message as M;

pub use fleet_lib::page::{MAX_LIMIT, Page, Pagination};

pub const MAX_NAME_LEN: usize = 1000;
pub const MAX_SLUG_LEN: usize = 56;

pub fn page_limit(page: &Pagination) -> i64 {
    page.limit_max(MAX_LIMIT) as i64
}

pub struct Cursor;

impl Cursor {
    pub fn encode(tag: &str, keys: &[Value]) -> String {
        fleet_lib::page::encode_cursor(tag, keys)
    }

    pub fn decode(page: &Pagination, tag: &str) -> ApiResult<Option<Vec<Value>>> {
        page.cursor
            .as_deref()
            .filter(|raw| !raw.is_empty())
            .map(|raw| fleet_lib::page::decode_cursor(raw, tag).ok_or_else(invalid_cursor))
            .transpose()
    }

    pub fn uuid(page: &Pagination, tag: &str) -> ApiResult<Option<Uuid>> {
        Self::decode(page, tag)?
            .map(|keys| parse_uuid(keys.first()).ok_or_else(invalid_cursor))
            .transpose()
    }

    pub fn string(page: &Pagination, tag: &str) -> ApiResult<Option<String>> {
        Self::decode(page, tag)?
            .map(|keys| match keys.first() {
                Some(Value::String(value)) => Ok(value.clone()),
                _ => Err(invalid_cursor()),
            })
            .transpose()
    }
}

pub fn parse_uuid(value: Option<&Value>) -> Option<Uuid> {
    value
        .and_then(Value::as_str)
        .and_then(|raw| Uuid::parse_str(raw).ok())
}

pub fn split_page<T>(
    items: Vec<T>,
    limit: i64,
    cursor: impl Fn(&T) -> String,
) -> (Vec<T>, Option<String>) {
    let page = Page::split(items, limit as usize, cursor);
    (page.items, page.next_cursor)
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct Search {
    pub q: Option<String>,
}

impl Search {
    pub fn term(&self) -> ApiResult<&str> {
        let term = self.q.as_deref().unwrap_or_default().trim();
        let mut v = Validator::new();
        if term.chars().count() > MAX_NAME_LEN {
            v.push("q", "too_long", M::SearchTooLong { max: MAX_NAME_LEN });
        }
        v.finish()?;
        Ok(term)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiError {
    pub error: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<FieldError>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FieldError {
    pub field: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
pub struct ErrorResponse {
    pub status: StatusCode,
    pub code: Cow<'static, str>,
    pub message: Box<dyn Localize>,
    pub details: Vec<Detail>,
}

#[derive(Debug)]
pub struct Detail {
    pub field: String,
    pub code: Cow<'static, str>,
    pub message: Box<dyn Localize>,
}

impl Detail {
    pub fn new(
        field: impl Into<String>,
        code: impl Into<Cow<'static, str>>,
        message: impl Localize + 'static,
    ) -> Self {
        Self {
            field: field.into(),
            code: code.into(),
            message: Box::new(message),
        }
    }
}

impl ErrorResponse {
    pub fn body(&self, lang: Lang) -> ApiError {
        ApiError {
            error: self.code.to_string(),
            message: self.message.render(lang),
            request_id: None,
            details: (!self.details.is_empty()).then(|| {
                self.details
                    .iter()
                    .map(|detail| FieldError {
                        field: detail.field.clone(),
                        code: detail.code.to_string(),
                        message: detail.message.render(lang),
                    })
                    .collect()
            }),
        }
    }

    pub fn with_details(mut self, details: Vec<Detail>) -> Self {
        self.details = details;
        self
    }
}

#[derive(Debug, Clone)]
pub struct Unrendered(pub Arc<ErrorResponse>);

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        let mut response = self.status.into_response();
        response.extensions_mut().insert(Unrendered(Arc::new(self)));
        response
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Language(pub Lang);

impl Language {
    pub fn of(headers: &HeaderMap) -> Self {
        Self(Lang::negotiate(
            headers
                .get(header::ACCEPT_LANGUAGE)
                .and_then(|value| value.to_str().ok()),
        ))
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Language {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(Self::of(&parts.headers))
    }
}

pub type ApiResult<T> = Result<T, ErrorResponse>;

#[derive(Debug, Clone, Copy, Default)]
pub struct Json<T>(pub T);

impl<T, S> FromRequest<S> for Json<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ErrorResponse;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match axum::Json::<T>::from_request(req, state).await {
            Ok(axum::Json(value)) => Ok(Self(value)),
            Err(rejection) => Err(json_rejection(rejection)),
        }
    }
}

impl<T: Serialize> IntoResponse for Json<T> {
    fn into_response(self) -> Response {
        axum::Json(self.0).into_response()
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Path<T>(pub T);

impl<T, S> FromRequestParts<S> for Path<T>
where
    T: DeserializeOwned + Send,
    S: Send + Sync,
{
    type Rejection = ErrorResponse;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match axum::extract::Path::<T>::from_request_parts(parts, state).await {
            Ok(axum::extract::Path(value)) => Ok(Self(value)),
            Err(rejection) => Err(path_rejection(rejection)),
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Query<T>(pub T);

impl<T, S> FromRequestParts<S> for Query<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ErrorResponse;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match axum::extract::Query::<T>::from_request_parts(parts, state).await {
            Ok(axum::extract::Query(value)) => Ok(Self(value)),
            Err(rejection) => Err(query_rejection(rejection)),
        }
    }
}

fn json_rejection(rejection: JsonRejection) -> ErrorResponse {
    match rejection {
        JsonRejection::JsonDataError(err) => {
            let text = err.body_text();
            let (path, detail) = serde_detail(&text);
            match field_error(path, &detail) {
                Some(field) => validation(vec![field]),
                None => bad_request(M::InvalidValue { detail }),
            }
        }
        JsonRejection::JsonSyntaxError(_) => bad_request(M::BodyNotJson),
        JsonRejection::MissingJsonContentType(_) => bad_request(M::BodyNotJsonContentType),
        rejection if rejection.status() == StatusCode::PAYLOAD_TOO_LARGE => {
            payload_too_large(M::BodyTooLarge)
        }
        _ => bad_request(M::BodyUnreadable),
    }
}

fn path_rejection(_: PathRejection) -> ErrorResponse {
    not_found(M::ResourceNotFound)
}

fn query_rejection(rejection: QueryRejection) -> ErrorResponse {
    let text = rejection.body_text();
    let detail = text
        .strip_prefix("Failed to deserialize query string: ")
        .unwrap_or(&text);
    bad_request(M::InvalidValue {
        detail: detail.trim().to_string(),
    })
}

fn serde_detail(text: &str) -> (Option<&str>, String) {
    let text = text
        .strip_prefix("Failed to deserialize the JSON body into the target type: ")
        .unwrap_or(text);
    let text = text.split(" at line ").next().unwrap_or(text).trim();
    let is_path = |s: &str| {
        !s.is_empty()
            && s.chars()
                .all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.' | '[' | ']'))
    };
    match text.split_once(": ") {
        Some((path, message)) if is_path(path) => (Some(path), message.to_string()),
        _ => (None, text.to_string()),
    }
}

fn field_error(path: Option<&str>, detail: &str) -> Option<Detail> {
    let named = [
        ("unknown_field", "unknown field `"),
        ("required", "missing field `"),
    ]
    .into_iter()
    .find_map(|(code, prefix)| {
        let field = detail.strip_prefix(prefix)?.split('`').next()?;
        Some((code, field))
    });
    let (code, field) = match (named, path) {
        (Some(("required", field)), Some(path)) => ("required", format!("{path}.{field}")),
        (Some((code, _)), Some(path)) => (code, path.to_string()),
        (Some((code, field)), None) => (code, field.to_string()),
        (None, Some(path)) => ("invalid_value", path.to_string()),
        (None, None) => return None,
    };
    Some(Detail::new(
        field,
        code,
        M::InvalidValue {
            detail: detail.to_string(),
        },
    ))
}

pub fn error(
    status: StatusCode,
    code: impl Into<Cow<'static, str>>,
    message: impl Localize + 'static,
) -> ErrorResponse {
    ErrorResponse {
        status,
        code: code.into(),
        message: Box::new(message),
        details: Vec::new(),
    }
}

pub fn not_found(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::NOT_FOUND, "not_found", message)
}

pub fn bad_request(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::BAD_REQUEST, "validation_error", message)
}

pub fn invalid_cursor() -> ErrorResponse {
    error(StatusCode::BAD_REQUEST, "invalid_cursor", M::InvalidCursor)
}

pub fn unauthenticated() -> ErrorResponse {
    error(
        StatusCode::UNAUTHORIZED,
        "unauthenticated",
        M::Unauthenticated,
    )
}

pub fn forbidden(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::FORBIDDEN, "forbidden", message)
}

pub fn conflict(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::CONFLICT, "conflict", message)
}

pub fn payload_too_large(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::PAYLOAD_TOO_LARGE, "payload_too_large", message)
}

pub fn internal_error(message: impl Localize + 'static) -> ErrorResponse {
    error(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", message)
}

pub fn validation(details: Vec<Detail>) -> ErrorResponse {
    bad_request(M::InvalidFields).with_details(details)
}

#[derive(Debug, Default)]
pub struct Validator {
    details: Vec<Detail>,
}

impl Validator {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(
        &mut self,
        field: impl Into<String>,
        code: &'static str,
        message: impl Localize + 'static,
    ) {
        self.details.push(Detail::new(field, code, message));
    }

    pub fn slug(&mut self, field: &str, value: &str) {
        if value.is_empty() {
            self.push(field, "required", M::SlugEmpty);
        } else if value.len() > MAX_SLUG_LEN {
            self.push(field, "too_long", M::SlugTooLong { max: MAX_SLUG_LEN });
        } else if !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            self.push(field, "format", M::SlugFormat);
        }
    }

    pub fn name(&mut self, field: &str, value: &str) {
        if value.trim().is_empty() {
            self.push(field, "required", M::NameEmpty);
        } else if value.chars().count() > MAX_NAME_LEN {
            self.push(field, "too_long", M::NameTooLong { max: MAX_NAME_LEN });
        }
    }

    pub fn finish(self) -> ApiResult<()> {
        if self.details.is_empty() {
            Ok(())
        } else {
            Err(validation(self.details))
        }
    }
}

pub fn db_error(err: sqlx::Error) -> ErrorResponse {
    if let Some(db) = err.as_database_error() {
        match db.code().as_deref() {
            Some("23503") => return not_found(M::ReferencedNotFound),
            Some("23505")
                if db
                    .constraint()
                    .is_some_and(|name| name.ends_with("slug_key")) =>
            {
                return conflict(M::SlugTaken).with_details(vec![Detail::new(
                    "slug",
                    "taken",
                    M::SlugTaken,
                )]);
            }
            Some("23505") => return conflict(M::AlreadyExists),
            Some("23514") => return bad_request(M::ConstraintViolated),
            Some("22001") => return bad_request(M::FieldTooLong),
            _ => {}
        }
    }
    if matches!(
        err,
        sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed | sqlx::Error::Io(_)
    ) {
        tracing::error!(error = %err, "database unavailable");
        return error(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            M::DatabaseUnavailable,
        );
    }

    tracing::error!(error = %err, "database operation failed");
    internal_error(M::DatabaseFailed)
}

pub fn repo_error(err: RepoError) -> ErrorResponse {
    match err {
        RepoError::Database(err) => db_error(err),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serde_messages_become_field_detail() {
        let field = |text: &str| {
            let (path, detail) = serde_detail(text);
            field_error(path, &detail)
        };
        let unknown = field(
            "Failed to deserialize the JSON body into the target type: unknown field `nmae`, \
             expected `name` or `slug` at line 1 column 8",
        )
        .unwrap();
        assert_eq!(unknown.field, "nmae");
        assert_eq!(unknown.code, "unknown_field");
        let missing = field(
            "Failed to deserialize the JSON body into the target type: b[0]: missing field `y` at line 1 column 23",
        )
        .unwrap();
        assert_eq!(
            (missing.field.as_str(), missing.code.as_ref()),
            ("b[0].y", "required")
        );
        assert!(field("invalid type: string, expected u32").is_none());
    }

    #[test]
    fn cursor_round_trips_and_checks_its_tag() {
        let id = Uuid::nil();
        let encoded = Cursor::encode("id", &[json!(id)]);
        let page = Pagination {
            cursor: Some(encoded),
            limit: None,
        };
        assert_eq!(Cursor::uuid(&page, "id").unwrap(), Some(id));
        assert_eq!(
            Cursor::uuid(&page, "name").unwrap_err().code,
            "invalid_cursor"
        );
        assert_eq!(Cursor::uuid(&Pagination::default(), "id").unwrap(), None);
        let garbage = Pagination {
            cursor: Some("not base64!".into()),
            limit: None,
        };
        assert_eq!(
            Cursor::string(&garbage, "id").unwrap_err().status,
            StatusCode::BAD_REQUEST
        );
    }
}
