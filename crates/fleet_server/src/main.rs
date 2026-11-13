use std::process::ExitCode;
use std::time::Duration;

use fleet_lib::{AppContext, Config};
use fleet_server::{AppState, app, cors_layer};
use tokio::net::TcpListener;
use tokio::signal;

const HTTP_DRAIN: Duration = Duration::from_secs(10);

#[tokio::main]
async fn main() -> ExitCode {
    let _ = dotenvy::dotenv();

    let _telemetry = match fleet_lib::telemetry::init() {
        Ok(telemetry) => telemetry,
        Err(error) => {
            eprintln!("telemetry setup failed: {error}");
            return ExitCode::FAILURE;
        }
    };

    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(%error, "startup failed");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env()?;

    let pool =
        fleet_lib::db::connect(config.database_url.expose(), config.db_max_connections).await?;
    tracing::info!(
        max_connections = config.db_max_connections,
        "database pool ready"
    );

    if config.auto_migrate {
        fleet_lib::db::migrate(&pool).await?;
        tracing::info!("migrations applied");
    } else {
        tracing::info!("auto-migrate disabled; assuming the schema is already current");
    }

    let state = AppState {
        db: pool.clone(),
        ctx: AppContext::new(pool),
        app_url: config.app_url.clone(),
    };

    let mut cors_origins = config.cors_origins.clone();
    if !cors_origins.contains(&config.app_url) {
        cors_origins.push(config.app_url.clone());
    }
    let cors = cors_layer(&cors_origins)?;
    match &cors {
        Some(_) => tracing::info!(
            origins = ?cors_origins,
            localhost_allowed = cfg!(debug_assertions),
            "CORS enabled"
        ),
        None => tracing::info!("CORS disabled: no allowed origins configured"),
    }

    let listener = TcpListener::bind(&config.bind).await?;
    tracing::info!(addr = %listener.local_addr()?, "listening");

    let (stop, stopping) = tokio::sync::oneshot::channel::<()>();
    let mut serving = tokio::spawn(async move {
        axum::serve(listener, app(state, cors))
            .with_graceful_shutdown(async move {
                let _ = stopping.await;
            })
            .await
    });
    tokio::select! {
        served = &mut serving => return Ok(served??),
        () = shutdown_signal() => {}
    }
    let _ = stop.send(());
    if tokio::time::timeout(HTTP_DRAIN, &mut serving)
        .await
        .is_err()
    {
        tracing::warn!("requests still running past the drain; shutting down without them");
        serving.abort();
    }
    Ok(())
}

async fn shutdown_signal() {
    let interrupt = async {
        signal::ctrl_c()
            .await
            .expect("failed to install SIGINT handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }

    tracing::info!("shutdown signal received; draining");
}
