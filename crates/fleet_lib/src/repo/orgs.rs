use sqlx::AssertSqlSafe;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use super::{after_id, like_pattern};
use crate::auth::{INVITATION_TTL, hash, random_token};
use crate::error::RepoResult;
use crate::keys::MasterKey;
use crate::model::{Invitation, Member, MyOrganization, OrgRole, Organization};
use crate::repo::accounts::{Joined, insert_session, try_insert_user};
use crate::repo::fleets::insert_agent_key;

const ORG: &str = "id, name, slug, created_at, updated_at";
const INVITATION: &str = "id, org_id, email, role, invited_by, created_at, expires_at";
pub const DEFAULT_KEY_NAME: &str = "Default";

pub enum MemberChange {
    Done(Member),
    Removed,
    NotFound,
    OwnerRequired,
    LastOwner,
}

pub enum InvitationCreate {
    Created(Invitation, String),
    AlreadyMember,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct InvitationPreview {
    #[sqlx(flatten)]
    pub invitation: Invitation,
    pub org_name: String,
    pub org_slug: String,
    pub account_exists: bool,
}

pub enum Acceptance {
    Joined(Organization),
    NotFound,
    WrongEmail,
}

pub enum InvitedSignup {
    Joined(Box<Joined>),
    NotFound,
    AccountExists,
}

#[derive(Clone)]
pub struct Orgs {
    pool: PgPool,
}

impl Orgs {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        name: &str,
        slug: &str,
        owner: Uuid,
        master: &MasterKey,
    ) -> RepoResult<Organization> {
        let mut tx = self.pool.begin().await?;
        let org = insert_org(&mut tx, name, slug, owner, master).await?;
        tx.commit().await?;
        Ok(org)
    }

    pub async fn list_mine(
        &self,
        user_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<MyOrganization>> {
        let sql = format!(
            "SELECT o.id, o.name, o.slug, m.role, o.created_at, o.updated_at \
             FROM org_members m JOIN organizations o ON o.id = m.org_id \
             WHERE m.user_id = $1 {} ORDER BY o.id LIMIT $2",
            after_id("o.id", after, 3)
        );
        Ok(sqlx::query_as::<_, MyOrganization>(AssertSqlSafe(sql))
            .bind(user_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn update(
        &self,
        org_id: Uuid,
        name: Option<&str>,
        slug: Option<&str>,
    ) -> RepoResult<Option<Organization>> {
        Ok(sqlx::query_as::<_, Organization>(AssertSqlSafe(format!(
            "UPDATE organizations SET name = COALESCE($2, name), slug = COALESCE($3, slug), \
             updated_at = now() WHERE id = $1 RETURNING {ORG}"
        )))
        .bind(org_id)
        .bind(name)
        .bind(slug)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn delete(&self, org_id: Uuid) -> RepoResult<bool> {
        Ok(sqlx::query("DELETE FROM organizations WHERE id = $1")
            .bind(org_id)
            .execute(&self.pool)
            .await?
            .rows_affected()
            == 1)
    }

    pub async fn members(
        &self,
        org_id: Uuid,
        search: &str,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<Member>> {
        let filter = if search.is_empty() {
            ""
        } else {
            "AND (u.name ILIKE $4 OR u.email ILIKE $4)"
        };
        let sql = format!(
            "SELECT m.user_id, u.email, u.name, m.role, m.created_at AS joined_at \
             FROM org_members m JOIN users u ON u.id = m.user_id \
             WHERE m.org_id = $1 {filter} {} ORDER BY m.user_id LIMIT $2",
            after_id("m.user_id", after, 3)
        );
        let mut query = sqlx::query_as::<_, Member>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(limit + 1)
            .bind(after);
        if !search.is_empty() {
            query = query.bind(like_pattern(search));
        }
        Ok(query.fetch_all(&self.pool).await?)
    }

    pub async fn set_role(
        &self,
        org_id: Uuid,
        actor_is_owner: bool,
        user_id: Uuid,
        role: OrgRole,
    ) -> RepoResult<MemberChange> {
        let mut tx = self.pool.begin().await?;
        let target = locked_target(&mut tx, org_id, user_id).await?;
        let Some((current, other_owners)) = target else {
            return Ok(MemberChange::NotFound);
        };
        if (current == OrgRole::Owner || role == OrgRole::Owner) && !actor_is_owner {
            return Ok(MemberChange::OwnerRequired);
        }
        if current == OrgRole::Owner && role != OrgRole::Owner && !other_owners {
            return Ok(MemberChange::LastOwner);
        }
        let member = sqlx::query_as::<_, Member>(
            "WITH changed AS ( \
                 UPDATE org_members SET role = $3 WHERE org_id = $1 AND user_id = $2 \
                 RETURNING user_id, role, created_at) \
             SELECT c.user_id, u.email, u.name, c.role, c.created_at AS joined_at \
             FROM changed c JOIN users u ON u.id = c.user_id",
        )
        .bind(org_id)
        .bind(user_id)
        .bind(role)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(MemberChange::Done(member))
    }

    pub async fn remove_member(
        &self,
        org_id: Uuid,
        actor_is_owner: bool,
        user_id: Uuid,
    ) -> RepoResult<MemberChange> {
        let mut tx = self.pool.begin().await?;
        let target = locked_target(&mut tx, org_id, user_id).await?;
        let Some((current, other_owners)) = target else {
            return Ok(MemberChange::NotFound);
        };
        if current == OrgRole::Owner && !actor_is_owner {
            return Ok(MemberChange::OwnerRequired);
        }
        if current == OrgRole::Owner && !other_owners {
            return Ok(MemberChange::LastOwner);
        }
        sqlx::query("DELETE FROM org_members WHERE org_id = $1 AND user_id = $2")
            .bind(org_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(MemberChange::Removed)
    }

    pub async fn invite(
        &self,
        org_id: Uuid,
        email: &str,
        role: OrgRole,
        invited_by: Uuid,
    ) -> RepoResult<InvitationCreate> {
        let token = random_token();
        let invitation = sqlx::query_as::<_, Invitation>(AssertSqlSafe(format!(
            "INSERT INTO org_invitations (org_id, email, role, token_hash, invited_by, expires_at) \
             SELECT $1, $2, $3, $4, $5, now() + $6 \
             WHERE NOT EXISTS ( \
                 SELECT 1 FROM org_members m JOIN users u ON u.id = m.user_id \
                 WHERE m.org_id = $1 AND lower(u.email) = lower($2)) \
             ON CONFLICT (org_id, lower(email)) DO UPDATE SET \
                 role = EXCLUDED.role, token_hash = EXCLUDED.token_hash, \
                 invited_by = EXCLUDED.invited_by, created_at = now(), \
                 expires_at = EXCLUDED.expires_at \
             RETURNING {INVITATION}"
        )))
        .bind(org_id)
        .bind(email)
        .bind(role)
        .bind(hash(&token))
        .bind(invited_by)
        .bind(INVITATION_TTL)
        .fetch_optional(&self.pool)
        .await?;
        Ok(match invitation {
            Some(invitation) => InvitationCreate::Created(invitation, token),
            None => InvitationCreate::AlreadyMember,
        })
    }

    pub async fn invitations(
        &self,
        org_id: Uuid,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<Invitation>> {
        let sql = format!(
            "SELECT {INVITATION} FROM org_invitations WHERE org_id = $1 {} ORDER BY id LIMIT $2",
            after_id("id", after, 3)
        );
        Ok(sqlx::query_as::<_, Invitation>(AssertSqlSafe(sql))
            .bind(org_id)
            .bind(limit + 1)
            .bind(after)
            .fetch_all(&self.pool)
            .await?)
    }

    pub async fn revoke_invitation(&self, org_id: Uuid, id: Uuid) -> RepoResult<bool> {
        Ok(
            sqlx::query("DELETE FROM org_invitations WHERE org_id = $1 AND id = $2")
                .bind(org_id)
                .bind(id)
                .execute(&self.pool)
                .await?
                .rows_affected()
                == 1,
        )
    }

    pub async fn preview_invitation(&self, token: &str) -> RepoResult<Option<InvitationPreview>> {
        Ok(sqlx::query_as::<_, InvitationPreview>(
            "SELECT i.id, i.org_id, i.email, i.role, i.invited_by, i.created_at, i.expires_at, \
                    o.name AS org_name, o.slug AS org_slug, \
                    EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(i.email)) AS account_exists \
             FROM org_invitations i JOIN organizations o ON o.id = i.org_id \
             WHERE i.token_hash = $1 AND i.expires_at > now()",
        )
        .bind(hash(token))
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn accept_invitation(&self, token: &str, user: Uuid) -> RepoResult<Acceptance> {
        let mut tx = self.pool.begin().await?;
        let accepted = accept(&mut tx, token, user).await?;
        tx.commit().await?;
        Ok(accepted)
    }

    pub async fn signup_invited(
        &self,
        token: &str,
        name: &str,
        password_hash: &str,
        user_agent: Option<&str>,
    ) -> RepoResult<InvitedSignup> {
        let mut tx = self.pool.begin().await?;
        let email = sqlx::query_scalar::<_, String>(
            "SELECT email FROM org_invitations WHERE token_hash = $1 AND expires_at > now() FOR UPDATE",
        )
        .bind(hash(token))
        .fetch_optional(&mut *tx)
        .await?;
        let Some(email) = email else {
            return Ok(InvitedSignup::NotFound);
        };
        let Some(user) = try_insert_user(&mut tx, &email, name, Some(password_hash)).await? else {
            return Ok(InvitedSignup::AccountExists);
        };
        let Acceptance::Joined(org) = accept(&mut tx, token, user.id).await? else {
            return Ok(InvitedSignup::NotFound);
        };
        let token = insert_session(&mut tx, user.id, user_agent).await?;
        tx.commit().await?;
        Ok(InvitedSignup::Joined(Box::new(Joined { user, org, token })))
    }
}

async fn accept(conn: &mut PgConnection, token: &str, user: Uuid) -> RepoResult<Acceptance> {
    #[derive(sqlx::FromRow)]
    struct Row {
        email_matches: bool,
        #[sqlx(flatten)]
        org: Organization,
    }
    let row = sqlx::query_as::<_, Row>(
        "SELECT lower(i.email) = (SELECT lower(email) FROM users WHERE id = $2) AS email_matches, \
                o.id, o.name, o.slug, o.created_at, o.updated_at \
         FROM org_invitations i JOIN organizations o ON o.id = i.org_id \
         WHERE i.token_hash = $1 AND i.expires_at > now() FOR UPDATE OF i",
    )
    .bind(hash(token))
    .bind(user)
    .fetch_optional(&mut *conn)
    .await?;
    let Some(row) = row else {
        return Ok(Acceptance::NotFound);
    };
    if !row.email_matches {
        return Ok(Acceptance::WrongEmail);
    }
    sqlx::query(
        "WITH used AS (DELETE FROM org_invitations WHERE token_hash = $1 RETURNING org_id, role) \
         INSERT INTO org_members (org_id, user_id, role) SELECT org_id, $2, role FROM used \
         ON CONFLICT (org_id, user_id) DO NOTHING",
    )
    .bind(hash(token))
    .bind(user)
    .execute(&mut *conn)
    .await?;
    Ok(Acceptance::Joined(row.org))
}

pub(crate) async fn insert_org(
    conn: &mut PgConnection,
    name: &str,
    slug: &str,
    owner: Uuid,
    master: &MasterKey,
) -> RepoResult<Organization> {
    let org = sqlx::query_as::<_, Organization>(AssertSqlSafe(format!(
        "WITH org AS (INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING {ORG}), \
         owner AS (INSERT INTO org_members (org_id, user_id, role) SELECT id, $3, 'owner' FROM org) \
         SELECT {ORG} FROM org"
    )))
    .bind(name)
    .bind(slug)
    .bind(owner)
    .fetch_one(&mut *conn)
    .await?;
    insert_agent_key(conn, org.id, DEFAULT_KEY_NAME, master).await?;
    Ok(org)
}

async fn locked_target(
    conn: &mut PgConnection,
    org_id: Uuid,
    user_id: Uuid,
) -> RepoResult<Option<(OrgRole, bool)>> {
    sqlx::query("SELECT 1 FROM organizations WHERE id = $1 FOR UPDATE")
        .bind(org_id)
        .execute(&mut *conn)
        .await?;
    Ok(sqlx::query_as::<_, (OrgRole, bool)>(
        "SELECT role, EXISTS (SELECT 1 FROM org_members o \
                              WHERE o.org_id = $1 AND o.user_id <> $2 AND o.role = 'owner') \
         FROM org_members WHERE org_id = $1 AND user_id = $2",
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(conn)
    .await?)
}
