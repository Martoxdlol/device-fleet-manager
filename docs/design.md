# Design

A device fleet manager: an agent runs on Windows and Linux machines as SYSTEM or root, connects out to the server over the internet, reports what the machine is doing and runs what the server asks. Admins work in a web console. Self-hosted first; the same code must run as a hosted multi-tenant service later.

## Tenancy

- Organization > Fleet > Device.
- Org roles: `owner`, `admin`, `member`. Owners and admins have admin on every fleet.
- Members get access per fleet, directly or through groups. Levels: `view < operate < admin`.
  - `view`: inventory, telemetry, history.
  - `operate`: run commands, terminals.
  - `admin`: enrollment tokens, fleet settings, removing devices.
- Access is additive, no deny rules. Non-members and invisible resources answer 404.

## Data planes

As in Temblo, so the hosted service can shard later:

- Control plane: users, sessions, organizations, members, groups, fleets, fleet grants.
- Fleet plane: devices and everything about them (telemetry, sessions, commands, events). Every key leads with `fleet_id`; foreign keys are composite; nothing references upward except `fleets`.

## Server

- Rust, axum, utoipa (OpenAPI from the routes), sqlx with runtime queries and embedded migrations, Postgres.
- `crates/fleet_lib`: config, database, migrations, repositories, models, auth, access, pagination.
- `crates/fleet_server`: HTTP handlers, error envelope, request ids, OpenAPI document, agent gateway.
- `packages/fleet_client`: TypeScript client generated from the OpenAPI document. `bun run codegen` regenerates both; a test fails when the committed document is stale.
- API conventions follow Temblo's `docs/http-api.md`: `/api/v1`, uuid v7 ids in the API, slugs only in browser URLs, `{items, next_cursor}` pages, one JSON error envelope localized by `Accept-Language`.

## Login

- Providers are configured per installation: Google (OIDC), Microsoft (OIDC), local accounts (argon2 password hashes). Each is switched on by its configuration.
- Sessions follow Temblo's flow: the server finishes the provider login, hands the SPA a one-time code at `/auth/complete`, the SPA exchanges it for a bearer token. Tokens are stored hashed. Sessions are never tied to an org.
- Later, for the hosted service: per-org SSO and email domain rules.

## Agent channel security

Goal: whoever controls DNS, or gets a certificate from any trusted CA, must not be able to control agents.

- HTTPS is its own layer with its own certificate (public CA, the operator's proxy, anything). It is never trusted for agent identity and shares no key with what follows.
- Each fleet has its own X25519 key pair, the fleet key. Its private key is stored encrypted under the server master key (`FLEET_MASTER_KEY`); the database alone cannot impersonate the server.
- An enrollment token carries the server URL, the fleet id, the fleet public key and a one-time secret. The agent pins the fleet id and fleet public key at enrollment.
- Each agent creates its own X25519 key pair on first run. The private key never leaves the machine (file readable only by SYSTEM or root). The server stores only the public key.
- Inside the WebSocket, agent and server run a Noise `IK` handshake (`snow` crate): the agent already knows the fleet public key, the server learns and checks the agent key. Everything after the handshake is encrypted and authenticated end to end between the agent process and the server process, whatever terminates TLS in between.
- An attacker with a hijacked DNS name and a valid TLS certificate gets a TLS connection and nothing else: the handshake needs the fleet private key.
- Rotation: a new fleet public key is announced inside the channel, the agent accepts it for its next connection, the old one stays valid for a grace period. Moving a device to another fleet works the same way.
- Agent updates are signed with a separate release key, checked by the agent before installing.
- Losing the master key makes every fleet key unusable and every agent must enroll again. Back it up.
- Not covered: an attacker who takes over the server itself. A later option is commands signed by an admin's passkey, checked by the agent against an admin list signed by the fleet key.

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
