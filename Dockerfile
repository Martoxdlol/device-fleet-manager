FROM rust:1.100.0-bookworm AS server

WORKDIR /app

COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN --mount=type=cache,id=fleet-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=fleet-cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=fleet-cargo-target,target=/app/target \
    cargo build --locked --release -p fleet_server \
    && cp /app/target/release/fleet-server /tmp/fleet-server

FROM oven/bun:1.4.3 AS web

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN bun install --frozen-lockfile && bun run --cwd apps/web build

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home fleet

COPY --from=server /tmp/fleet-server /usr/local/bin/fleet-server
COPY --from=web /app/apps/web/dist /usr/share/fleet/web

USER fleet
ENV FLEET_BIND=0.0.0.0:3000 \
    FLEET_WEB_DIR=/usr/share/fleet/web
EXPOSE 3000

ENTRYPOINT ["tini", "--", "/usr/local/bin/fleet-server"]
