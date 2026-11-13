# Device Fleet Manager

An agent on Windows and Linux machines connects to a server over the internet, reports inventory, users and telemetry, and runs commands. Admins work in a web console. Organizations > Fleets > Devices.

[docs/design.md](docs/design.md) has the design and its decisions. [AGENTS.md](AGENTS.md) has the rules for working on the code.

## Layout

| Path | What it is |
| --- | --- |
| [crates/fleet_server](crates/fleet_server) | Rust API server (axum): routes, OpenAPI generation, the `gen-openapi` binary |
| [crates/fleet_lib](crates/fleet_lib) | Config, database pool, migrations, repositories, telemetry |
| [crates/fleet_lib/migrations](crates/fleet_lib/migrations) | SQL migrations, embedded into the server at compile time |
| [crates/fleet_i18n](crates/fleet_i18n) | Languages and localized server messages |
| [packages/fleet_client](packages/fleet_client) | TypeScript client generated from `openapi.json` |
| [apps/web](apps/web) | Web console (React, Vite, shadcn, Base UI) |

## Commands

```sh
bun install                      # JS workspaces
cp .env.example .env             # then set DATABASE_URL and FLEET_MASTER_KEY (openssl rand -base64 32)
cargo run -p fleet_server        # API on :3000, migrates on start
bun run --cwd apps/web dev       # console on :5173, /api proxied to :3000
bun run codegen                  # OpenAPI document and TypeScript client, after API changes
cargo test --workspace           # Rust tests
bun run lint && bun run format:check
bun run --cwd apps/web typecheck
```

Applied migrations are never edited; add a new one.

With no users yet, the server either creates the first instance admin and organization from `FLEET_BOOTSTRAP_EMAIL` and `FLEET_BOOTSTRAP_PASSWORD` (or `FLEET_BOOTSTRAP_PASSWORD_HASH`), or logs a one-time `/setup` link. `FLEET_SIGNUP=open` lets anyone create an account; the default `invite` only takes invited people. `FLEET_MASTER_KEY` seals the agent keys: back it up, losing it means enrolling every agent again.

The Docker image serves the API and the console from one container: the console is built into it and served from `FLEET_WEB_DIR`, every path outside `/api` and `/health` is the console.
