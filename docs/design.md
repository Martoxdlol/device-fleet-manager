# Design

A device fleet manager: an agent runs on Windows and Linux machines as SYSTEM or root, connects out to the server over the internet, reports what the machine is doing and runs what the server asks. Admins work in a web console. Self-hosted first; the same code must run as a hosted multi-tenant service later.

## Tenancy

- Organization > Fleet > Device.
- Org roles: `owner`, `admin`, `member`. Owners and admins have admin on every fleet.
- Fleet grants give a user or a group `read`, `write` or `admin` on a fleet.
  - `read`: inventory, telemetry, history.
  - `write`: run commands, terminals, edit devices.
  - `admin`: enrollment tokens, the fleet's key, fleet settings, removing devices.
- Groups are basic: an org's named list of members. A grant to a group applies to its members.
- Access is additive, no deny rules. Non-members and invisible resources answer 404.

## Data planes

As in Temblo, so the hosted service can shard later:

- Control plane: users, sessions, organizations, members, groups, agent keys, fleets, fleet grants.
- Fleet plane: devices and everything about them (telemetry, sessions, commands, events). Every key leads with `fleet_id`; foreign keys are composite; nothing references upward except `fleets`.

## Server

- Rust, axum, utoipa (OpenAPI from the routes), sqlx with runtime queries and embedded migrations, Postgres.
- `crates/fleet_lib`: config, database, migrations, repositories, models, auth, access, pagination.
- `crates/fleet_server`: HTTP handlers, error envelope, request ids, OpenAPI document, agent gateway.
- `packages/fleet_client`: TypeScript client generated from the OpenAPI document. `bun run codegen` regenerates both; a test fails when the committed document is stale.
- One container serves everything: the API under `/api`, `/health`, and the console for every other path (`FLEET_WEB_DIR`). The console calls the API on its own origin; in development Vite proxies `/api` to the server.
- API conventions follow Temblo's `docs/http-api.md`: `/api/v1`, uuid v7 ids in the API, slugs only in browser URLs, `{items, next_cursor}` pages, one JSON error envelope localized by `Accept-Language`.

## Accounts and login

- Providers are configured per installation: local accounts (argon2 password hashes, always on), Google and Microsoft (OIDC, on when configured).
- Local login answers the session token directly. Google and Microsoft follow Temblo's flow: the server finishes the provider login, hands the SPA a one-time code at `/auth/complete`, the SPA exchanges it for a bearer token with its PKCE verifier.
- Session tokens are 32 random bytes, stored as SHA-256. A session expires after 30 days without use; its expiry is pushed forward at most once an hour, in the same statement that resolves the request's access. Sessions are never tied to an org.
- Sign-up is a setting, `FLEET_SIGNUP`:
  - `invite` (default): accounts come only from invitations, the bootstrap and the setup link. Only instance admins create organizations.
  - `open`: anyone creates an account and organizations. For the hosted service.
- Instance admins run the installation: they create organizations in `invite` mode, list users, promote other instance admins and issue password reset links.
- Bootstrap, while the installation has no users:
  - With `FLEET_BOOTSTRAP_EMAIL` and `FLEET_BOOTSTRAP_PASSWORD` (or `FLEET_BOOTSTRAP_PASSWORD_HASH`, an argon2 PHC string), the first start creates that user as instance admin and an organization named `FLEET_BOOTSTRAP_ORG` (default `Default`) with the user as owner. Ignored once a user exists.
  - Otherwise the server stores a one-time setup token and logs a link to `/setup`. That page creates the first instance admin and organization. Every instance logs the same link; it stops working once a user exists.
- Email is optional. Without SMTP, admins copy links:
  - Invitations are per org and email, with a role and an expiry. The link opens a page where the invitee signs in (any provider, same email) or creates a local account for that email.
  - Password resets are links issued by instance admins only, since a user can belong to several orgs and an org admin must not take over an account used elsewhere. Using one ends the user's other sessions.
- Each organization gets a default agent key when it is created, so its first fleet has one to use.
- Later, for the hosted service: SMTP delivery of the same links, per-org SSO and email domain rules.

## Agent channel security

Goal: whoever controls DNS, or gets a certificate from any trusted CA, must not be able to control agents.

- HTTPS is its own layer with its own certificate (public CA, the operator's proxy, anything). It is never trusted for agent identity and shares no key with what follows.
- Agent keys belong to an organization: an org creates one or many X25519 key pairs, and each fleet chooses which one it uses. Private keys are stored encrypted under the server master key (`FLEET_MASTER_KEY`); the database alone cannot impersonate the server.
- An enrollment token carries the server URL, the fleet id, the fleet's key and a one-time secret. The agent pins the key at enrollment.
- Each agent creates its own X25519 key pair on first run. The private key never leaves the machine (file readable only by SYSTEM or root). The server stores only the public key.
- Inside the WebSocket, agent and server run a Noise `IK` handshake (`snow` crate): the agent already knows the key it pinned, the server learns and checks the agent key. Everything after the handshake is encrypted and authenticated end to end between the agent process and the server process, whatever terminates TLS in between.
- An attacker with a hijacked DNS name and a valid TLS certificate gets a TLS connection and nothing else: the handshake needs the private key.
- Changing keys: when a fleet switches to another key, or a device moves to a fleet with another key, the new public key is announced inside the channel, signed into it by the current one, and the agent uses it from its next connection. The old key stays valid for a grace period. Devices moving between fleets that share a key change nothing.
- Agent updates are signed with a separate release key, checked by the agent before installing.
- Losing the master key makes every agent key unusable and every agent must enroll again. Back it up.
- Not covered: an attacker who takes over the server itself. A later option is commands signed by an admin's passkey, checked by the agent against an admin list signed by its key.

## Server instances

The basics of Tenure, nothing more: membership, leases with fencing, routing between instances.

- An instance (worker) joins with a row of its own, an incarnation and its internal address, and renews its membership with a heartbeat. A worker that misses its membership is lost and every lease it held is invalid.
- A device's lease belongs to the worker holding its agent connection. Connecting takes the lease with a new epoch; writes about the device's live state are fenced by that epoch. The previous connection, on any worker, is closed.
- A request for a device (a command, a terminal) goes to the worker holding its lease, over HTTP/2 between workers. No lease, or a lost holder, means the device is offline.
- Commands for offline devices stay in the database as pending, with an expiry, and are dispatched by the worker that takes the device's lease when it connects.
- Live updates to the console are SSE. The worker serving a console stream subscribes to the workers that hold the devices it shows.
- A self-hosted installation runs one worker with the same code.
- Not taken from Tenure: actor logs, placement rules, committed messages, spreading, takeovers. Agents reconnect on their own when a worker is lost.

## Agent

- One Rust binary. Windows service as LocalSystem, systemd unit as root. Linux builds are static (musl).
- Telemetry: hardware and OS inventory, logged-in users and sessions (event driven: WTS session change events on Windows, logind on Linux), battery, network interfaces and Wi-Fi, CPU, memory, disks.
- Only changes are written right away. Periodic samples are batched into a history with a retention limit. Heartbeats do not write to the database.
- Commands run as SYSTEM or root, with output streamed and the whole process tree killed on timeout or cancel. Output is captured to files, not pipes (a detached grandchild holding a pipe hangs the command).
- Running as another user: the logged-in user's session token on Windows, uid switch on Linux. Users who are not logged in (Windows S4U logon) are a later step.

## Agent protocol

- Messages inside the encrypted channel: JSON for control, binary frames for output and terminal streams.
- A message is never renamed or removed once shipped. Fields are only added, as optional. Unknown messages are ignored.
- The agent reports its capabilities when it connects, so the console disables what a build cannot do.

## Open

- Hosted service: per-org SSO, billing, limits.
- Server compromise protection (admin-signed commands).
- Remote desktop.
