use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::{IntoParams, ToSchema};

pub const DEFAULT_LIMIT: u32 = 50;
pub const MAX_LIMIT: u32 = 200;
const MAX_CURSOR_LEN: usize = 16 * 1024;

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct Pagination {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

impl Pagination {
    pub fn limit(&self) -> usize {
        self.limit_max(MAX_LIMIT)
    }

    pub fn limit_max(&self, max: u32) -> usize {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, max) as usize
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}

impl<T> Page<T> {
    pub fn split(mut items: Vec<T>, limit: usize, cursor: impl Fn(&T) -> String) -> Self {
        let more = items.len() > limit;
        items.truncate(limit);
        let next_cursor = more.then(|| items.last().map(cursor)).flatten();
        Self { items, next_cursor }
    }
}

pub fn encode_cursor(tag: &str, keys: &[Value]) -> String {
    let mut payload = vec![Value::String(tag.to_string())];
    payload.extend_from_slice(keys);
    URL_SAFE_NO_PAD.encode(Value::Array(payload).to_string())
}

pub fn decode_cursor(raw: &str, tag: &str) -> Option<Vec<Value>> {
    if raw.len() > MAX_CURSOR_LEN {
        return None;
    }
    let bytes = URL_SAFE_NO_PAD.decode(raw).ok()?;
    let Value::Array(mut payload) = serde_json::from_slice(&bytes).ok()? else {
        return None;
    };
    if payload.first()? != &Value::String(tag.to_string()) {
        return None;
    }
    payload.remove(0);
    Some(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cursor_round_trips_and_checks_its_tag() {
        let raw = encode_cursor("name", &[json!("a"), json!(1)]);
        assert_eq!(
            decode_cursor(&raw, "name"),
            Some(vec![json!("a"), json!(1)])
        );
        assert_eq!(decode_cursor(&raw, "id"), None);
        assert_eq!(decode_cursor("not base64!", "name"), None);
        let page = Page::split(vec![1, 2, 3], 2, |n| n.to_string());
        assert_eq!(page.items, vec![1, 2]);
        assert_eq!(page.next_cursor.as_deref(), Some("2"));
    }
}
