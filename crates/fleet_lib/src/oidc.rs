use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use openidconnect::core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata};
use openidconnect::reqwest;
use openidconnect::{
    AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl, Nonce, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::RwLock;
use utoipa::ToSchema;

use crate::config::Secret;

const METADATA_TTL: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum OidcKind {
    Google,
    Microsoft,
}

impl OidcKind {
    pub fn as_str(self) -> &'static str {
        match self {
            OidcKind::Google => "google",
            OidcKind::Microsoft => "microsoft",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "google" => Some(OidcKind::Google),
            "microsoft" => Some(OidcKind::Microsoft),
            _ => None,
        }
    }

    pub fn trusts_verified_email(self) -> bool {
        matches!(self, OidcKind::Google)
    }
}

#[derive(Debug, Clone)]
pub struct OidcProviderConfig {
    pub kind: OidcKind,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: Secret,
}

#[derive(Debug, Error)]
pub enum OidcError {
    #[error("the provider is not configured")]
    NotConfigured,
    #[error("discovery failed: {0}")]
    Discovery(String),
    #[error("the code exchange failed: {0}")]
    Exchange(String),
    #[error("the ID token is not valid: {0}")]
    IdToken(String),
}

#[derive(Debug, Clone)]
pub struct Authorization {
    pub url: String,
    pub state: String,
    pub nonce: String,
    pub pkce_verifier: String,
}

#[derive(Debug, Clone)]
pub struct ProviderIdentity {
    pub subject: String,
    pub email: Option<String>,
    pub email_verified: bool,
    pub name: Option<String>,
}

struct Cached {
    metadata: CoreProviderMetadata,
    fetched: Instant,
}

struct Provider {
    config: OidcProviderConfig,
    metadata: RwLock<Option<Cached>>,
}

#[derive(Clone)]
pub struct OidcProviders {
    http: reqwest::Client,
    providers: Arc<HashMap<OidcKind, Provider>>,
}

impl OidcProviders {
    pub fn new(configs: &[OidcProviderConfig]) -> Self {
        let http = reqwest::ClientBuilder::new()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(10))
            .build()
            .expect("the HTTP client builds");
        let providers = configs
            .iter()
            .map(|config| {
                (
                    config.kind,
                    Provider {
                        config: config.clone(),
                        metadata: RwLock::new(None),
                    },
                )
            })
            .collect();
        Self {
            http,
            providers: Arc::new(providers),
        }
    }

    pub fn kinds(&self) -> Vec<OidcKind> {
        let mut kinds: Vec<OidcKind> = self.providers.keys().copied().collect();
        kinds.sort_by_key(|kind| kind.as_str());
        kinds
    }

    pub fn is_configured(&self, kind: OidcKind) -> bool {
        self.providers.contains_key(&kind)
    }

    pub async fn authorize(
        &self,
        kind: OidcKind,
        redirect_url: &str,
    ) -> Result<Authorization, OidcError> {
        let client = self.client(kind, redirect_url, false).await?;
        let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
        let (url, state, nonce) = client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .add_scope(Scope::new("email".into()))
            .add_scope(Scope::new("profile".into()))
            .set_pkce_challenge(challenge)
            .url();
        Ok(Authorization {
            url: url.to_string(),
            state: state.secret().clone(),
            nonce: nonce.secret().clone(),
            pkce_verifier: verifier.secret().clone(),
        })
    }

    pub async fn exchange(
        &self,
        kind: OidcKind,
        redirect_url: &str,
        code: &str,
        pkce_verifier: &str,
        nonce: &str,
    ) -> Result<ProviderIdentity, OidcError> {
        match self
            .exchange_once(kind, redirect_url, code, pkce_verifier, nonce, false)
            .await
        {
            Err(OidcError::IdToken(_)) => {
                self.exchange_once(kind, redirect_url, code, pkce_verifier, nonce, true)
                    .await
            }
            other => other,
        }
    }

    async fn exchange_once(
        &self,
        kind: OidcKind,
        redirect_url: &str,
        code: &str,
        pkce_verifier: &str,
        nonce: &str,
        refresh: bool,
    ) -> Result<ProviderIdentity, OidcError> {
        let client = self.client(kind, redirect_url, refresh).await?;
        let response = client
            .exchange_code(AuthorizationCode::new(code.into()))
            .map_err(|error| OidcError::Exchange(error.to_string()))?
            .set_pkce_verifier(PkceCodeVerifier::new(pkce_verifier.into()))
            .request_async(&self.http)
            .await
            .map_err(|error| OidcError::Exchange(error.to_string()))?;
        let id_token = response
            .id_token()
            .ok_or_else(|| OidcError::IdToken("no ID token in the response".into()))?;
        let claims = id_token
            .claims(&client.id_token_verifier(), &Nonce::new(nonce.into()))
            .map_err(|error| OidcError::IdToken(error.to_string()))?;
        Ok(ProviderIdentity {
            subject: claims.subject().as_str().to_string(),
            email: claims.email().map(|email| email.as_str().to_string()),
            email_verified: claims.email_verified().unwrap_or(false),
            name: claims
                .name()
                .and_then(|name| name.get(None))
                .map(|name| name.as_str().to_string()),
        })
    }

    async fn client(
        &self,
        kind: OidcKind,
        redirect_url: &str,
        refresh: bool,
    ) -> Result<
        CoreClient<
            openidconnect::EndpointSet,
            openidconnect::EndpointNotSet,
            openidconnect::EndpointNotSet,
            openidconnect::EndpointNotSet,
            openidconnect::EndpointMaybeSet,
            openidconnect::EndpointMaybeSet,
        >,
        OidcError,
    > {
        let provider = self.providers.get(&kind).ok_or(OidcError::NotConfigured)?;
        let metadata = self.metadata(provider, refresh).await?;
        let redirect = RedirectUrl::new(redirect_url.into())
            .map_err(|error| OidcError::Discovery(error.to_string()))?;
        Ok(CoreClient::from_provider_metadata(
            metadata,
            ClientId::new(provider.config.client_id.clone()),
            Some(ClientSecret::new(
                provider.config.client_secret.expose().to_string(),
            )),
        )
        .set_redirect_uri(redirect))
    }

    async fn metadata(
        &self,
        provider: &Provider,
        refresh: bool,
    ) -> Result<CoreProviderMetadata, OidcError> {
        if !refresh
            && let Some(cached) = provider.metadata.read().await.as_ref()
            && cached.fetched.elapsed() < METADATA_TTL
        {
            return Ok(cached.metadata.clone());
        }
        let issuer = IssuerUrl::new(provider.config.issuer.clone())
            .map_err(|error| OidcError::Discovery(error.to_string()))?;
        let metadata = CoreProviderMetadata::discover_async(issuer, &self.http)
            .await
            .map_err(|error| OidcError::Discovery(error.to_string()))?;
        *provider.metadata.write().await = Some(Cached {
            metadata: metadata.clone(),
            fetched: Instant::now(),
        });
        Ok(metadata)
    }
}
