use sqlx::PgPool;

use crate::access::AccessService;
use crate::config::Config;
use crate::keys::MasterKey;
use crate::model::Signup;
use crate::oidc::OidcProviders;
use crate::repo::Repositories;

#[derive(Clone)]
pub struct AppContext {
    pub db: PgPool,
    pub repos: Repositories,
    pub access: AccessService,
    pub master_key: MasterKey,
    pub signup: Signup,
    pub oidc: OidcProviders,
}

impl AppContext {
    pub fn new(db: PgPool, master_key: MasterKey, signup: Signup, oidc: OidcProviders) -> Self {
        Self {
            repos: Repositories::new(db.clone()),
            access: AccessService::new(db.clone()),
            db,
            master_key,
            signup,
            oidc,
        }
    }

    pub fn from_config(config: &Config, db: PgPool) -> Self {
        Self::new(
            db,
            config.master_key.clone(),
            config.signup,
            OidcProviders::new(&config.oidc),
        )
    }
}
