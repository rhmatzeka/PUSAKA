//! Server lokal: `cargo run -p pusaka-api` (port 8787).
//! Migrasi: `cargo run -p pusaka-api -- migrasi` (pakai DATABASE_URL_LANGSUNG bila ada).

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();
    // `.env.local` di root repo; tidak wajib ada.
    let _ = dotenvy::from_filename(".env.local");

    if std::env::args().nth(1).as_deref() == Some("migrasi") {
        let url =
            std::env::var("DATABASE_URL_LANGSUNG").or_else(|_| std::env::var("DATABASE_URL"))?;
        let pool = sqlx::PgPool::connect(&url).await?;
        sqlx::migrate!("../../migrations").run(&pool).await?;
        tracing::info!("migrasi selesai");
        return Ok(());
    }

    let alamat = std::env::var("PUSAKA_API_ALAMAT").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&alamat).await?;
    tracing::info!(%alamat, "pusaka-api berjalan");
    axum::serve(listener, pusaka_api::router_dasar()).await?;
    Ok(())
}
