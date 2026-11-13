use std::path::PathBuf;

use thiserror::Error;
use url::Url;

use crate::auth::{MIN_PASSWORD_LEN, hash_password, is_password_hash};
use crate::keys::MasterKey;
use crate::model::Signup;
use crate::oidc::{OidcKind, OidcProviderConfig};

const DEFAULT_BIND: &str = "0.0.0.0:3000";
const DEFAULT_DB_MAX_CONNECTIONS: u32 = 10;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),
    #[error("{name} is not a valid {expected}: {value}")]
    Invalid {
        name: &'static str,
        expected: &'static str,
        value: String,
    },
    #[error("{0}: {1}")]
    Unusable(&'static str, &'static str),
    #[error("set only one of {0} and {1}")]
    Both(&'static str, &'static str),
    #[error("{0} needs {1}")]
    Requires(&'static str, &'static str),
}

#[derive(Clone)]
pub struct Secret(String);

impl Secret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret([REDACTED])")
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: Secret,
    pub db_max_connections: u32,
    pub auto_migrate: bool,
    pub bind: String,
    pub app_url: String,
    pub cors_origins: Vec<String>,
    pub web_dir: Option<PathBuf>,
    pub signup: Signup,
    pub master_key: MasterKey,
    pub bootstrap: Option<Bootstrap>,
    pub oidc: Vec<OidcProviderConfig>,
}

#[derive(Debug, Clone)]
pub struct Bootstrap {
    pub email: String,
    pub password_hash: Secret,
    pub org_name: String,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|name| std::env::var(name).ok())
    }

    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let var = |name: &str| {
            lookup(name)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        };
        let required = |name: &'static str| var(name).ok_or(ConfigError::Missing(name));

        let app_url = parse_origin("FLEET_APP_URL", &required("FLEET_APP_URL")?)?;
        let cors_origins = match var("FLEET_CORS_ORIGINS") {
            Some(raw) => raw
                .split(',')
                .map(str::trim)
                .filter(|origin| !origin.is_empty())
                .map(|origin| parse_origin("FLEET_CORS_ORIGINS", origin))
                .collect::<Result<Vec<_>, _>>()?,
            None => Vec::new(),
        };

        Ok(Self {
            database_url: Secret::new(required("DATABASE_URL")?),
            db_max_connections: parse_positive(
                "FLEET_DB_MAX_CONNECTIONS",
                var("FLEET_DB_MAX_CONNECTIONS"),
                DEFAULT_DB_MAX_CONNECTIONS,
            )?,
            auto_migrate: parse_bool("FLEET_AUTO_MIGRATE", var("FLEET_AUTO_MIGRATE"), true)?,
            bind: var("FLEET_BIND").unwrap_or_else(|| DEFAULT_BIND.to_string()),
            app_url,
            cors_origins,
            web_dir: var("FLEET_WEB_DIR").map(PathBuf::from),
            signup: parse_signup(var("FLEET_SIGNUP"))?,
            master_key: MasterKey::parse(&required("FLEET_MASTER_KEY")?)
                .map_err(|error| ConfigError::Unusable("FLEET_MASTER_KEY", error.as_str()))?,
            bootstrap: parse_bootstrap(&var)?,
            oidc: parse_oidc(&var)?,
        })
    }
}

fn parse_oidc(
    var: &impl Fn(&str) -> Option<String>,
) -> Result<Vec<OidcProviderConfig>, ConfigError> {
    let mut providers = Vec::new();
    if let Some(client_id) = var("FLEET_GOOGLE_CLIENT_ID") {
        let secret = var("FLEET_GOOGLE_CLIENT_SECRET").ok_or(ConfigError::Requires(
            "FLEET_GOOGLE_CLIENT_ID",
            "FLEET_GOOGLE_CLIENT_SECRET",
        ))?;
        providers.push(OidcProviderConfig {
            kind: OidcKind::Google,
            issuer: "https://accounts.google.com".into(),
            client_id,
            client_secret: Secret::new(secret),
        });
    }
    if let Some(client_id) = var("FLEET_MICROSOFT_CLIENT_ID") {
        let secret = var("FLEET_MICROSOFT_CLIENT_SECRET").ok_or(ConfigError::Requires(
            "FLEET_MICROSOFT_CLIENT_ID",
            "FLEET_MICROSOFT_CLIENT_SECRET",
        ))?;
        let tenant = var("FLEET_MICROSOFT_TENANT").ok_or(ConfigError::Requires(
            "FLEET_MICROSOFT_CLIENT_ID",
            "FLEET_MICROSOFT_TENANT",
        ))?;
        let multi = ["common", "organizations", "consumers"];
        if multi.contains(&tenant.to_ascii_lowercase().as_str())
            || !tenant
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        {
            return Err(ConfigError::Unusable(
                "FLEET_MICROSOFT_TENANT",
                "must be one tenant's id or domain; multi-tenant sign-in is not supported",
            ));
        }
        providers.push(OidcProviderConfig {
            kind: OidcKind::Microsoft,
            issuer: format!("https://login.microsoftonline.com/{tenant}/v2.0"),
            client_id,
            client_secret: Secret::new(secret),
        });
    }
    Ok(providers)
}

fn parse_signup(raw: Option<String>) -> Result<Signup, ConfigError> {
    match raw.as_deref().map(str::to_ascii_lowercase).as_deref() {
        None | Some("invite") => Ok(Signup::Invite),
        Some("open") => Ok(Signup::Open),
        Some(_) => Err(ConfigError::Invalid {
            name: "FLEET_SIGNUP",
            expected: "sign-up mode, invite or open",
            value: raw.unwrap_or_default(),
        }),
    }
}

fn parse_bootstrap(
    var: &impl Fn(&str) -> Option<String>,
) -> Result<Option<Bootstrap>, ConfigError> {
    const EMAIL: &str = "FLEET_BOOTSTRAP_EMAIL";
    const PASSWORD: &str = "FLEET_BOOTSTRAP_PASSWORD";
    const HASH: &str = "FLEET_BOOTSTRAP_PASSWORD_HASH";
    let password_hash = match (var(PASSWORD), var(HASH)) {
        (Some(_), Some(_)) => return Err(ConfigError::Both(PASSWORD, HASH)),
        (Some(password), None) if password.chars().count() < MIN_PASSWORD_LEN => {
            return Err(ConfigError::Unusable(
                PASSWORD,
                "must be at least 10 characters",
            ));
        }
        (Some(password), None) => Some(hash_password(&password)),
        (None, Some(hash)) if !is_password_hash(&hash) => {
            return Err(ConfigError::Unusable(HASH, "must be an argon2 PHC string"));
        }
        (None, Some(hash)) => Some(hash),
        (None, None) => None,
    };
    match (var(EMAIL), password_hash) {
        (None, None) => Ok(None),
        (Some(_), None) => Err(ConfigError::Requires(EMAIL, PASSWORD)),
        (None, Some(_)) => Err(ConfigError::Requires(PASSWORD, EMAIL)),
        (Some(email), Some(hash)) if email.contains('@') => Ok(Some(Bootstrap {
            email,
            password_hash: Secret::new(hash),
            org_name: var("FLEET_BOOTSTRAP_ORG").unwrap_or_else(|| "Default".to_string()),
        })),
        (Some(email), Some(_)) => Err(ConfigError::Invalid {
            name: EMAIL,
            expected: "email address",
            value: email,
        }),
    }
}

fn parse_positive(
    name: &'static str,
    raw: Option<String>,
    default: u32,
) -> Result<u32, ConfigError> {
    let Some(raw) = raw else {
        return Ok(default);
    };
    raw.parse()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(ConfigError::Invalid {
            name,
            expected: "positive integer",
            value: raw,
        })
}

fn parse_bool(name: &'static str, raw: Option<String>, default: bool) -> Result<bool, ConfigError> {
    let Some(raw) = raw else {
        return Ok(default);
    };
    match raw.to_ascii_lowercase().as_str() {
        "true" | "1" => Ok(true),
        "false" | "0" => Ok(false),
        _ => Err(ConfigError::Invalid {
            name,
            expected: "boolean",
            value: raw,
        }),
    }
}

fn parse_origin(name: &'static str, raw: &str) -> Result<String, ConfigError> {
    let invalid = || ConfigError::Invalid {
        name,
        expected: "origin such as https://fleet.example.com",
        value: raw.to_string(),
    };
    let url = Url::parse(raw).map_err(|_| invalid())?;
    let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    let scheme_ok = match url.scheme() {
        "https" => true,
        "http" => loopback,
        _ => false,
    };
    if !scheme_ok || url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return Err(invalid());
    }
    Ok(url.origin().ascii_serialization())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    const MASTER_KEY: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    fn config(vars: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let vars: HashMap<String, String> = vars
            .iter()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect();
        Config::from_lookup(|name| vars.get(name).cloned())
    }

    #[test]
    fn defaults_apply_when_only_the_required_values_are_set() {
        let config = config(&[
            ("DATABASE_URL", "postgres://localhost/fleet"),
            ("FLEET_APP_URL", "http://localhost:5173"),
            ("FLEET_MASTER_KEY", MASTER_KEY),
        ])
        .unwrap();
        assert_eq!(config.signup, Signup::Invite);
        assert!(config.bootstrap.is_none());
        assert_eq!(config.bind, DEFAULT_BIND);
        assert_eq!(config.db_max_connections, DEFAULT_DB_MAX_CONNECTIONS);
        assert!(config.auto_migrate);
        assert_eq!(config.app_url, "http://localhost:5173");
        assert!(config.cors_origins.is_empty());
    }

    #[test]
    fn missing_values_name_the_variable() {
        let error = config(&[("FLEET_APP_URL", "https://fleet.example.com")]).unwrap_err();
        assert_eq!(error, ConfigError::Missing("DATABASE_URL"));
    }

    #[test]
    fn origins_need_https_unless_loopback_and_no_path() {
        assert_eq!(
            parse_origin("X", "https://fleet.example.com").unwrap(),
            "https://fleet.example.com"
        );
        assert!(parse_origin("X", "http://fleet.example.com").is_err());
        assert!(parse_origin("X", "https://fleet.example.com/app").is_err());
        assert!(parse_origin("X", "http://127.0.0.1:5173").is_ok());
    }

    #[test]
    fn numbers_and_flags_reject_garbage() {
        assert!(parse_positive("X", Some("0".into()), 1).is_err());
        assert!(parse_positive("X", Some("ten".into()), 1).is_err());
        assert_eq!(parse_positive("X", Some("4".into()), 1).unwrap(), 4);
        assert!(!parse_bool("X", Some("FALSE".into()), true).unwrap());
        assert!(parse_bool("X", Some("maybe".into()), true).is_err());
    }

    #[test]
    fn bootstrap_needs_an_email_and_exactly_one_password() {
        let base = [
            ("DATABASE_URL", "postgres://localhost/fleet"),
            ("FLEET_APP_URL", "http://localhost:5173"),
            ("FLEET_MASTER_KEY", MASTER_KEY),
        ];
        let with = |extra: &[(&'static str, &'static str)]| {
            let mut vars = base.to_vec();
            vars.extend_from_slice(extra);
            config(&vars)
        };
        let bootstrap = with(&[
            ("FLEET_BOOTSTRAP_EMAIL", "admin@example.com"),
            ("FLEET_BOOTSTRAP_PASSWORD", "a long enough password"),
        ])
        .unwrap()
        .bootstrap
        .unwrap();
        assert!(is_password_hash(bootstrap.password_hash.expose()));
        assert_eq!(bootstrap.org_name, "Default");
        assert_eq!(
            with(&[("FLEET_BOOTSTRAP_EMAIL", "admin@example.com")]).unwrap_err(),
            ConfigError::Requires("FLEET_BOOTSTRAP_EMAIL", "FLEET_BOOTSTRAP_PASSWORD")
        );
        assert!(matches!(
            with(&[
                ("FLEET_BOOTSTRAP_EMAIL", "admin@example.com"),
                ("FLEET_BOOTSTRAP_PASSWORD", "a long enough password"),
                (
                    "FLEET_BOOTSTRAP_PASSWORD_HASH",
                    "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA"
                ),
            ]),
            Err(ConfigError::Both(_, _))
        ));
        assert!(matches!(
            with(&[("FLEET_SIGNUP", "sometimes")]),
            Err(ConfigError::Invalid {
                name: "FLEET_SIGNUP",
                ..
            })
        ));
    }
}
