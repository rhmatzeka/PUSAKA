use sqlx::PgPool;
use uuid::Uuid;

async fn sisip(
    pool: &PgPool,
    doc: u8,
    status: &str,
    token: Option<i64>,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        "insert into draf (id, status, nama, nim, prodi, gelar, nomor_ijazah, tanggal_lulus, email, \
         penerima, doc_hash, uri, cid_amplop, token_id, dibuat_oleh) values ($1, $2, 'A', '1', 'TI', \
         'S.Kom.', 'N1', '2027-08-30', 'a@b.id', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', $3, \
         'ipfs://m', 'bafy', $4, 'did:privy:op')",
    )
    .bind(id)
    .bind(status)
    .bind(vec![doc; 32])
    .bind(token)
    .execute(pool)
    .await?;
    Ok(id)
}

fn kode(e: sqlx::Error) -> String {
    match e {
        sqlx::Error::Database(d) => d.code().map(|c| c.into_owned()).unwrap_or_default(),
        lain => panic!("bukan galat basis data: {lain}"),
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn skema_punya_lima_tabel(pool: PgPool) {
    let tabel: Vec<String> = sqlx::query_scalar(
        "select table_name::text from information_schema.tables \
         where table_schema = 'public' and table_name not like '\\_sqlx%' order by 1",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        tabel,
        [
            "audit_log",
            "draf",
            "kunci_ijazah",
            "permintaan_cabut",
            "tanda_tangan"
        ]
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn doc_hash_unik(pool: PgPool) {
    sisip(&pool, 1, "MENUNGGU_TTD", None).await.unwrap();
    assert_eq!(
        kode(sisip(&pool, 1, "MENUNGGU_TTD", None).await.unwrap_err()),
        "23505"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn status_draf_dibatasi(pool: PgPool) {
    assert_eq!(
        kode(sisip(&pool, 1, "NGAWUR", None).await.unwrap_err()),
        "23514"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn hanya_satu_permintaan_cabut_aktif_per_token(pool: PgPool) {
    sisip(&pool, 1, "TERBIT", Some(1)).await.unwrap();
    let minta = |status: &'static str| {
        sqlx::query(
            "insert into permintaan_cabut (id, token_id, alasan, status, dibuat_oleh) \
             values ($1, 1, 'salah nama', $2, 'did:privy:op')",
        )
        .bind(Uuid::new_v4())
        .bind(status)
        .execute(&pool)
    };
    minta("MENUNGGU_TTD").await.unwrap();
    assert_eq!(kode(minta("DITANDATANGANI").await.unwrap_err()), "23505");
    sqlx::query("update permintaan_cabut set status = 'SELESAI'")
        .execute(&pool)
        .await
        .unwrap();
    minta("MENUNGGU_TTD").await.unwrap();
}
