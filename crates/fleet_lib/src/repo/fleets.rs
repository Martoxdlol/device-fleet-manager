use sqlx::AssertSqlSafe;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use super::after_id;
use crate::error::RepoResult;
use crate::keys::MasterKey;
use crate::model::{AccessLevel, AgentKey, Fleet, Grant, VisibleFleet};

const FLEET: &str = "id, org_id, name, slug, agent_key_id, created_at, updated_at";
const KEY: &str = "k.id, k.org_id, k.name, k.public_key, \
    (SELECT count(*) FROM fleets f WHERE f.org_id = k.org_id AND f.agent_key_id = k.id) AS fleet_count, \
    k.created_at";
const GRANT: &str = "g.id, g.fleet_id, g.user_id, g.group_id, \
    COALESCE(u.name, gr.name) AS subject_name, u.email AS subject_email, g.level, g.created_at";

pub enum FleetCreate {
    Created(Fleet),
    NoKey,
}

pub enum KeyDelete {
    Deleted,
    NotFound,
    InUse,
}

pub enum GrantSubject {
    User(Uuid),
    Group(Uuid),
}

#[derive(Clone)]
pub struct Fleets {
    pool: PgPool,
}

impl Fleets {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn visible(
        &self,
        org_id: Uuid,
        user_id: Uuid,
        org_admin: bool,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<VisibleFleet>> {
        let sql = format!(
            "SELECT f.id, f.org_id, f.name, f.slug, f.agent_key_id, f.created_at, f.updated_at, v.access \
             FROM fleets f CROSS JOIN LATERAL ( \
                 SELECT CASE WHEN $3 THEN 'admin'::access_level ELSE ( \
                     SELECT max(g.level) FROM fleet_grants g \
                     WHERE g.fleet_id = f.id AND (g.user_id = $2 OR g.group_id IN ( \
                         SELECT gm.group_id FROM group_members gm \
                         WHERE gm.org_id = f.org_id AND gm.user_id = $2))) END AS access) v \
             WHERE f.org_id = $1 AND v.access IS NOT NULL {} ORDER BY f.id LIMIT $4",
            after_id("f.id", after, 5)
        );
        Ok(sqlx::query_as::<_, VisibleFleet>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(user_id)
            .bind(org_admin)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn create(
        &self,
        org_id: Uuid,
        name: &str,
        slug: &str,
        agent_key_id: Option<Uuid>,
    ) -> RepoResult<FleetCreate> {
        let fleet = sqlx::query_as::<_, Fleet>(AssertSqlSafe(format!(
            "INSERT INTO fleets (org_id, name, slug, agent_key_id) \
             SELECT $1, $2, $3, k.id FROM agent_keys k \
             WHERE k.org_id = $1 AND ($4::uuid IS NULL OR k.id = $4) \
             ORDER BY k.id LIMIT 1 RETURNING {FLEET}"
        )))
        .bind(org_id)
        .bind(name)
        .bind(slug)
        .bind(agent_key_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(fleet.map_or(FleetCreate::NoKey, FleetCreate::Created))
    }

    pub async fn update(
        &self,
        fleet_id: Uuid,
        name: Option<&str>,
        slug: Option<&str>,
        agent_key_id: Option<Uuid>,
    ) -> RepoResult<Option<Fleet>> {
        Ok(sqlx::query_as::<_, Fleet>(AssertSqlSafe(format!(
            "UPDATE fleets SET name = COALESCE($2, name), slug = COALESCE($3, slug), \
             agent_key_id = COALESCE($4, agent_key_id), updated_at = now() \
             WHERE id = $1 RETURNING {FLEET}"
        )))
        .bind(fleet_id)
        .bind(name)
        .bind(slug)
        .bind(agent_key_id)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn delete(&self, fleet_id: Uuid) -> RepoResult<bool> {
        Ok(sqlx::query("DELETE FROM fleets WHERE id = $1")
            .bind(fleet_id)
            .execute(&self.pool)
            .await?
            .rows_affected()
            == 1)
    }

    pub async fn grants(
        &self,
        fleet_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<Grant>> {
        let sql = format!(
            "SELECT {GRANT} FROM fleet_grants g \
             LEFT JOIN users u ON u.id = g.user_id \
             LEFT JOIN groups gr ON gr.id = g.group_id \
             WHERE g.fleet_id = $1 {} ORDER BY g.id LIMIT $2",
            after_id("g.id", after, 3)
        );
        Ok(sqlx::query_as::<_, Grant>(AssertSqlSafe(sql))
            .bind(fleet_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn grant(
        &self,
        org_id: Uuid,
        fleet_id: Uuid,
        subject: GrantSubject,
        level: AccessLevel,
        created_by: Uuid,
    ) -> RepoResult<Option<Grant>> {
        let (user_id, group_id, conflict) = match subject {
            GrantSubject::User(id) => (
                Some(id),
                None,
                "(fleet_id, user_id) WHERE user_id IS NOT NULL",
            ),
            GrantSubject::Group(id) => (
                None,
                Some(id),
                "(fleet_id, group_id) WHERE group_id IS NOT NULL",
            ),
        };
        let sql = format!(
            "WITH g AS ( \
                 INSERT INTO fleet_grants (org_id, fleet_id, user_id, group_id, level, created_by) \
                 SELECT $1, $2, $3, $4, $5, $6 \
                 WHERE EXISTS (SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $3) \
                    OR EXISTS (SELECT 1 FROM groups WHERE org_id = $1 AND id = $4) \
                 ON CONFLICT {conflict} DO UPDATE SET level = EXCLUDED.level \
                 RETURNING *) \
             SELECT {GRANT} FROM g \
             LEFT JOIN users u ON u.id = g.user_id \
             LEFT JOIN groups gr ON gr.id = g.group_id"
        );
        Ok(sqlx::query_as::<_, Grant>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(fleet_id)
            .bind(user_id)
            .bind(group_id)
            .bind(level)
            .bind(created_by)
            .fetch_optional(&self.pool)
            .await?)
    }

    pub async fn set_grant_level(
        &self,
        fleet_id: Uuid,
        grant_id: Uuid,
        level: AccessLevel,
    ) -> RepoResult<Option<Grant>> {
        let sql = format!(
            "WITH g AS (UPDATE fleet_grants SET level = $3 WHERE fleet_id = $1 AND id = $2 RETURNING *) \
             SELECT {GRANT} FROM g \
             LEFT JOIN users u ON u.id = g.user_id \
             LEFT JOIN groups gr ON gr.id = g.group_id"
        );
        Ok(sqlx::query_as::<_, Grant>(AssertSqlSafe(sql))
            .bind(fleet_id)
            .bind(grant_id)
            .bind(level)
            .fetch_optional(&self.pool)
            .await?)
    }

    pub async fn revoke(&self, fleet_id: Uuid, grant_id: Uuid) -> RepoResult<bool> {
        Ok(
            sqlx::query("DELETE FROM fleet_grants WHERE fleet_id = $1 AND id = $2")
                .bind(fleet_id)
                .bind(grant_id)
                .execute(&self.pool)
                .await?
                .rows_affected()
                == 1,
        )
    }

    pub async fn keys(
        &self,
        org_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<AgentKey>> {
        let sql = format!(
            "SELECT {KEY} FROM agent_keys k WHERE k.org_id = $1 {} ORDER BY k.id LIMIT $2",
            after_id("k.id", after, 3)
        );
        Ok(sqlx::query_as::<_, AgentKey>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn create_key(
        &self,
        org_id: Uuid,
        name: &str,
        master: &MasterKey,
    ) -> RepoResult<AgentKey> {
        let mut conn = self.pool.acquire().await?;
        insert_agent_key(&mut conn, org_id, name, master).await
    }

    pub async fn rename_key(
        &self,
        org_id: Uuid,
        id: Uuid,
        name: &str,
    ) -> RepoResult<Option<AgentKey>> {
        Ok(sqlx::query_as::<_, AgentKey>(AssertSqlSafe(format!(
            "WITH k AS (UPDATE agent_keys SET name = $3 WHERE org_id = $1 AND id = $2 RETURNING *) \
             SELECT {KEY} FROM k"
        )))
        .bind(org_id)
        .bind(id)
        .bind(name)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn delete_key(&self, org_id: Uuid, id: Uuid) -> RepoResult<KeyDelete> {
        #[derive(sqlx::FromRow)]
        struct Row {
            found: bool,
            used: bool,
            deleted: bool,
        }
        let row = sqlx::query_as::<_, Row>(
            "WITH target AS (SELECT id FROM agent_keys WHERE org_id = $1 AND id = $2 FOR UPDATE), \
             used AS (SELECT EXISTS (SELECT 1 FROM fleets WHERE org_id = $1 AND agent_key_id = $2) AS used), \
             deleted AS ( \
                 DELETE FROM agent_keys WHERE org_id = $1 AND id IN (SELECT id FROM target) \
                   AND NOT (SELECT used FROM used) RETURNING id) \
             SELECT EXISTS (SELECT 1 FROM target) AS found, (SELECT used FROM used) AS used, \
                    EXISTS (SELECT 1 FROM deleted) AS deleted",
        )
        .bind(org_id)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(match row {
            Row { deleted: true, .. } => KeyDelete::Deleted,
            Row { found: false, .. } => KeyDelete::NotFound,
            Row { used: true, .. } => KeyDelete::InUse,
            _ => KeyDelete::NotFound,
        })
    }
}

pub(crate) async fn insert_agent_key(
    conn: &mut PgConnection,
    org_id: Uuid,
    name: &str,
    master: &MasterKey,
) -> RepoResult<AgentKey> {
    let id = Uuid::now_v7();
    let generated = master.generate_agent_key(id);
    Ok(sqlx::query_as::<_, AgentKey>(AssertSqlSafe(format!(
        "WITH k AS ( \
             INSERT INTO agent_keys (id, org_id, name, public_key, sealed_private_key) \
             VALUES ($1, $2, $3, $4, $5) RETURNING *) \
         SELECT {KEY} FROM k"
    )))
    .bind(id)
    .bind(org_id)
    .bind(name)
    .bind(&generated.public_key[..])
    .bind(&generated.sealed_private_key)
    .fetch_one(conn)
    .await?)
}
