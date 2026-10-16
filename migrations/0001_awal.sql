-- Skema awal PUSAKA v2. Kebenaran status ijazah ada di kontrak; tabel ini hanya
-- menyimpan pekerjaan yang belum on-chain (draf, tanda tangan, kunci) dan jejak audit.

create table draf (
    id            uuid primary key,
    dibuat        timestamptz not null default now(),
    diubah        timestamptz not null default now(),
    status        text not null
                  check (status in ('MENUNGGU_TTD', 'DITANDATANGANI', 'DITOLAK', 'TERBIT', 'DICABUT')),
    nama          text not null,
    nim           text not null,
    prodi         text not null,
    gelar         text not null,
    nomor_ijazah  text not null,
    tanggal_lulus date not null,
    email         text not null,
    penerima      text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
    doc_hash      bytea not null unique check (length(doc_hash) = 32),
    uri           text not null,
    cid_amplop    text not null,
    alasan_tolak  text,
    token_id      bigint unique,
    dibuat_oleh   text not null
);
create index draf_status_dibuat on draf (status, dibuat desc);

create table tanda_tangan (
    id             uuid primary key,
    jenis          text not null check (jenis in ('penerbitan', 'pencabutan')),
    rujukan_id     uuid not null,
    penanda_tangan text not null check (penanda_tangan ~ '^0x[0-9a-f]{40}$'),
    sig            bytea not null check (length(sig) = 65),
    batas_waktu    timestamptz not null,
    dibuat         timestamptz not null default now()
);
create index tanda_tangan_rujukan on tanda_tangan (jenis, rujukan_id, dibuat desc);

-- Kunci AES ijazah, dienkripsi AES-256-GCM dengan KUNCI_MASTER (AAD = id draf).
create table kunci_ijazah (
    draf_id           uuid primary key references draf (id) on delete cascade,
    kunci_terenkripsi bytea not null
);

create table permintaan_cabut (
    id          uuid primary key,
    token_id    bigint not null references draf (token_id),
    alasan      text not null,
    status      text not null check (status in ('MENUNGGU_TTD', 'DITANDATANGANI', 'SELESAI')),
    dibuat_oleh text not null,
    dibuat      timestamptz not null default now(),
    diubah      timestamptz not null default now()
);
create unique index permintaan_cabut_aktif on permintaan_cabut (token_id) where status <> 'SELESAI';

create table audit_log (
    id      bigserial primary key,
    waktu   timestamptz not null default now(),
    pelaku  text not null,
    aksi    text not null,
    rujukan text not null default '',
    detail  jsonb not null default '{}'
);
create index audit_log_pelaku_waktu on audit_log (pelaku, waktu desc);
