use sqlx::AssertSqlSafe;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use super::{after_id, like_pattern};
use crate::auth::{PASSWORD_RESET_TTL, SESSION_IDLE, hash, random_token};
use crate::config::Bootstrap;
use crate::error::RepoResult;
use crate::keys::MasterKey;
use crate::model::{Organization, User, slugify};
use crate::oidc::{OidcKind, ProviderIdentity};
use crate::repo::orgs::insert_org;

const USER: &str =
    "id, email, name, instance_admin, password_hash IS NOT NULL AS has_password, created_at";
const SETUP_LOCK: i64 = 0x666c_6565_7401;

pub enum BootstrapOutcome {
    Existing,
    Created { email: String },
    SetupToken(String),
}

pub struct NewAdmin<'a> {
    pub email: &'a str,
    pub name: &'a str,
    pub password_hash: &'a str,
    pub org_name: &'a str,
    pub org_slug: &'a str,
}

pub struct Joined {
    pub user: User,
    pub org: Organization,
    pub token: String,
}

pub enum SetupOutcome {
    Done(Box<Joined>),
    BadToken,
}

pub enum InstanceAdminChange {
    Done(User),
    NotFound,
    LastAdmin,
}

#[derive(Clone)]
pub struct Accounts {
    pool: PgPool,
}

impl Accounts {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn setup_required(&self) -> RepoResult<bool> {
        Ok(
            sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM instance_setup)")
                .fetch_one(&self.pool)
                .await?,
        )
    }

    pub async fn bootstrap(
        &self,
        bootstrap: Option<&Bootstrap>,
        master: &MasterKey,
    ) -> RepoResult<BootstrapOutcome> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(SETUP_LOCK)
            .execute(&mut *tx)
            .await?;
        let has_users = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM users)")
            .fetch_one(&mut *tx)
            .await?;
        let outcome = if has_users {
            sqlx::query("DELETE FROM instance_setup")
                .execute(&mut *tx)
                .await?;
            BootstrapOutcome::Existing
        } else if let Some(bootstrap) = bootstrap {
            let name = bootstrap
                .email
                .split('@')
                .next()
                .unwrap_or(&bootstrap.email);
            let user = insert_user(
                &mut tx,
                &bootstrap.email,
                name,
                Some(bootstrap.password_hash.expose()),
                true,
            )
            .await?;
            let mut slug = slugify(&bootstrap.org_name);
            if slug.len() < crate::model::MIN_SLUG_LEN {
                slug = "default".into();
            }
            if crate::model::RESERVED_ORG_SLUGS.contains(&slug.as_str()) {
                slug.push_str("-org");
            }
            insert_org(&mut tx, &bootstrap.org_name, &slug, user.id, master).await?;
            sqlx::query("DELETE FROM instance_setup")
                .execute(&mut *tx)
                .await?;
            BootstrapOutcome::Created { email: user.email }
        } else {
            let token = sqlx::query_scalar::<_, String>(
                "WITH inserted AS ( \
                     INSERT INTO instance_setup (token) VALUES ($1) \
                     ON CONFLICT (singleton) DO NOTHING RETURNING token) \
                 SELECT token FROM inserted UNION ALL SELECT token FROM instance_setup",
            )
            .bind(random_token())
            .fetch_one(&mut *tx)
            .await?;
            BootstrapOutcome::SetupToken(token)
        };
        tx.commit().await?;
        Ok(outcome)
    }

    pub async fn setup(
        &self,
        token: &str,
        admin: NewAdmin<'_>,
        master: &MasterKey,
        user_agent: Option<&str>,
    ) -> RepoResult<SetupOutcome> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(SETUP_LOCK)
            .execute(&mut *tx)
            .await?;
        let matches = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM instance_setup WHERE token = $1) \
             AND NOT EXISTS (SELECT 1 FROM users)",
        )
        .bind(token)
        .fetch_one(&mut *tx)
        .await?;
        if !matches {
            return Ok(SetupOutcome::BadToken);
        }
        let user = insert_user(
            &mut tx,
            admin.email,
            admin.name,
            Some(admin.password_hash),
            true,
        )
        .await?;
        let org = insert_org(&mut tx, admin.org_name, admin.org_slug, user.id, master).await?;
        sqlx::query("DELETE FROM instance_setup")
            .execute(&mut *tx)
            .await?;
        let token = insert_session(&mut tx, user.id, user_agent).await?;
        tx.commit().await?;
        Ok(SetupOutcome::Done(Box::new(Joined { user, org, token })))
    }

    pub async fn password_login(&self, email: &str) -> RepoResult<Option<(User, Option<String>)>> {
        #[derive(sqlx::FromRow)]
        struct Row {
            #[sqlx(flatten)]
            user: User,
            password_hash: Option<String>,
        }
        let row = sqlx::query_as::<_, Row>(AssertSqlSafe(format!(
            "SELECT {USER}, password_hash FROM users WHERE lower(email) = lower($1)"
        )))
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|row| (row.user, row.password_hash)))
    }

    pub async fn signup(
        &self,
        email: &str,
        name: &str,
        password_hash: &str,
        user_agent: Option<&str>,
    ) -> RepoResult<Option<(User, String)>> {
        let mut tx = self.pool.begin().await?;
        let Some(user) = try_insert_user(&mut tx, email, name, Some(password_hash)).await? else {
            return Ok(None);
        };
        let token = insert_session(&mut tx, user.id, user_agent).await?;
        tx.commit().await?;
        Ok(Some((user, token)))
    }

    pub async fn start_session(
        &self,
        user_id: Uuid,
        user_agent: Option<&str>,
    ) -> RepoResult<String> {
        let mut conn = self.pool.acquire().await?;
        insert_session(&mut conn, user_id, user_agent).await
    }

    pub async fn end_session(&self, session_id: Uuid) -> RepoResult<()> {
        sqlx::query("DELETE FROM sessions WHERE id = $1")
            .bind(session_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn user(&self, id: Uuid) -> RepoResult<Option<User>> {
        Ok(sqlx::query_as::<_, User>(AssertSqlSafe(format!(
            "SELECT {USER} FROM users WHERE id = $1"
        )))
        .bind(id)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn rename(&self, id: Uuid, name: &str) -> RepoResult<Option<User>> {
        Ok(sqlx::query_as::<_, User>(AssertSqlSafe(format!(
            "UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING {USER}"
        )))
        .bind(id)
        .bind(name)
        .fetch_optional(&self.pool)
        .await?)
    }

    pub async fn password_hash(&self, id: Uuid) -> RepoResult<Option<String>> {
        Ok(
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT password_hash FROM users WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .flatten(),
        )
    }

    pub async fn change_password(
        &self,
        id: Uuid,
        password_hash: &str,
        keep_session: Uuid,
    ) -> RepoResult<()> {
        sqlx::query(
            "WITH changed AS ( \
                 UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1) \
             DELETE FROM sessions WHERE user_id = $1 AND id <> $3",
        )
        .bind(id)
        .bind(password_hash)
        .bind(keep_session)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_users(
        &self,
        search: &str,
        after: Option<Uuid>,
        limit: i64,
    ) -> RepoResult<Vec<User>> {
        let filter = if search.is_empty() {
            ""
        } else {
            "AND (name ILIKE $3 OR email ILIKE $3)"
        };
        let sql = format!(
            "SELECT {USER} FROM users WHERE true {filter} {} ORDER BY id LIMIT $1",
            after_id("id", after, 2)
        );
        let mut query = sqlx::query_as::<_, User>(AssertSqlSafe(sql))
            .bind(limit + 1)
            .bind(after);
        if !search.is_empty() {
            query = query.bind(like_pattern(search));
        }
        Ok(query.fetch_all(&self.pool).await?)
    }

    pub async fn set_instance_admin(
        &self,
        id: Uuid,
        value: bool,
    ) -> RepoResult<InstanceAdminChange> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(SETUP_LOCK)
            .execute(&mut *tx)
            .await?;
        if !value {
            let others = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM users WHERE instance_admin AND id <> $1)",
            )
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
            if !others {
                return Ok(InstanceAdminChange::LastAdmin);
            }
        }
        let user = sqlx::query_as::<_, User>(AssertSqlSafe(format!(
            "UPDATE users SET instance_admin = $2, updated_at = now() WHERE id = $1 RETURNING {USER}"
        )))
        .bind(id)
        .bind(value)
        .fetch_optional(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(match user {
            Some(user) => InstanceAdminChange::Done(user),
            None => InstanceAdminChange::NotFound,
        })
    }

    pub async fn create_password_reset(
        &self,
        user_id: Uuid,
        created_by: Uuid,
    ) -> RepoResult<Option<String>> {
        let token = random_token();
        let created = sqlx::query(
            "INSERT INTO password_resets (token_hash, user_id, created_by, expires_at) \
             SELECT $1, id, $3, now() + $4 FROM users WHERE id = $2",
        )
        .bind(hash(&token))
        .bind(user_id)
        .bind(created_by)
        .bind(PASSWORD_RESET_TTL)
        .execute(&self.pool)
        .await?
        .rows_affected();
        Ok((created == 1).then_some(token))
    }

    pub async fn reset_password(
        &self,
        token: &str,
        password_hash: &str,
        user_agent: Option<&str>,
    ) -> RepoResult<Option<(User, String)>> {
        let mut tx = self.pool.begin().await?;
        let user = sqlx::query_as::<_, User>(AssertSqlSafe(format!(
            "WITH used AS ( \
                 DELETE FROM password_resets WHERE token_hash = $1 RETURNING user_id, expires_at), \
             ended AS ( \
                 DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM used WHERE expires_at > now())) \
             UPDATE users SET password_hash = $2, updated_at = now() \
             WHERE id IN (SELECT user_id FROM used WHERE expires_at > now()) RETURNING {USER}"
        )))
        .bind(hash(token))
        .bind(password_hash)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(user) = user else {
            tx.commit().await?;
            return Ok(None);
        };
        let token = insert_session(&mut tx, user.id, user_agent).await?;
        tx.commit().await?;
        Ok(Some((user, token)))
    }
}

pub(crate) async fn insert_session(
    conn: &mut PgConnection,
    user_id: Uuid,
    user_agent: Option<&str>,
) -> RepoResult<String> {
    let token = random_token();
    sqlx::query(
        "INSERT INTO sessions (user_id, token_hash, expires_at, user_agent) \
         VALUES ($1, $2, now() + $3, $4)",
    )
    .bind(user_id)
    .bind(hash(&token))
    .bind(SESSION_IDLE)
    .bind(user_agent.map(|agent| agent.chars().take(512).collect::<String>()))
    .execute(conn)
    .await?;
    Ok(token)
}

pub(crate) async fn insert_user(
    conn: &mut PgConnection,
    email: &str,
    name: &str,
    password_hash: Option<&str>,
    instance_admin: bool,
) -> RepoResult<User> {
    Ok(sqlx::query_as::<_, User>(AssertSqlSafe(format!(
        "INSERT INTO users (email, name, password_hash, instance_admin) \
         VALUES ($1, $2, $3, $4) RETURNING {USER}"
    )))
    .bind(email)
    .bind(name)
    .bind(password_hash)
    .bind(instance_admin)
    .fetch_one(conn)
    .await?)
}

pub(crate) async fn try_insert_user(
    conn: &mut PgConnection,
    email: &str,
    name: &str,
    password_hash: Option<&str>,
) -> RepoResult<Option<User>> {
    Ok(sqlx::query_as::<_, User>(AssertSqlSafe(format!(
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) \
         ON CONFLICT (lower(email)) DO NOTHING RETURNING {USER}"
    )))
    .bind(email)
    .bind(name)
    .bind(password_hash)
    .fetch_optional(conn)
    .await?)
}

pub enum OidcOutcome {
    SignedIn(User),
    NoAccount,
    EmailTaken,
    EmailUnverified,
    IdentityTaken,
    ProviderAlreadyLinked,
    InvitationInvalid,
}

pub struct OidcLogin<'a> {
    pub provider: OidcKind,
    pub identity: &'a ProviderIdentity,
    pub link_user: Option<Uuid>,
    pub invitation: Option<&'a str>,
    pub open_signup: bool,
}

#[derive(Debug, Clone, serde::Serialize, utoipa::ToSchema, sqlx::FromRow)]
pub struct LinkedIdentity {
    pub provider: String,
    pub email: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: time::OffsetDateTime,
}

pub enum Unlink {
    Done,
    NotFound,
    LastSignIn,
}

impl Accounts {
    pub async fn oidc_login(&self, login: OidcLogin<'_>) -> RepoResult<OidcOutcome> {
        let provider = login.provider.as_str();
        let identity = login.identity;
        let mut tx = self.pool.begin().await?;
        let known = sqlx::query_scalar::<_, Uuid>(
            "UPDATE user_identities SET email = COALESCE($3, email) \
             WHERE provider = $1 AND subject = $2 RETURNING user_id",
        )
        .bind(provider)
        .bind(&identity.subject)
        .bind(&identity.email)
        .fetch_optional(&mut *tx)
        .await?;
        let user_id = match (known, login.link_user) {
            (Some(owner), Some(linking)) if owner != linking => {
                return Ok(OidcOutcome::IdentityTaken);
            }
            (Some(owner), _) => {
                if let Some(token) = login.invitation {
                    crate::repo::orgs::accept(&mut tx, token, owner).await?;
                }
                owner
            }
            (None, Some(linking)) => {
                let linked = sqlx::query(
                    "INSERT INTO user_identities (provider, subject, user_id, email) \
                     VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, provider) DO NOTHING",
                )
                .bind(provider)
                .bind(&identity.subject)
                .bind(linking)
                .bind(&identity.email)
                .execute(&mut *tx)
                .await?
                .rows_affected();
                if linked == 0 {
                    return Ok(OidcOutcome::ProviderAlreadyLinked);
                }
                linking
            }
            (None, None) => {
                let email = if let Some(token) = login.invitation {
                    let email = sqlx::query_scalar::<_, String>(
                        "SELECT email FROM org_invitations \
                         WHERE token_hash = $1 AND expires_at > now() FOR UPDATE",
                    )
                    .bind(hash(token))
                    .fetch_optional(&mut *tx)
                    .await?;
                    match email {
                        Some(email) => email,
                        None => return Ok(OidcOutcome::InvitationInvalid),
                    }
                } else if login.open_signup {
                    match &identity.email {
                        Some(email)
                            if identity.email_verified
                                || !login.provider.trusts_verified_email() =>
                        {
                            email.clone()
                        }
                        _ => return Ok(OidcOutcome::EmailUnverified),
                    }
                } else {
                    return Ok(OidcOutcome::NoAccount);
                };
                let name = identity
                    .name
                    .clone()
                    .filter(|name| !name.trim().is_empty())
                    .unwrap_or_else(|| email.split('@').next().unwrap_or(&email).to_string());
                let Some(user) = try_insert_user(&mut tx, &email, &name, None).await? else {
                    return Ok(OidcOutcome::EmailTaken);
                };
                sqlx::query(
                    "INSERT INTO user_identities (provider, subject, user_id, email) \
                     VALUES ($1, $2, $3, $4)",
                )
                .bind(provider)
                .bind(&identity.subject)
                .bind(user.id)
                .bind(&identity.email)
                .execute(&mut *tx)
                .await?;
                if let Some(token) = login.invitation {
                    crate::repo::orgs::accept(&mut tx, token, user.id).await?;
                }
                user.id
            }
        };
        let user = sqlx::query_as::<_, User>(AssertSqlSafe(format!(
            "SELECT {USER} FROM users WHERE id = $1"
        )))
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(OidcOutcome::SignedIn(user))
    }

    pub async fn identities(&self, user_id: Uuid) -> RepoResult<Vec<LinkedIdentity>> {
        Ok(sqlx::query_as::<_, LinkedIdentity>(
            "SELECT provider, email, created_at FROM user_identities \
             WHERE user_id = $1 ORDER BY provider",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn unlink(&self, user_id: Uuid, provider: OidcKind) -> RepoResult<Unlink> {
        let mut tx = self.pool.begin().await?;
        let (found, others) = sqlx::query_as::<_, (bool, bool)>(
            "SELECT EXISTS (SELECT 1 FROM user_identities WHERE user_id = $1 AND provider = $2), \
                    EXISTS (SELECT 1 FROM users WHERE id = $1 AND password_hash IS NOT NULL) \
                    OR EXISTS (SELECT 1 FROM user_identities WHERE user_id = $1 AND provider <> $2) \
             FROM users WHERE id = $1 FOR UPDATE",
        )
        .bind(user_id)
        .bind(provider.as_str())
        .fetch_one(&mut *tx)
        .await?;
        if !found {
            return Ok(Unlink::NotFound);
        }
        if !others {
            return Ok(Unlink::LastSignIn);
        }
        sqlx::query("DELETE FROM user_identities WHERE user_id = $1 AND provider = $2")
            .bind(user_id)
            .bind(provider.as_str())
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(Unlink::Done)
    }
}
