use std::path::PathBuf;

use thiserror::Error;
use url::Url;

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
        })
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
        ])
        .unwrap();
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
}
