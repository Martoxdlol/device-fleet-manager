pub mod admin;
pub mod agent_keys;
pub mod auth;
pub mod common;
pub mod fleets;
pub mod groups;
pub mod invitations;
pub mod me;
pub mod oidc;
pub mod orgs;
pub mod scope;

use utoipa_axum::router::OpenApiRouter;

use crate::AppState;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .merge(auth::router())
        .merge(oidc::router())
        .merge(me::router())
        .merge(orgs::router())
        .merge(invitations::router())
        .merge(groups::router())
        .merge(agent_keys::router())
        .merge(fleets::router())
        .merge(admin::router())
}
