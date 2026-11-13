pub mod accounts;
pub mod fleets;
pub mod groups;
pub mod orgs;

use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct Repositories {
    pub accounts: accounts::Accounts,
    pub orgs: orgs::Orgs,
    pub groups: groups::Groups,
    pub fleets: fleets::Fleets,
}

impl Repositories {
    pub fn new(pool: PgPool) -> Self {
        Self {
            accounts: accounts::Accounts::new(pool.clone()),
            orgs: orgs::Orgs::new(pool.clone()),
            groups: groups::Groups::new(pool.clone()),
            fleets: fleets::Fleets::new(pool),
        }
    }
}

pub(crate) fn after_id(column: &str, after: Option<Uuid>, param: usize) -> String {
    match after {
        Some(_) => format!("AND {column} > ${param}"),
        None => String::new(),
    }
}

pub(crate) fn like_pattern(term: &str) -> String {
    let escaped = term
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}
