//! Alat bantu tes integrasi.
#![allow(dead_code)]

use axum::Router;

/// Jalankan `app` di port acak lokal; kembalikan URL dasarnya.
pub async fn layani(app: Router) -> String {
    let pendengar = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let alamat = pendengar.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(pendengar, app).await.unwrap() });
    format!("http://{alamat}")
}
