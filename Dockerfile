FROM rust:1.100.0-bookworm AS builder

WORKDIR /app

COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN --mount=type=cache,id=fleet-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=fleet-cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=fleet-cargo-target,target=/app/target \
    cargo build --locked --release -p fleet_server \
    && cp /app/target/release/fleet-server /tmp/fleet-server

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home fleet

COPY --from=builder /tmp/fleet-server /usr/local/bin/fleet-server

USER fleet
ENV FLEET_BIND=0.0.0.0:3000
EXPOSE 3000

ENTRYPOINT ["tini", "--", "/usr/local/bin/fleet-server"]
