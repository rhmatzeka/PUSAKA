//! Server lokal untuk pengembangan: `cargo run -p pusaka-api`.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    let alamat = std::env::var("PUSAKA_API_ALAMAT").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&alamat).await?;
    tracing::info!(%alamat, "pusaka-api berjalan");
    axum::serve(listener, pusaka_api::router()).await
}
