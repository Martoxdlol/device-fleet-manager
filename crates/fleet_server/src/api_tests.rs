use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::{Method, Request, StatusCode, header};
use fleet_lib::AppContext;
use fleet_lib::config::{Bootstrap, Secret};
use fleet_lib::model::Signup;
use fleet_lib::repo::accounts::BootstrapOutcome;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

use crate::tests::test_master_key;
use crate::{AppState, app};

const PASSWORD: &str = "a long enough password";

struct Api {
    app: Router,
    ctx: AppContext,
}

impl Api {
    fn new(pool: PgPool, signup: Signup) -> Self {
        let ctx = AppContext::new(pool.clone(), test_master_key(), signup);
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

    async fn call(
        &self,
        method: Method,
        path: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let mut request = Request::builder()
            .method(method)
            .uri(format!("/api/v1{path}"));
        if let Some(token) = token {
            request = request.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        let request = match body {
            Some(body) => request
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string())),
            None => request.body(Body::empty()),
        }
        .unwrap();
        let response = self.app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let value = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).unwrap()
        };
        (status, value)
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
