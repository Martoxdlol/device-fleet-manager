use sqlx::AssertSqlSafe;
use sqlx::PgPool;
use uuid::Uuid;

use super::after_id;
use crate::error::RepoResult;
use crate::model::{Group, Member};

const GROUP: &str = "g.id, g.org_id, g.name, \
    (SELECT count(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count, \
    g.created_at, g.updated_at";

#[derive(Clone)]
pub struct Groups {
    pool: PgPool,
}

impl Groups {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list(
        &self,
        org_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<Group>> {
        let sql = format!(
            "SELECT {GROUP} FROM groups g WHERE g.org_id = $1 {} ORDER BY g.id LIMIT $2",
            after_id("g.id", after, 3)
        );
        Ok(sqlx::query_as::<_, Group>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn create(&self, org_id: Uuid, name: &str) -> RepoResult<Group> {
        Ok(sqlx::query_as::<_, Group>(
            "WITH g AS (INSERT INTO groups (org_id, name) VALUES ($1, $2) RETURNING *) \
             SELECT g.id, g.org_id, g.name, 0::bigint AS member_count, g.created_at, g.updated_at FROM g",
        )
        .bind(org_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn rename(&self, org_id: Uuid, id: Uuid, name: &str) -> RepoResult<Option<Group>> {
        Ok(sqlx::query_as::<_, Group>(AssertSqlSafe(format!(
            "WITH g AS (UPDATE groups SET name = $3, updated_at = now() \
                        WHERE org_id = $1 AND id = $2 RETURNING *) \
             SELECT {GROUP} FROM g"
        )))
        .bind(org_id)
        .bind(id)
        .bind(name)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn delete(&self, org_id: Uuid, id: Uuid) -> RepoResult<bool> {
        Ok(
            sqlx::query("DELETE FROM groups WHERE org_id = $1 AND id = $2")
                .bind(org_id)
                .bind(id)
                .execute(&self.pool)
                .await?
                .rows_affected()
                == 1,
        )
    }

    pub async fn members(
        &self,
        org_id: Uuid,
        group_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<Member>> {
        let sql = format!(
            "SELECT gm.user_id, u.email, u.name, m.role, gm.created_at AS joined_at \
             FROM group_members gm \
             JOIN org_members m ON m.org_id = gm.org_id AND m.user_id = gm.user_id \
             JOIN users u ON u.id = gm.user_id \
             WHERE gm.org_id = $1 AND gm.group_id = $2 {} ORDER BY gm.user_id LIMIT $3",
            after_id("gm.user_id", after, 4)
        );
        Ok(sqlx::query_as::<_, Member>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(group_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn add_members(
        &self,
        org_id: Uuid,
        group_id: Uuid,
        user_ids: &[Uuid],
    ) -> RepoResult<Option<i64>> {
        let (found, added) = sqlx::query_as::<_, (bool, i64)>(
            "WITH g AS (SELECT id FROM groups WHERE org_id = $1 AND id = $2), \
             added AS ( \
                 INSERT INTO group_members (org_id, group_id, user_id) \
                 SELECT $1, g.id, m.user_id FROM g JOIN org_members m \
                     ON m.org_id = $1 AND m.user_id = ANY($3) \
                 ON CONFLICT (group_id, user_id) DO NOTHING RETURNING 1) \
             SELECT EXISTS (SELECT 1 FROM g), (SELECT count(*) FROM added)",
        )
        .bind(org_id)
        .bind(group_id)
        .bind(user_ids)
        .fetch_one(&self.pool)
        .await?;
        Ok(found.then_some(added))
    }

    pub async fn remove_member(
        &self,
        org_id: Uuid,
        group_id: Uuid,
        user_id: Uuid,
    ) -> RepoResult<bool> {
        Ok(sqlx::query(
            "DELETE FROM group_members WHERE org_id = $1 AND group_id = $2 AND user_id = $3",
        )
        .bind(org_id)
        .bind(group_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?
        .rows_affected()
            == 1)
    }
}
