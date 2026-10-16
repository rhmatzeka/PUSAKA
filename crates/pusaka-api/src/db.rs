//! Kueri Postgres. Semua SQL ada di modul ini; handler tidak menulis SQL sendiri.

use serde_json::Value;
use sqlx::{PgExecutor, PgPool};

use crate::galat::Galat;

/// Batas aksi tulis per pengguna per menit. Dihitung dari audit_log sehingga berlaku
/// lintas instance serverless.
pub const BATAS_PER_MENIT: i64 = 120;

pub async fn cek_batas(db: &PgPool, pelaku: &str) -> Result<(), Galat> {
    let (jumlah,): (i64,) = sqlx::query_as(
        "select count(*) from audit_log where pelaku = $1 and waktu > now() - interval '1 minute'",
    )
    .bind(pelaku)
    .fetch_one(db)
    .await?;
    if jumlah >= BATAS_PER_MENIT {
        Err(Galat::TerlaluBanyak)
    } else {
        Ok(())
    }
}

pub async fn audit<'e>(
    e: impl PgExecutor<'e>,
    pelaku: &str,
    aksi: &str,
    rujukan: &str,
    detail: Value,
) -> Result<(), Galat> {
    sqlx::query("insert into audit_log (pelaku, aksi, rujukan, detail) values ($1, $2, $3, $4)")
        .bind(pelaku)
        .bind(aksi)
        .bind(rujukan)
        .bind(detail)
        .execute(e)
        .await?;
    Ok(())
}
