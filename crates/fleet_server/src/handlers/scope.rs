use axum::extract::{FromRequestParts, RawPathParams};
use axum::http::request::Parts;
use axum::http::{HeaderMap, header};
use fleet_lib::access::{Found, OrgMembership};
use fleet_lib::auth::hash;
use fleet_lib::model::{AccessLevel, Fleet, OrgRole, Organization};
use uuid::Uuid;

use crate::AppState;
use crate::messages::Message as M;

use super::common::{ApiResult, ErrorResponse, forbidden, not_found, repo_error, unauthenticated};

pub struct Bearer(Vec<u8>);

impl Bearer {
    pub fn token_hash(&self) -> &[u8] {
        &self.0
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Bearer {
    type Rejection = ErrorResponse;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        bearer_token(&parts.headers)
            .map(|token| Self(hash(token)))
            .ok_or_else(unauthenticated)
    }
}

pub fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .split_once(' ')
        .filter(|(scheme, _)| scheme.eq_ignore_ascii_case("bearer"))
        .map(|(_, token)| token.trim())
        .filter(|token| !token.is_empty())
}

pub fn user_agent(headers: &HeaderMap) -> Option<&str> {
    headers.get(header::USER_AGENT)?.to_str().ok()
}

#[derive(Debug, Clone)]
pub struct Principal(pub fleet_lib::access::Principal);

impl Principal {
    pub fn user_id(&self) -> Uuid {
        self.0.user_id
    }

    pub fn require_instance_admin(&self) -> ApiResult<()> {
        if self.0.instance_admin {
            Ok(())
        } else {
            Err(forbidden(M::InstanceAdminRequired))
        }
    }
}

impl FromRequestParts<AppState> for Principal {
    type Rejection = ErrorResponse;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let bearer = Bearer::from_request_parts(parts, state).await?;
        state
            .ctx
            .access
            .principal(bearer.token_hash())
            .await
            .map_err(repo_error)?
            .map(Self)
            .ok_or_else(unauthenticated)
    }
}

#[derive(Debug, Clone)]
pub struct OrgScope(pub OrgMembership);

impl OrgScope {
    pub fn org(&self) -> &Organization {
        &self.0.org
    }

    pub fn org_id(&self) -> Uuid {
        self.0.org.id
    }

    pub fn user_id(&self) -> Uuid {
        self.0.principal.user_id
    }

    pub fn role(&self) -> OrgRole {
        self.0.role
    }

    pub fn require_admin(&self) -> ApiResult<()> {
        if self.role().is_admin() {
            Ok(())
        } else {
            Err(forbidden(M::OwnerOrAdminRequired))
        }
    }

    pub fn require_owner(&self) -> ApiResult<()> {
        if self.role() == OrgRole::Owner {
            Ok(())
        } else {
            Err(forbidden(M::OwnerRequired))
        }
    }
}

impl FromRequestParts<AppState> for OrgScope {
    type Rejection = ErrorResponse;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let bearer = Bearer::from_request_parts(parts, state).await?;
        let org_id = path_uuid(parts, state, "org_id").await;
        match state
            .ctx
            .access
            .org(bearer.token_hash(), org_id)
            .await
            .map_err(repo_error)?
        {
            None => Err(unauthenticated()),
            Some(Found::No) => Err(not_found(M::OrganizationNotFound)),
            Some(Found::Yes(membership)) => Ok(Self(membership)),
        }
    }
}

#[derive(Debug, Clone)]
pub struct FleetScope(pub fleet_lib::access::FleetAccess);

impl FleetScope {
    pub fn fleet(&self) -> &Fleet {
        &self.0.fleet
    }

    pub fn fleet_id(&self) -> Uuid {
        self.0.fleet.id
    }

    pub fn org_id(&self) -> Uuid {
        self.0.fleet.org_id
    }

    pub fn user_id(&self) -> Uuid {
        self.0.principal.user_id
    }

    pub fn level(&self) -> AccessLevel {
        self.0.level
    }

    pub fn require(&self, level: AccessLevel) -> ApiResult<()> {
        if self.0.level >= level {
            Ok(())
        } else {
            Err(forbidden(M::FleetAccessRequired { level }))
        }
    }
}

impl FromRequestParts<AppState> for FleetScope {
    type Rejection = ErrorResponse;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let bearer = Bearer::from_request_parts(parts, state).await?;
        let fleet_id = path_uuid(parts, state, "fleet_id").await;
        match state
            .ctx
            .access
            .fleet(bearer.token_hash(), fleet_id)
            .await
            .map_err(repo_error)?
        {
            None => Err(unauthenticated()),
            Some(Found::No) => Err(not_found(M::FleetNotFound)),
            Some(Found::Yes(access)) => Ok(Self(access)),
        }
    }
}

async fn path_uuid(parts: &mut Parts, state: &AppState, name: &str) -> Option<Uuid> {
    let params = RawPathParams::from_request_parts(parts, state).await.ok()?;
    params
        .iter()
        .find(|(key, _)| *key == name)
        .and_then(|(_, value)| Uuid::parse_str(value).ok())
}
