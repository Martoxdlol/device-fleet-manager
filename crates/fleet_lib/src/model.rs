use serde::{Deserialize, Serialize, Serializer};
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "org_role", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum OrgRole {
    Owner,
    Admin,
    Member,
}

impl OrgRole {
    pub fn is_admin(self) -> bool {
        matches!(self, OrgRole::Owner | OrgRole::Admin)
    }
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[sqlx(type_name = "access_level", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum AccessLevel {
    Read,
    Write,
    Admin,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Signup {
    Invite,
    Open,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub instance_admin: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct MyOrganization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub role: OrgRole,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Member {
    pub user_id: Uuid,
    pub email: String,
    pub name: String,
    pub role: OrgRole,
    #[serde(with = "time::serde::rfc3339")]
    pub joined_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Invitation {
    pub id: Uuid,
    pub org_id: Uuid,
    pub email: String,
    pub role: OrgRole,
    pub invited_by: Option<Uuid>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Group {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub member_count: i64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct AgentKey {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    #[serde(serialize_with = "base64url")]
    #[schema(value_type = String, format = Byte)]
    pub public_key: Vec<u8>,
    pub fleet_count: i64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Fleet {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub slug: String,
    pub agent_key_id: Uuid,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct VisibleFleet {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub fleet: Fleet,
    pub access: AccessLevel,
}

#[derive(Debug, Clone, Serialize, ToSchema, sqlx::FromRow)]
pub struct Grant {
    pub id: Uuid,
    pub fleet_id: Uuid,
    pub user_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub subject_name: String,
    pub subject_email: Option<String>,
    pub level: AccessLevel,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

fn base64url<S: Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
    use base64::Engine;
    serializer.serialize_str(&base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes))
}

pub const MIN_SLUG_LEN: usize = 2;
pub const MAX_SLUG_LEN: usize = 56;

pub const RESERVED_ORG_SLUGS: &[&str] = &[
    "admin",
    "api",
    "assets",
    "auth",
    "health",
    "invite",
    "login",
    "logout",
    "new",
    "profile",
    "reset-password",
    "settings",
    "setup",
    "signup",
];

pub const RESERVED_FLEET_SLUGS: &[&str] = &["settings", "new"];

pub fn is_slug(value: &str) -> bool {
    (MIN_SLUG_LEN..=MAX_SLUG_LEN).contains(&value.len())
        && value.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
}

pub fn slugify(name: &str) -> String {
    let mut slug = String::new();
    for c in name.chars().flat_map(char::to_lowercase) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.is_empty() && !slug.ends_with('-') {
            slug.push('-');
        }
        if slug.len() >= MAX_SLUG_LEN {
            break;
        }
    }
    slug.trim_end_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_lowercase_words_joined_by_single_hyphens() {
        assert!(is_slug("acme"));
        assert!(is_slug("acme-2"));
        assert!(!is_slug("a"));
        assert!(!is_slug("Acme"));
        assert!(!is_slug("acme--corp"));
        assert!(!is_slug("-acme"));
        assert!(!is_slug("acme_corp"));
        assert_eq!(slugify("  Acme, Corp. (Main)  "), "acme-corp-main");
        assert_eq!(slugify("Ñandú"), "and");
        assert!(is_slug(&slugify(&"x".repeat(200))));
    }
}
