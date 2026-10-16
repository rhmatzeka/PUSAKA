//! Fungsi Vercel: membungkus router axum PUSAKA. Semua `/api/*` di-rewrite ke sini (vercel.json).

use tower::ServiceBuilder;
use vercel_runtime::Error;
use vercel_runtime::axum::VercelLayer;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let app = ServiceBuilder::new()
        .layer(VercelLayer::new())
        .service(pusaka_api::router_dasar());
    vercel_runtime::run(app).await
}
