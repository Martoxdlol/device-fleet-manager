use sqlx::AssertSqlSafe;
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::error::RepoResult;
use crate::model::{AccessLevel, Fleet, OrgRole, Organization};

const SESSION: &str = "WITH s AS ( \
        SELECT id, user_id FROM sessions WHERE token_hash = $1 AND expires_at > now() \
    ), touched AS ( \
        UPDATE sessions SET last_seen_at = now(), expires_at = now() + interval '30 days' \
        WHERE id IN (SELECT id FROM s) AND last_seen_at < now() - interval '1 hour' \
    ) ";

const PRINCIPAL: &str = "s.id AS session_id, u.id AS user_id, u.email AS user_email, \
    u.name AS user_name, u.instance_admin";

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Principal {
    pub session_id: Uuid,
    pub user_id: Uuid,
    pub user_email: String,
    pub user_name: String,
    pub instance_admin: bool,
}

#[derive(Debug, Clone)]
pub struct OrgMembership {
    pub principal: Principal,
    pub org: Organization,
    pub role: OrgRole,
}

#[derive(Debug, Clone)]
pub struct FleetAccess {
    pub principal: Principal,
    pub fleet: Fleet,
    pub role: OrgRole,
    pub level: AccessLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Found<T> {
    Yes(T),
    No,
}

#[derive(sqlx::FromRow)]
struct OrgRow {
    #[sqlx(flatten)]
    principal: Principal,
    org_id: Option<Uuid>,
    org_name: Option<String>,
    org_slug: Option<String>,
    org_created_at: Option<OffsetDateTime>,
    org_updated_at: Option<OffsetDateTime>,
    role: Option<OrgRole>,
}

#[derive(sqlx::FromRow)]
struct FleetRow {
    #[sqlx(flatten)]
    principal: Principal,
    fleet_id: Option<Uuid>,
    org_id: Option<Uuid>,
    fleet_name: Option<String>,
    fleet_slug: Option<String>,
    agent_key_id: Option<Uuid>,
    fleet_created_at: Option<OffsetDateTime>,
    fleet_updated_at: Option<OffsetDateTime>,
    role: Option<OrgRole>,
    level: Option<AccessLevel>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SlugIds {
    pub org_id: Option<Uuid>,
    pub fleet_id: Option<Uuid>,
}

#[derive(Clone)]
pub struct AccessService {
    pool: PgPool,
}

impl AccessService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn principal(&self, token_hash: &[u8]) -> RepoResult<Option<Principal>> {
        let sql = format!("{SESSION} SELECT {PRINCIPAL} FROM s JOIN users u ON u.id = s.user_id");
        Ok(sqlx::query_as::<_, Principal>(AssertSqlSafe(sql))
            .bind(token_hash)
            .fetch_optional(&self.pool)
            .await?)
    }

    pub async fn org(
        &self,
        token_hash: &[u8],
        org_id: Option<Uuid>,
    ) -> RepoResult<Option<Found<OrgMembership>>> {
        let sql = format!(
            "{SESSION} SELECT {PRINCIPAL}, o.id AS org_id, o.name AS org_name, \
             o.slug AS org_slug, o.created_at AS org_created_at, \
             o.updated_at AS org_updated_at, m.role \
             FROM s JOIN users u ON u.id = s.user_id \
             LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = $2 \
             LEFT JOIN organizations o ON o.id = m.org_id"
        );
        let row = sqlx::query_as::<_, OrgRow>(AssertSqlSafe(sql))
            .bind(token_hash)
            .bind(org_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| {
            match (
                row.org_id,
                row.org_name,
                row.org_slug,
                row.org_created_at,
                row.org_updated_at,
                row.role,
            ) {
                (
                    Some(id),
                    Some(name),
                    Some(slug),
                    Some(created_at),
                    Some(updated_at),
                    Some(role),
                ) => Found::Yes(OrgMembership {
                    principal: row.principal,
                    org: Organization {
                        id,
                        name,
                        slug,
                        created_at,
                        updated_at,
                    },
                    role,
                }),
                _ => Found::No,
            }
        }))
    }

    pub async fn fleet(
        &self,
        token_hash: &[u8],
        fleet_id: Option<Uuid>,
    ) -> RepoResult<Option<Found<FleetAccess>>> {
        let sql = format!(
            "{SESSION} SELECT {PRINCIPAL}, f.id AS fleet_id, f.org_id, f.name AS fleet_name, \
             f.slug AS fleet_slug, f.agent_key_id, f.created_at AS fleet_created_at, \
             f.updated_at AS fleet_updated_at, m.role, \
             CASE WHEN m.role IN ('owner', 'admin') THEN 'admin'::access_level \
                  WHEN m.role IS NULL THEN NULL \
                  ELSE (SELECT max(g.level) FROM fleet_grants g \
                        WHERE g.fleet_id = f.id AND (g.user_id = u.id OR g.group_id IN ( \
                            SELECT gm.group_id FROM group_members gm \
                            WHERE gm.org_id = f.org_id AND gm.user_id = u.id))) \
             END AS level \
             FROM s JOIN users u ON u.id = s.user_id \
             LEFT JOIN fleets f ON f.id = $2 \
             LEFT JOIN org_members m ON m.org_id = f.org_id AND m.user_id = u.id"
        );
        let row = sqlx::query_as::<_, FleetRow>(AssertSqlSafe(sql))
            .bind(token_hash)
            .bind(fleet_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| {
            match (
                row.fleet_id,
                row.org_id,
                row.fleet_name,
                row.fleet_slug,
                row.agent_key_id,
                row.fleet_created_at,
                row.fleet_updated_at,
                row.role,
                row.level,
            ) {
                (
                    Some(id),
                    Some(org_id),
                    Some(name),
                    Some(slug),
                    Some(agent_key_id),
                    Some(created_at),
                    Some(updated_at),
                    Some(role),
                    Some(level),
                ) => Found::Yes(FleetAccess {
                    principal: row.principal,
                    fleet: Fleet {
                        id,
                        org_id,
                        name,
                        slug,
                        agent_key_id,
                        created_at,
                        updated_at,
                    },
                    role,
                    level,
                }),
                _ => Found::No,
            }
        }))
    }

    pub async fn resolve(
        &self,
        token_hash: &[u8],
        org_slug: &str,
        fleet_slug: Option<&str>,
    ) -> RepoResult<Option<(Principal, SlugIds)>> {
        #[derive(sqlx::FromRow)]
        struct Row {
            #[sqlx(flatten)]
            principal: Principal,
            #[sqlx(flatten)]
            ids: SlugIds,
        }
        let sql = format!(
            "{SESSION} SELECT {PRINCIPAL}, o.id AS org_id, \
             CASE WHEN m.role IN ('owner', 'admin') THEN f.id \
                  WHEN EXISTS (SELECT 1 FROM fleet_grants g \
                       WHERE g.fleet_id = f.id AND (g.user_id = u.id OR g.group_id IN ( \
                           SELECT gm.group_id FROM group_members gm \
                           WHERE gm.org_id = f.org_id AND gm.user_id = u.id))) THEN f.id \
             END AS fleet_id \
             FROM s JOIN users u ON u.id = s.user_id \
             LEFT JOIN organizations o ON o.slug = $2 \
                 AND EXISTS (SELECT 1 FROM org_members x WHERE x.org_id = o.id AND x.user_id = u.id) \
             LEFT JOIN org_members m ON m.org_id = o.id AND m.user_id = u.id \
             LEFT JOIN fleets f ON f.org_id = o.id AND f.slug = $3"
        );
        let row = sqlx::query_as::<_, Row>(AssertSqlSafe(sql))
            .bind(token_hash)
            .bind(org_slug)
            .bind(fleet_slug)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| (row.principal, row.ids)))
    }
}
