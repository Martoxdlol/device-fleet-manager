use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::{Method, Request, StatusCode, header};
use fleet_lib::AppContext;
use fleet_lib::config::{Bootstrap, Secret};
use fleet_lib::model::Signup;
use fleet_lib::oidc::OidcProviders;
use fleet_lib::repo::accounts::BootstrapOutcome;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

use crate::tests::test_master_key;
use crate::{AppState, app};

const PASSWORD: &str = "a long enough password";

async fn body_json(response: axum::response::Response) -> Value {
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    }
}

struct Api {
    app: Router,
    ctx: AppContext,
}

impl Api {
    fn new(pool: PgPool, signup: Signup) -> Self {
        Self::with_oidc(pool, signup, OidcProviders::new(&[]))
    }

    fn with_oidc(pool: PgPool, signup: Signup, oidc: OidcProviders) -> Self {
        let ctx = AppContext::new(pool.clone(), test_master_key(), signup, oidc);
        let state = AppState {
            db: pool,
            ctx: ctx.clone(),
            app_url: "http://localhost:5173".into(),
        };
        Self {
            app: app(state, None, None),
            ctx,
        }
    }

    async fn raw(
        &self,
        method: Method,
        uri: &str,
        token: Option<&str>,
        cookie: Option<&str>,
        body: Option<Value>,
    ) -> axum::response::Response {
        let mut request = Request::builder().method(method).uri(uri);
        if let Some(token) = token {
            request = request.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        let request = match body {
            Some(body) => request
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string())),
            None => request.body(Body::empty()),
        }
        .unwrap();
        self.app.clone().oneshot(request).await.unwrap()
    }

    async fn call(
        &self,
        method: Method,
        path: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let response = self
            .raw(method, &format!("/api/v1{path}"), token, None, body)
            .await;
        (response.status(), body_json(response).await)
    }

    async fn get(&self, path: &str, token: &str) -> (StatusCode, Value) {
        self.call(Method::GET, path, Some(token), None).await
    }

    async fn post(&self, path: &str, token: Option<&str>, body: Value) -> (StatusCode, Value) {
        self.call(Method::POST, path, token, Some(body)).await
    }

    async fn patch(&self, path: &str, token: &str, body: Value) -> (StatusCode, Value) {
        self.call(Method::PATCH, path, Some(token), Some(body))
            .await
    }

    async fn delete(&self, path: &str, token: &str) -> StatusCode {
        self.call(Method::DELETE, path, Some(token), None).await.0
    }

    async fn bootstrapped(&self) -> (String, String) {
        let bootstrap = Bootstrap {
            email: "admin@example.com".into(),
            password_hash: Secret::new(fleet_lib::auth::hash_password(PASSWORD)),
            org_name: "Acme".into(),
        };
        let outcome = self
            .ctx
            .repos
            .accounts
            .bootstrap(Some(&bootstrap), &self.ctx.master_key)
            .await
            .unwrap();
        assert!(matches!(outcome, BootstrapOutcome::Created { .. }));
        let token = self.login("admin@example.com").await;
        let (_, orgs) = self.get("/orgs", &token).await;
        (token, orgs["items"][0]["id"].as_str().unwrap().to_string())
    }

    async fn login(&self, email: &str) -> String {
        let (status, session) = self
            .post(
                "/auth/login",
                None,
                json!({"email": email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{session}");
        session["token"].as_str().unwrap().to_string()
    }

    async fn invite_and_join(
        &self,
        admin: &str,
        org: &str,
        email: &str,
        role: &str,
    ) -> (String, String) {
        let (status, invitation) = self
            .post(
                &format!("/orgs/{org}/invitations"),
                Some(admin),
                json!({"email": email, "role": role}),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{invitation}");
        let link = invitation["token"].as_str().unwrap();
        let (status, joined) = self
            .post(
                &format!("/invitations/{link}/signup"),
                None,
                json!({"name": email.split('@').next().unwrap(), "password": PASSWORD}),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{joined}");
        (
            joined["token"].as_str().unwrap().to_string(),
            joined["user"]["id"].as_str().unwrap().to_string(),
        )
    }
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn the_setup_link_creates_the_first_admin_once(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let BootstrapOutcome::SetupToken(setup) = api
        .ctx
        .repos
        .accounts
        .bootstrap(None, &api.ctx.master_key)
        .await
        .unwrap()
    else {
        panic!("expected a setup token");
    };
    let BootstrapOutcome::SetupToken(again) = api
        .ctx
        .repos
        .accounts
        .bootstrap(None, &api.ctx.master_key)
        .await
        .unwrap()
    else {
        panic!("expected the same setup token");
    };
    assert_eq!(setup, again);
    let (_, instance) = api.call(Method::GET, "/instance", None, None).await;
    assert_eq!(instance["setup_required"], true);
    assert_eq!(instance["signup"], "invite");

    let body = |token: &str| {
        json!({
            "token": token, "email": "owner@example.com", "name": "Owner",
            "password": PASSWORD, "org_name": "Acme", "org_slug": "acme",
        })
    };
    let (status, _) = api.post("/setup", None, body("wrong")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, created) = api.post("/setup", None, body(&setup)).await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    assert_eq!(created["user"]["instance_admin"], true);
    assert_eq!(created["org"]["slug"], "acme");
    let token = created["token"].as_str().unwrap();
    let (status, me) = api.get("/me", token).await;
    assert_eq!(
        (status, me["email"].as_str()),
        (StatusCode::OK, Some("owner@example.com"))
    );

    let (status, _) = api.post("/setup", None, body(&setup)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (_, instance) = api.call(Method::GET, "/instance", None, None).await;
    assert_eq!(instance["setup_required"], false);
    assert!(matches!(
        api.ctx
            .repos
            .accounts
            .bootstrap(None, &api.ctx.master_key)
            .await
            .unwrap(),
        BootstrapOutcome::Existing
    ));
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn invite_mode_creates_accounts_only_from_invitations(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (admin, org) = api.bootstrapped().await;
    let (status, keys) = api.get(&format!("/orgs/{org}/agent-keys"), &admin).await;
    assert_eq!(
        (status, keys["items"][0]["name"].as_str()),
        (StatusCode::OK, Some("Default"))
    );

    let (status, _) = api
        .post(
            "/auth/signup",
            None,
            json!({"email": "x@example.com", "name": "X", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, invitation) = api
        .post(
            &format!("/orgs/{org}/invitations"),
            Some(&admin),
            json!({"email": "Ana@Example.com", "role": "member"}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let link = invitation["token"].as_str().unwrap();
    let (status, preview) = api
        .call(Method::GET, &format!("/invitations/{link}"), None, None)
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        (
            preview["org_name"].as_str(),
            preview["account_exists"].as_bool()
        ),
        (Some("Acme"), Some(false))
    );
    let (status, joined) = api
        .post(
            &format!("/invitations/{link}/signup"),
            None,
            json!({"name": "Ana", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{joined}");
    let ana = joined["token"].as_str().unwrap();
    let (status, _) = api
        .post(
            &format!("/invitations/{link}/signup"),
            None,
            json!({"name": "Ana", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, _) = api
        .post("/orgs", Some(ana), json!({"name": "Mine", "slug": "mine"}))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = api
        .post(
            "/orgs",
            Some(&admin),
            json!({"name": "Second", "slug": "second"}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, error) = api
        .post(
            "/orgs",
            Some(&admin),
            json!({"name": "Login", "slug": "login"}),
        )
        .await;
    assert_eq!(
        (status, error["details"][0]["code"].as_str()),
        (StatusCode::BAD_REQUEST, Some("reserved"))
    );

    let (status, _) = api
        .post(
            &format!("/orgs/{org}/invitations"),
            Some(&admin),
            json!({"email": "ana@example.com", "role": "member"}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn invitations_only_join_the_account_with_their_email(pool: PgPool) {
    let api = Api::new(pool, Signup::Open);
    let (admin, org) = api.bootstrapped().await;
    let (status, bob) = api
        .post(
            "/auth/signup",
            None,
            json!({"email": "bob@example.com", "name": "Bob", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let bob = bob["token"].as_str().unwrap();
    let (status, _) = api
        .post(
            "/auth/signup",
            None,
            json!({"email": "BOB@example.com", "name": "Bob", "password": PASSWORD}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (_, invitation) = api
        .post(
            &format!("/orgs/{org}/invitations"),
            Some(&admin),
            json!({"email": "carol@example.com", "role": "admin"}),
        )
        .await;
    let link = invitation["token"].as_str().unwrap();
    let (status, _) = api
        .post(&format!("/invitations/{link}/accept"), Some(bob), json!({}))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (_, invitation) = api
        .post(
            &format!("/orgs/{org}/invitations"),
            Some(&admin),
            json!({"email": "bob@example.com", "role": "admin"}),
        )
        .await;
    let link = invitation["token"].as_str().unwrap();
    let (status, joined) = api
        .post(&format!("/invitations/{link}/accept"), Some(bob), json!({}))
        .await;
    assert_eq!(
        (status, joined["id"].as_str()),
        (StatusCode::OK, Some(org.as_str()))
    );
    let (_, orgs) = api.get("/orgs", bob).await;
    assert_eq!(orgs["items"][0]["role"], "admin");

    let (status, _) = api
        .post(
            "/orgs",
            Some(bob),
            json!({"name": "Bob Co", "slug": "bob-co"}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn fleet_access_follows_roles_and_grants(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (admin, org) = api.bootstrapped().await;
    let (member, member_id) = api
        .invite_and_join(&admin, &org, "member@example.com", "member")
        .await;

    let (status, fleet) = api
        .post(
            &format!("/orgs/{org}/fleets"),
            Some(&admin),
            json!({"name": "Lab", "slug": "lab"}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{fleet}");
    let fleet_id = fleet["id"].as_str().unwrap();
    let (status, _) = api
        .post(
            &format!("/orgs/{org}/fleets"),
            Some(&member),
            json!({"name": "Mine", "slug": "mine"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (_, fleets) = api.get(&format!("/orgs/{org}/fleets"), &member).await;
    assert_eq!(fleets["items"].as_array().unwrap().len(), 0);
    let (status, _) = api.get(&format!("/fleets/{fleet_id}"), &member).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = api.get("/resolve?org=acme&fleet=lab", &member).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (_, group) = api
        .post(
            &format!("/orgs/{org}/groups"),
            Some(&admin),
            json!({"name": "Techs"}),
        )
        .await;
    let group_id = group["id"].as_str().unwrap();
    let (status, added) = api
        .post(
            &format!("/orgs/{org}/groups/{group_id}/members"),
            Some(&admin),
            json!({"user_ids": [member_id]}),
        )
        .await;
    assert_eq!((status, added["added"].as_i64()), (StatusCode::OK, Some(1)));
    let (status, grant) = api
        .post(
            &format!("/fleets/{fleet_id}/grants"),
            Some(&admin),
            json!({"group_id": group_id, "level": "read"}),
        )
        .await;
    assert_eq!(
        (status, grant["subject_name"].as_str()),
        (StatusCode::CREATED, Some("Techs"))
    );

    let (_, fleets) = api.get(&format!("/orgs/{org}/fleets"), &member).await;
    assert_eq!(fleets["items"][0]["access"], "read");
    let (status, resolved) = api.get("/resolve?org=acme&fleet=lab", &member).await;
    assert_eq!(
        (status, resolved["fleet_id"].as_str()),
        (StatusCode::OK, Some(fleet_id))
    );
    let (status, _) = api
        .patch(
            &format!("/fleets/{fleet_id}"),
            &member,
            json!({"name": "Renamed"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let (status, _) = api
        .post(
            &format!("/fleets/{fleet_id}/grants"),
            Some(&admin),
            json!({"user_id": member_id, "level": "admin"}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, fleet) = api.get(&format!("/fleets/{fleet_id}"), &member).await;
    assert_eq!(
        (status, fleet["access"].as_str()),
        (StatusCode::OK, Some("admin"))
    );
    let (status, renamed) = api
        .patch(
            &format!("/fleets/{fleet_id}"),
            &member,
            json!({"name": "Renamed"}),
        )
        .await;
    assert_eq!(
        (status, renamed["name"].as_str()),
        (StatusCode::OK, Some("Renamed"))
    );

    let (_, outsider) = api
        .post(
            "/orgs",
            Some(&admin),
            json!({"name": "Other", "slug": "other"}),
        )
        .await;
    let outsider_org = outsider["id"].as_str().unwrap();
    let (stranger, _) = api
        .invite_and_join(&admin, outsider_org, "stranger@example.com", "member")
        .await;
    let (status, _) = api.get(&format!("/fleets/{fleet_id}"), &stranger).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = api.get(&format!("/orgs/{org}/members"), &stranger).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = api
        .post(
            &format!("/fleets/{fleet_id}/grants"),
            Some(&admin),
            json!({"user_id": member_id, "group_id": group_id, "level": "read"}),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn owners_are_protected(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (owner, org) = api.bootstrapped().await;
    let (_, me) = api.get("/me", &owner).await;
    let owner_id = me["id"].as_str().unwrap().to_string();
    let (admin, admin_id) = api
        .invite_and_join(&owner, &org, "second@example.com", "admin")
        .await;

    assert_eq!(
        api.delete(&format!("/orgs/{org}/members/{owner_id}"), &owner)
            .await,
        StatusCode::CONFLICT
    );
    let (status, _) = api
        .patch(
            &format!("/orgs/{org}/members/{owner_id}"),
            &owner,
            json!({"role": "member"}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, _) = api
        .patch(
            &format!("/orgs/{org}/members/{owner_id}"),
            &admin,
            json!({"role": "member"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = api
        .patch(
            &format!("/orgs/{org}/members/{admin_id}"),
            &admin,
            json!({"role": "owner"}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(
        api.delete(&format!("/orgs/{org}"), &admin).await,
        StatusCode::FORBIDDEN
    );

    let (status, promoted) = api
        .patch(
            &format!("/orgs/{org}/members/{admin_id}"),
            &owner,
            json!({"role": "owner"}),
        )
        .await;
    assert_eq!(
        (status, promoted["role"].as_str()),
        (StatusCode::OK, Some("owner"))
    );
    assert_eq!(
        api.delete(&format!("/orgs/{org}/members/{owner_id}"), &owner)
            .await,
        StatusCode::NO_CONTENT
    );
    let (status, _) = api.get(&format!("/orgs/{org}"), &owner).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn keys_used_by_fleets_cannot_be_deleted(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (admin, org) = api.bootstrapped().await;
    let (_, spare) = api
        .post(
            &format!("/orgs/{org}/agent-keys"),
            Some(&admin),
            json!({"name": "Spare"}),
        )
        .await;
    let spare_id = spare["id"].as_str().unwrap();
    assert_eq!(spare["public_key"].as_str().unwrap().len(), 43);
    let (_, fleet) = api
        .post(
            &format!("/orgs/{org}/fleets"),
            Some(&admin),
            json!({"name": "Lab", "slug": "lab", "agent_key_id": spare_id}),
        )
        .await;
    assert_eq!(fleet["agent_key_id"].as_str(), Some(spare_id));
    assert_eq!(
        api.delete(&format!("/orgs/{org}/agent-keys/{spare_id}"), &admin)
            .await,
        StatusCode::CONFLICT
    );

    let (_, keys) = api.get(&format!("/orgs/{org}/agent-keys"), &admin).await;
    let default_id = keys["items"][0]["id"].as_str().unwrap();
    let fleet_id = fleet["id"].as_str().unwrap();
    let (status, _) = api
        .patch(
            &format!("/fleets/{fleet_id}"),
            &admin,
            json!({"agent_key_id": default_id}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        api.delete(&format!("/orgs/{org}/agent-keys/{spare_id}"), &admin)
            .await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        api.delete(&format!("/orgs/{org}/agent-keys/{spare_id}"), &admin)
            .await,
        StatusCode::NOT_FOUND
    );

    let (_, other) = api
        .post(
            "/orgs",
            Some(&admin),
            json!({"name": "Other", "slug": "other"}),
        )
        .await;
    let (_, other_keys) = api
        .get(
            &format!("/orgs/{}/agent-keys", other["id"].as_str().unwrap()),
            &admin,
        )
        .await;
    let foreign = other_keys["items"][0]["id"].as_str().unwrap();
    let (status, _) = api
        .patch(
            &format!("/fleets/{fleet_id}"),
            &admin,
            json!({"agent_key_id": foreign}),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn reset_links_replace_the_password_and_end_sessions(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (admin, org) = api.bootstrapped().await;
    let (member, member_id) = api
        .invite_and_join(&admin, &org, "member@example.com", "member")
        .await;

    let (status, _) = api
        .post(
            &format!("/admin/users/{member_id}/password-reset"),
            Some(&member),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, reset) = api
        .post(
            &format!("/admin/users/{member_id}/password-reset"),
            Some(&admin),
            json!({}),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let link = reset["token"].as_str().unwrap();
    let (status, session) = api
        .post(
            "/auth/password-reset",
            None,
            json!({"token": link, "password": "another long password"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = api.get("/me", &member).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _) = api.get("/me", session["token"].as_str().unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = api
        .post(
            "/auth/login",
            None,
            json!({"email": "member@example.com", "password": "another long password"}),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = api
        .post(
            "/auth/password-reset",
            None,
            json!({"token": link, "password": "a third long password"}),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (_, me) = api.get("/me", &admin).await;
    let admin_id = me["id"].as_str().unwrap();
    let (status, _) = api
        .patch(
            &format!("/admin/users/{admin_id}"),
            &admin,
            json!({"instance_admin": false}),
        )
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
async fn member_lists_page_and_search(pool: PgPool) {
    let api = Api::new(pool, Signup::Invite);
    let (admin, org) = api.bootstrapped().await;
    for name in ["ana", "bruno", "carla"] {
        api.invite_and_join(&admin, &org, &format!("{name}@example.com"), "member")
            .await;
    }
    let mut seen = Vec::new();
    let mut cursor: Option<String> = None;
    loop {
        let path = match &cursor {
            Some(cursor) => format!("/orgs/{org}/members?limit=1&cursor={cursor}"),
            None => format!("/orgs/{org}/members?limit=1"),
        };
        let (status, page) = api.get(&path, &admin).await;
        assert_eq!(status, StatusCode::OK, "{page}");
        seen.extend(
            page["items"]
                .as_array()
                .unwrap()
                .iter()
                .map(|m| m["email"].as_str().unwrap().to_string()),
        );
        match page["next_cursor"].as_str() {
            Some(next) => cursor = Some(next.to_string()),
            None => break,
        }
    }
    assert_eq!(seen.len(), 4);
    let (status, found) = api.get(&format!("/orgs/{org}/members?q=BRU"), &admin).await;
    assert_eq!(status, StatusCode::OK, "{found}");
    assert_eq!(found["items"].as_array().unwrap().len(), 1);
    assert_eq!(found["items"][0]["name"], "bruno");
    let (status, error) = api
        .get(&format!("/orgs/{org}/members?cursor=garbage"), &admin)
        .await;
    assert_eq!(
        (status, error["error"].as_str()),
        (StatusCode::BAD_REQUEST, Some("invalid_cursor"))
    );
}

mod oidc {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use axum::extract::{Form, State};
    use axum::http::Method;
    use axum::routing::{get, post};
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use fleet_lib::config::Secret;
    use fleet_lib::model::Signup;
    use fleet_lib::oidc::{OidcKind, OidcProviderConfig, OidcProviders};
    use jsonwebtoken::{Algorithm, EncodingKey, Header};
    use serde_json::{Value, json};
    use sha2::{Digest, Sha256};
    use sqlx::PgPool;

    use super::{Api, PASSWORD};

    const KEY_PEM: &str = include_str!("../tests_data/oidc_test_key.pem");
    const KEY_N: &str = include_str!("../tests_data/oidc_test_key.n");
    const VERIFIER: &str = "a-pkce-verifier-that-is-long-enough-to-be-valid-0123456789";

    #[derive(Clone)]
    struct Person {
        subject: &'static str,
        email: &'static str,
        verified: bool,
    }

    #[derive(Clone, Default)]
    struct Provider {
        issuer: String,
        codes: Arc<Mutex<HashMap<String, (Person, String)>>>,
    }

    async fn start_provider() -> Provider {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let provider = Provider {
            issuer: format!("http://{}", listener.local_addr().unwrap()),
            codes: Arc::default(),
        };
        let app = axum::Router::new()
            .route("/.well-known/openid-configuration", get(discovery))
            .route("/jwks", get(jwks))
            .route("/token", post(token))
            .with_state(provider.clone());
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        provider
    }

    async fn discovery(State(provider): State<Provider>) -> axum::Json<Value> {
        let issuer = &provider.issuer;
        axum::Json(json!({
            "issuer": issuer,
            "authorization_endpoint": format!("{issuer}/authorize"),
            "token_endpoint": format!("{issuer}/token"),
            "jwks_uri": format!("{issuer}/jwks"),
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
        }))
    }

    async fn jwks() -> axum::Json<Value> {
        axum::Json(json!({"keys": [{
            "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "test",
            "n": KEY_N.trim(), "e": "AQAB",
        }]}))
    }

    async fn token(
        State(provider): State<Provider>,
        Form(form): Form<HashMap<String, String>>,
    ) -> axum::Json<Value> {
        let (person, nonce) = provider
            .codes
            .lock()
            .unwrap()
            .remove(&form["code"])
            .expect("a code the test issued");
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        let claims = json!({
            "iss": provider.issuer, "sub": person.subject, "aud": "client",
            "iat": now, "exp": now + 300, "nonce": nonce,
            "email": person.email, "email_verified": person.verified, "name": "Provider Name",
        });
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some("test".into());
        let id_token = jsonwebtoken::encode(
            &header,
            &claims,
            &EncodingKey::from_rsa_pem(KEY_PEM.as_bytes()).unwrap(),
        )
        .unwrap();
        axum::Json(json!({
            "access_token": "access", "token_type": "Bearer", "expires_in": 300, "id_token": id_token,
        }))
    }

    fn api(pool: PgPool, signup: Signup, provider: &Provider) -> Api {
        Api::with_oidc(
            pool,
            signup,
            OidcProviders::new(&[OidcProviderConfig {
                kind: OidcKind::Google,
                issuer: provider.issuer.clone(),
                client_id: "client".into(),
                client_secret: Secret::new("secret"),
            }]),
        )
    }

    fn challenge(verifier: &str) -> String {
        URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
    }

    async fn sign_in(
        api: &Api,
        provider: &Provider,
        person: Person,
        bearer: Option<&str>,
        invitation: Option<&str>,
    ) -> Result<String, String> {
        let mut body = json!({"code_challenge": challenge(VERIFIER), "return_to": "/acme"});
        if let Some(invitation) = invitation {
            body["invitation"] = json!(invitation);
        }
        let response = api
            .raw(
                Method::POST,
                "/api/v1/auth/oidc/google/start",
                bearer,
                None,
                Some(body),
            )
            .await;
        assert_eq!(response.status(), 200);
        let cookie = response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .split(';')
            .next()
            .unwrap()
            .to_string();
        let started: Value = super::body_json(response).await;
        let url = url::Url::parse(started["url"].as_str().unwrap()).unwrap();
        let query: HashMap<String, String> = url.query_pairs().into_owned().collect();
        assert_eq!(query["code_challenge_method"], "S256");
        let code = format!("code-{}", uuid::Uuid::now_v7());
        provider
            .codes
            .lock()
            .unwrap()
            .insert(code.clone(), (person, query["nonce"].clone()));
        let callback = format!(
            "/api/v1/auth/oidc/google/callback?code={code}&state={}",
            query["state"]
        );
        let response = api
            .raw(Method::GET, &callback, None, Some(&cookie), None)
            .await;
        assert_eq!(response.status(), 303);
        let location = url::Url::parse(response.headers()["location"].to_str().unwrap()).unwrap();
        assert_eq!(location.path(), "/auth/complete");
        let params: HashMap<String, String> = location.query_pairs().into_owned().collect();
        if let Some(error) = params.get("error") {
            return Err(error.clone());
        }
        assert_eq!(params["return_to"], "/acme");
        let (status, session) = api
            .post(
                "/auth/exchange",
                None,
                json!({"code": params["code"], "code_verifier": VERIFIER}),
            )
            .await;
        assert_eq!(status, 200, "{session}");
        let (status, _) = api
            .post(
                "/auth/exchange",
                None,
                json!({"code": params["code"], "code_verifier": "the wrong verifier for this code 0123456789"}),
            )
            .await;
        assert_eq!(status, 400);
        Ok(session["token"].as_str().unwrap().to_string())
    }

    const EVE: Person = Person {
        subject: "eve-subject",
        email: "eve.personal@example.org",
        verified: true,
    };

    #[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
    async fn invite_mode_signs_in_only_known_or_invited_identities(pool: PgPool) {
        let provider = start_provider().await;
        let api = api(pool, Signup::Invite, &provider);
        let (admin, org) = api.bootstrapped().await;
        let (_, instance) = api.call(Method::GET, "/instance", None, None).await;
        assert_eq!(instance["providers"], json!(["password", "google"]));

        assert_eq!(
            sign_in(&api, &provider, EVE, None, None).await.unwrap_err(),
            "no_account"
        );

        let (_, invitation) = api
            .post(
                &format!("/orgs/{org}/invitations"),
                Some(&admin),
                json!({"email": "eve@corp.example", "role": "member"}),
            )
            .await;
        let link = invitation["token"].as_str().unwrap();
        let eve = sign_in(&api, &provider, EVE, None, Some(link))
            .await
            .unwrap();
        let (_, me) = api.get("/me", &eve).await;
        assert_eq!(
            (me["email"].as_str(), me["name"].as_str()),
            (Some("eve@corp.example"), Some("Provider Name"))
        );
        let (_, orgs) = api.get("/orgs", &eve).await;
        assert_eq!(orgs["items"][0]["id"].as_str(), Some(org.as_str()));
        assert_eq!(
            sign_in(&api, &provider, EVE, None, Some(link))
                .await
                .map(|_| ()),
            Ok(()),
            "a known identity signs in whatever the invitation says"
        );
        let again = sign_in(&api, &provider, EVE, None, None).await.unwrap();
        let (_, me_again) = api.get("/me", &again).await;
        assert_eq!(me_again["id"], me["id"]);

        let (status, _) = api
            .call(Method::DELETE, "/me/identities/google", Some(&again), None)
            .await;
        assert_eq!(status, 409, "the only way to sign in stays");

        let (_, invitation) = api
            .post(
                &format!("/orgs/{org}/invitations"),
                Some(&admin),
                json!({"email": "admin@example.com", "role": "member"}),
            )
            .await;
        assert_eq!(invitation["error"], "conflict");
        let stale = api
            .raw(
                Method::GET,
                "/api/v1/auth/oidc/google/callback?code=x&state=forged",
                None,
                None,
                None,
            )
            .await;
        assert!(
            stale.headers()["location"]
                .to_str()
                .unwrap()
                .ends_with("error=state_invalid")
        );
    }

    #[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
    async fn identities_link_to_the_signed_in_account_only(pool: PgPool) {
        let provider = start_provider().await;
        let api = api(pool, Signup::Invite, &provider);
        let (admin, org) = api.bootstrapped().await;
        let linked = sign_in(&api, &provider, EVE, Some(&admin), None)
            .await
            .unwrap();
        let (_, me) = api.get("/me", &linked).await;
        assert_eq!(me["email"], "admin@example.com");
        let (_, identities) = api.get("/me/identities", &admin).await;
        assert_eq!(identities[0]["provider"], "google");
        assert_eq!(identities[0]["email"], EVE.email);

        let (member, _) = api
            .invite_and_join(&admin, &org, "member@example.com", "member")
            .await;
        assert_eq!(
            sign_in(&api, &provider, EVE, Some(&member), None)
                .await
                .unwrap_err(),
            "identity_taken"
        );
        let other = Person {
            subject: "other-subject",
            ..EVE
        };
        assert_eq!(
            sign_in(&api, &provider, other, Some(&admin), None)
                .await
                .unwrap_err(),
            "provider_already_linked"
        );

        let (status, _) = api
            .call(Method::DELETE, "/me/identities/google", Some(&admin), None)
            .await;
        assert_eq!(status, 204);
        let (status, _) = api
            .call(Method::DELETE, "/me/identities/google", Some(&admin), None)
            .await;
        assert_eq!(status, 404);
        assert_eq!(
            sign_in(&api, &provider, EVE, None, None).await.unwrap_err(),
            "no_account"
        );
    }

    #[sqlx::test(migrator = "fleet_lib::db::MIGRATOR")]
    async fn open_sign_up_needs_a_verified_free_email(pool: PgPool) {
        let provider = start_provider().await;
        let api = api(pool, Signup::Open, &provider);
        api.bootstrapped().await;
        let unverified = Person {
            verified: false,
            ..EVE
        };
        assert_eq!(
            sign_in(&api, &provider, unverified, None, None)
                .await
                .unwrap_err(),
            "email_unverified"
        );
        let taken = Person {
            subject: "taken",
            email: "admin@example.com",
            verified: true,
        };
        assert_eq!(
            sign_in(&api, &provider, taken, None, None)
                .await
                .unwrap_err(),
            "email_taken"
        );
        let token = sign_in(&api, &provider, EVE, None, None).await.unwrap();
        let (_, me) = api.get("/me", &token).await;
        assert_eq!(me["email"], EVE.email);
        let (status, _) = api
            .post(
                "/auth/login",
                None,
                json!({"email": EVE.email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(status, 401);
    }
}
