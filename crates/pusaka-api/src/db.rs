//! Kueri Postgres. Semua SQL ada di modul ini; handler tidak menulis SQL sendiri.

use chrono::{DateTime, NaiveDate, Utc};
use pusaka_core::hash::keccak256;
use pusaka_core::heks::ke_hex;
use serde_json::{Value, json};
use sqlx::{PgExecutor, PgPool};
use uuid::Uuid;

use crate::galat::Galat;
use crate::validasi::DrafSah;

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

// ------------------------------------------------------------------ draf

pub const STATUS_DRAF: [&str; 5] = [
    "MENUNGGU_TTD",
    "DITANDATANGANI",
    "DITOLAK",
    "TERBIT",
    "DICABUT",
];
pub const PER_HALAMAN: i64 = 20;

/// Draf + tanda tangan penerbitan terbaru yang masih berlaku (hanya bila DITANDATANGANI).
macro_rules! pilih_draf {
    () => {
        "select d.*, t.penanda_tangan as ttd_penanda_tangan, t.sig as ttd_sig, \
         t.batas_waktu as ttd_batas_waktu from draf d left join lateral ( \
         select penanda_tangan, sig, batas_waktu from tanda_tangan \
         where jenis = 'penerbitan' and rujukan_id = d.id and batas_waktu > now() \
         order by dibuat desc limit 1) t on d.status = 'DITANDATANGANI' "
    };
}

#[derive(Debug, sqlx::FromRow)]
pub struct BarisDraf {
    pub id: Uuid,
    pub dibuat: DateTime<Utc>,
    pub diubah: DateTime<Utc>,
    pub status: String,
    pub nama: String,
    pub nim: String,
    pub prodi: String,
    pub gelar: String,
    pub nomor_ijazah: String,
    pub tanggal_lulus: NaiveDate,
    pub email: String,
    pub penerima: String,
    pub doc_hash: Vec<u8>,
    pub uri: String,
    pub cid_amplop: String,
    pub alasan_tolak: Option<String>,
    pub token_id: Option<i64>,
    pub dibuat_oleh: String,
    pub ttd_penanda_tangan: Option<String>,
    pub ttd_sig: Option<Vec<u8>>,
    pub ttd_batas_waktu: Option<DateTime<Utc>>,
}

fn json_ttd(a: &Option<String>, s: &Option<Vec<u8>>, b: &Option<DateTime<Utc>>) -> Value {
    match (a, s, b) {
        (Some(a), Some(s), Some(b)) => {
            json!({ "penanda_tangan": a, "sig": ke_hex(s), "batas_waktu": b.timestamp() })
        }
        _ => Value::Null,
    }
}

impl BarisDraf {
    pub fn ke_json(&self) -> Value {
        json!({
            "id": self.id,
            "dibuat": self.dibuat,
            "diubah": self.diubah,
            "status": self.status,
            "nama": self.nama,
            "nim": self.nim,
            "prodi": self.prodi,
            "gelar": self.gelar,
            "nomor_ijazah": self.nomor_ijazah,
            "tanggal_lulus": self.tanggal_lulus,
            "email": self.email,
            "penerima": self.penerima,
            "doc_hash": ke_hex(&self.doc_hash),
            "metadata_hash": ke_hex(&keccak256(self.uri.as_bytes())),
            "uri": self.uri,
            "cid_amplop": self.cid_amplop,
            "alasan_tolak": self.alasan_tolak,
            "token_id": self.token_id,
            "dibuat_oleh": self.dibuat_oleh,
            "ttd": json_ttd(&self.ttd_penanda_tangan, &self.ttd_sig, &self.ttd_batas_waktu),
        })
    }

    pub fn doc_hash32(&self) -> Result<[u8; 32], Galat> {
        self.doc_hash
            .as_slice()
            .try_into()
            .map_err(|_| Galat::Internal("doc_hash tersimpan bukan 32 byte".into()))
    }
}

pub struct Halaman {
    pub data: Vec<BarisDraf>,
    pub total: i64,
}

fn petakan_unik(e: sqlx::Error, pesan: impl FnOnce() -> String) -> Galat {
    match &e {
        sqlx::Error::Database(d) if d.is_unique_violation() => Galat::Konflik(pesan()),
        _ => Galat::Basisdata(e),
    }
}

pub async fn sisip_draf<'e>(
    e: impl PgExecutor<'e>,
    id: Uuid,
    d: &DrafSah,
    penerima: &[u8; 20],
    oleh: &str,
) -> Result<(), Galat> {
    sqlx::query(
        "insert into draf (id, status, nama, nim, prodi, gelar, nomor_ijazah, tanggal_lulus, \
         email, penerima, doc_hash, uri, cid_amplop, dibuat_oleh) \
         values ($1, 'MENUNGGU_TTD', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
    )
    .bind(id)
    .bind(&d.nama)
    .bind(&d.nim)
    .bind(&d.prodi)
    .bind(&d.gelar)
    .bind(&d.nomor_ijazah)
    .bind(d.tanggal_lulus)
    .bind(&d.email)
    .bind(ke_hex(penerima))
    .bind(d.doc_hash.as_slice())
    .bind(&d.uri)
    .bind(&d.cid_amplop)
    .bind(oleh)
    .execute(e)
    .await
    .map_err(|e| {
        petakan_unik(e, || {
            format!("doc_hash {} sudah pernah didaftarkan", ke_hex(&d.doc_hash))
        })
    })?;
    Ok(())
}

pub async fn simpan_kunci<'e>(
    e: impl PgExecutor<'e>,
    draf: Uuid,
    bungkus: &[u8],
) -> Result<(), Galat> {
    sqlx::query(
        "insert into kunci_ijazah (draf_id, kunci_terenkripsi) values ($1, $2) \
         on conflict (draf_id) do update set kunci_terenkripsi = excluded.kunci_terenkripsi",
    )
    .bind(draf)
    .bind(bungkus)
    .execute(e)
    .await?;
    Ok(())
}

pub async fn ambil_kunci(db: &PgPool, draf: Uuid) -> Result<Option<Vec<u8>>, Galat> {
    Ok(
        sqlx::query_scalar("select kunci_terenkripsi from kunci_ijazah where draf_id = $1")
            .bind(draf)
            .fetch_optional(db)
            .await?,
    )
}

pub async fn ambil_draf(db: &PgPool, id: Uuid) -> Result<Option<BarisDraf>, Galat> {
    Ok(sqlx::query_as(concat!(pilih_draf!(), "where d.id = $1"))
        .bind(id)
        .fetch_optional(db)
        .await?)
}

pub async fn daftar_draf(
    db: &PgPool,
    status: Option<&str>,
    cari: Option<&str>,
    halaman: i64,
) -> Result<Halaman, Galat> {
    // `\` adalah karakter escape bawaan ILIKE di Postgres.
    let pola = cari.map(|c| {
        format!(
            "%{}%",
            c.replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        )
    });
    let data = sqlx::query_as(concat!(
        pilih_draf!(),
        "where ($1::text is null or d.status = $1) and ($2::text is null or d.nama ilike $2 \
         or d.nim ilike $2 or d.nomor_ijazah ilike $2) order by d.dibuat desc, d.id \
         limit $3 offset $4"
    ))
    .bind(status)
    .bind(pola.as_deref())
    .bind(PER_HALAMAN)
    .bind((halaman - 1) * PER_HALAMAN)
    .fetch_all(db)
    .await?;
    let (total,): (i64,) = sqlx::query_as(
        "select count(*) from draf d where ($1::text is null or d.status = $1) and \
         ($2::text is null or d.nama ilike $2 or d.nim ilike $2 or d.nomor_ijazah ilike $2)",
    )
    .bind(status)
    .bind(pola.as_deref())
    .fetch_one(db)
    .await?;
    Ok(Halaman { data, total })
}

pub async fn status_draf(db: &PgPool, id: Uuid) -> Result<Option<String>, Galat> {
    Ok(sqlx::query_scalar("select status from draf where id = $1")
        .bind(id)
        .fetch_optional(db)
        .await?)
}

/// `true` bila draf MENUNGGU_TTD berhasil ditolak.
pub async fn tolak_draf<'e>(e: impl PgExecutor<'e>, id: Uuid, alasan: &str) -> Result<bool, Galat> {
    let r = sqlx::query(
        "update draf set status = 'DITOLAK', alasan_tolak = $2, diubah = now() \
         where id = $1 and status = 'MENUNGGU_TTD'",
    )
    .bind(id)
    .bind(alasan)
    .execute(e)
    .await?;
    Ok(r.rows_affected() == 1)
}

/// Ganti isi draf DITOLAK dan kembalikan ke MENUNGGU_TTD. `true` bila berhasil.
pub async fn perbaiki_draf<'e>(
    e: impl PgExecutor<'e>,
    id: Uuid,
    d: &DrafSah,
    penerima: &[u8; 20],
) -> Result<bool, Galat> {
    let r = sqlx::query(
        "update draf set status = 'MENUNGGU_TTD', alasan_tolak = null, nama = $2, nim = $3, \
         prodi = $4, gelar = $5, nomor_ijazah = $6, tanggal_lulus = $7, email = $8, \
         penerima = $9, doc_hash = $10, uri = $11, cid_amplop = $12, diubah = now() \
         where id = $1 and status = 'DITOLAK'",
    )
    .bind(id)
    .bind(&d.nama)
    .bind(&d.nim)
    .bind(&d.prodi)
    .bind(&d.gelar)
    .bind(&d.nomor_ijazah)
    .bind(d.tanggal_lulus)
    .bind(&d.email)
    .bind(ke_hex(penerima))
    .bind(d.doc_hash.as_slice())
    .bind(&d.uri)
    .bind(&d.cid_amplop)
    .execute(e)
    .await
    .map_err(|e| {
        petakan_unik(e, || {
            format!("doc_hash {} sudah pernah didaftarkan", ke_hex(&d.doc_hash))
        })
    })?;
    Ok(r.rows_affected() == 1)
}

// ------------------------------------------------------------------ tanda tangan

pub async fn sisip_ttd<'e>(
    e: impl PgExecutor<'e>,
    jenis: &str,
    rujukan: Uuid,
    penanda_tangan: &[u8; 20],
    sig: &[u8],
    batas: DateTime<Utc>,
) -> Result<(), Galat> {
    sqlx::query(
        "insert into tanda_tangan (id, jenis, rujukan_id, penanda_tangan, sig, batas_waktu) \
         values ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(jenis)
    .bind(rujukan)
    .bind(ke_hex(penanda_tangan))
    .bind(sig)
    .bind(batas)
    .execute(e)
    .await?;
    Ok(())
}

/// `true` bila draf MENUNGGU_TTD berpindah ke DITANDATANGANI.
pub async fn tandai_draf_ditandatangani<'e>(
    e: impl PgExecutor<'e>,
    id: Uuid,
) -> Result<bool, Galat> {
    let r = sqlx::query(
        "update draf set status = 'DITANDATANGANI', diubah = now() \
         where id = $1 and status = 'MENUNGGU_TTD'",
    )
    .bind(id)
    .execute(e)
    .await?;
    Ok(r.rows_affected() == 1)
}

/// Kembalikan draf/permintaan cabut DITANDATANGANI yang tanda tangannya sudah lewat
/// batas waktu ke MENUNGGU_TTD.
pub async fn kedaluwarsakan(db: &PgPool) -> Result<(), Galat> {
    sqlx::query(
        "update draf d set status = 'MENUNGGU_TTD', diubah = now() \
         where d.status = 'DITANDATANGANI' and not exists (select 1 from tanda_tangan t \
         where t.jenis = 'penerbitan' and t.rujukan_id = d.id and t.batas_waktu > now())",
    )
    .execute(db)
    .await?;
    sqlx::query(
        "update permintaan_cabut c set status = 'MENUNGGU_TTD', diubah = now() \
         where c.status = 'DITANDATANGANI' and not exists (select 1 from tanda_tangan t \
         where t.jenis = 'pencabutan' and t.rujukan_id = c.id and t.batas_waktu > now())",
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Tandai draf ber-`doc_hash` sebagai TERBIT dengan `token_id` dari event on-chain.
/// Kontrak adalah sumber kebenaran: status apa pun selain DICABUT ikut diperbarui.
pub async fn tandai_terbit<'e>(
    e: impl PgExecutor<'e>,
    doc_hash: &[u8; 32],
    token_id: i64,
) -> Result<Option<(Uuid, String)>, Galat> {
    Ok(sqlx::query_as(
        "update draf set status = 'TERBIT', token_id = $2, diubah = now() \
         where doc_hash = $1 and status <> 'DICABUT' returning id, penerima",
    )
    .bind(doc_hash.as_slice())
    .bind(token_id)
    .fetch_optional(e)
    .await?)
}

pub async fn draf_dari_token(db: &PgPool, token_id: i64) -> Result<Option<BarisDraf>, Galat> {
    Ok(
        sqlx::query_as(concat!(pilih_draf!(), "where d.token_id = $1"))
            .bind(token_id)
            .fetch_optional(db)
            .await?,
    )
}

// ------------------------------------------------------------------ pencabutan

pub const STATUS_CABUT: [&str; 3] = ["MENUNGGU_TTD", "DITANDATANGANI", "SELESAI"];

macro_rules! pilih_cabut {
    () => {
        "select c.id, c.token_id, c.alasan, c.status, c.dibuat_oleh, c.dibuat, d.nama, d.nim, \
         d.nomor_ijazah, t.penanda_tangan as ttd_penanda_tangan, t.sig as ttd_sig, \
         t.batas_waktu as ttd_batas_waktu from permintaan_cabut c \
         join draf d on d.token_id = c.token_id left join lateral ( \
         select penanda_tangan, sig, batas_waktu from tanda_tangan \
         where jenis = 'pencabutan' and rujukan_id = c.id and batas_waktu > now() \
         order by dibuat desc limit 1) t on c.status = 'DITANDATANGANI' "
    };
}

#[derive(Debug, sqlx::FromRow)]
pub struct BarisCabut {
    pub id: Uuid,
    pub token_id: i64,
    pub alasan: String,
    pub status: String,
    pub dibuat_oleh: String,
    pub dibuat: DateTime<Utc>,
    pub nama: String,
    pub nim: String,
    pub nomor_ijazah: String,
    pub ttd_penanda_tangan: Option<String>,
    pub ttd_sig: Option<Vec<u8>>,
    pub ttd_batas_waktu: Option<DateTime<Utc>>,
}

impl BarisCabut {
    pub fn ke_json(&self) -> Value {
        json!({
            "id": self.id,
            "token_id": self.token_id,
            "alasan": self.alasan,
            "alasan_hash": ke_hex(&keccak256(self.alasan.as_bytes())),
            "status": self.status,
            "dibuat_oleh": self.dibuat_oleh,
            "dibuat": self.dibuat,
            "nama": self.nama,
            "nim": self.nim,
            "nomor_ijazah": self.nomor_ijazah,
            "ttd": json_ttd(&self.ttd_penanda_tangan, &self.ttd_sig, &self.ttd_batas_waktu),
        })
    }
}

pub async fn sisip_cabut<'e>(
    e: impl PgExecutor<'e>,
    id: Uuid,
    token_id: i64,
    alasan: &str,
    oleh: &str,
) -> Result<(), Galat> {
    sqlx::query(
        "insert into permintaan_cabut (id, token_id, alasan, status, dibuat_oleh) \
         values ($1, $2, $3, 'MENUNGGU_TTD', $4)",
    )
    .bind(id)
    .bind(token_id)
    .bind(alasan)
    .bind(oleh)
    .execute(e)
    .await
    .map_err(|e| {
        petakan_unik(e, || {
            "sudah ada permintaan cabut yang belum selesai untuk token ini".into()
        })
    })?;
    Ok(())
}

pub async fn ambil_cabut(db: &PgPool, id: Uuid) -> Result<Option<BarisCabut>, Galat> {
    Ok(sqlx::query_as(concat!(pilih_cabut!(), "where c.id = $1"))
        .bind(id)
        .fetch_optional(db)
        .await?)
}

pub async fn daftar_cabut(db: &PgPool, status: Option<&str>) -> Result<Vec<BarisCabut>, Galat> {
    Ok(sqlx::query_as(concat!(
        pilih_cabut!(),
        "where ($1::text is null or c.status = $1) order by c.dibuat desc limit 100"
    ))
    .bind(status)
    .fetch_all(db)
    .await?)
}

pub async fn status_cabut(db: &PgPool, id: Uuid) -> Result<Option<String>, Galat> {
    Ok(
        sqlx::query_scalar("select status from permintaan_cabut where id = $1")
            .bind(id)
            .fetch_optional(db)
            .await?,
    )
}

pub async fn tandai_cabut_ditandatangani<'e>(
    e: impl PgExecutor<'e>,
    id: Uuid,
) -> Result<bool, Galat> {
    let r = sqlx::query(
        "update permintaan_cabut set status = 'DITANDATANGANI', diubah = now() \
         where id = $1 and status = 'MENUNGGU_TTD'",
    )
    .bind(id)
    .execute(e)
    .await?;
    Ok(r.rows_affected() == 1)
}

/// Permintaan → SELESAI dan draf → DICABUT. Kontrak sumber kebenaran: permintaan yang
/// tanda tangannya kedaluwarsa (kembali MENUNGGU_TTD) tetap bisa diselesaikan.
pub async fn selesaikan_cabut(
    tx: &mut sqlx::PgConnection,
    id: Uuid,
    token_id: i64,
) -> Result<bool, Galat> {
    let r = sqlx::query(
        "update permintaan_cabut set status = 'SELESAI', diubah = now() \
         where id = $1 and status <> 'SELESAI'",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if r.rows_affected() != 1 {
        return Ok(false);
    }
    sqlx::query("update draf set status = 'DICABUT', diubah = now() where token_id = $1")
        .bind(token_id)
        .execute(&mut *tx)
        .await?;
    Ok(true)
}
