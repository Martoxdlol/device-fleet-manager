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
| [crates/fleet_brand](crates/fleet_brand) | The product name, the only place the server side defines it |
| [packages/fleet_client](packages/fleet_client) | TypeScript client generated from `openapi.json` |
| [apps/web](apps/web) | Web console (React, Vite, shadcn, Base UI) |

## Commands

```sh
bun install                      # JS workspaces
cp .env.example .env             # then set DATABASE_URL
cargo run -p fleet_server        # API on :3000, migrates on start
bun run --cwd apps/web dev       # console on :5173
bun run codegen                  # OpenAPI document and TypeScript client, after API changes
cargo test --workspace           # Rust tests
bun run lint && bun run format:check
bun run --cwd apps/web typecheck
```

Applied migrations are never edited; add a new one.
