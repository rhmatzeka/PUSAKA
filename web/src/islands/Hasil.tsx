import { useEffect, useMemo, useState } from 'react';
import BarisBukti, { type Bukti } from '../components/BarisBukti';
import Segel, { type NadaSegel } from '../components/Segel';
import { angka, ringkas, tanggal } from '../lib/format';
import type { HasilToken, Ijazah } from '../lib/jenis';
import { jaringan } from '../lib/konfigurasi';
import { tokenDariJalur } from '../lib/jalur';
import { kunciDariFragmen } from '../lib/kunci';
import { buatSumber } from '../lib/sumber';
import { STATUS, pesanGalat, type Tampilan } from '../lib/tampilan';
import { cekToken, statusIjazah } from '../lib/verifikasi';

type Keadaan =
  | { tahap: 'memuat'; tokenId: string }
  | { tahap: 'hasil'; hasil: HasilToken; blok: bigint }
  | { tahap: 'alamat-salah' }
  | { tahap: 'galat'; tokenId: string; pesan: string };

function buktiRantai(i: Ijazah): Bukti[] {
  const dicabut = statusIjazah(i) === 'DICABUT';
  return [
    { ikon: '✍', nama: 'Tanda tangan Rektor', ket: '↑ Sah · EIP-712', nada: 'ok', nilai: ringkas(i.penandaTangan) },
    dicabut
      ? { ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(i.waktuCabut)}`, nada: 'bad' }
      : { ikon: '⛓', nama: 'Status di blockchain', ket: '↑ Tidak dicabut', nada: 'ok', nilai: tanggal(i.waktuTerbit) },
  ];
}

function tampilanHasil(h: HasilToken): Tampilan {
  if (h.jenis === 'tidak-ada') return STATUS.TIDAK_ADA;
  if (h.jenis === 'berkas-tidak-cocok') return STATUS.PERINGATAN;
  return STATUS[statusIjazah(h.ijazah)];
}

function Pdf({ pdf, nama }: { pdf: Uint8Array; nama: string }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([pdf.slice()], { type: 'application/pdf' })), [pdf]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [disalin, setDisalin] = useState(false);
  return (
    <>
      <div className="aksi">
        <a className="br" data-utama href={url} download={`ijazah-${nama}.pdf`}>
          Unduh PDF
        </a>
        <button
          type="button"
          className="br"
          onClick={() => {
            void navigator.clipboard.writeText(location.href).then(() => setDisalin(true));
          }}
        >
          {disalin ? 'Tautan disalin' : 'Salin tautan'}
        </button>
        <button type="button" className="br" onClick={() => window.print()}>
          Cetak
        </button>
      </div>
      <p className="catatan tidak-dicetak">Tautan ini membawa kunci berkas. Bagikan hanya ke pihak yang perlu memeriksa.</p>
      <iframe className="pratinjau" src={url} title="Pratinjau PDF ijazah" />
    </>
  );
}

function Isi({ hasil }: { hasil: HasilToken }) {
  const id = hasil.tokenId.toString();
  switch (hasil.jenis) {
    case 'tidak-ada':
      return (
        <>
          <h1 className="judul">Token #{id} tidak ada</h1>
          <p className="catatan">
            Nomor token ini belum pernah diterbitkan PUSAKA. Periksa kembali nomornya, atau unggah PDF ijazah di halaman Periksa.
          </p>
          <div className="aksi">
            <a className="br" data-utama href="/periksa">
              Periksa ijazah lain
            </a>
          </div>
        </>
      );
    case 'terkunci':
      return (
        <>
          <h1 className="judul">Ijazah #{id}</h1>
          <p className="sub">Diterbitkan {tanggal(hasil.ijazah.waktuTerbit)}</p>
          <BarisBukti bukti={buktiRantai(hasil.ijazah)} />
          <p className="catatan" data-testid="terkunci">
            Data lulusan terkunci. Nama dan berkas hanya tampil bila halaman ini dibuka dari tautan atau QR berkunci milik
            alumni.
          </p>
        </>
      );
    case 'kunci-salah':
      return (
        <>
          <h1 className="judul">Ijazah #{id}</h1>
          <BarisBukti
            bukti={[{ ikon: '⚿', nama: 'Kunci berkas', ket: '✕ Tidak cocok', nada: 'bad' }, ...buktiRantai(hasil.ijazah)]}
          />
          <p className="catatan">
            Kunci di tautan ini tidak bisa membuka berkas ijazah. Minta tautan atau QR baru dari pemilik ijazah. Status di
            blockchain di atas tetap berlaku.
          </p>
        </>
      );
    case 'berkas-tidak-cocok':
      return (
        <>
          <h1 className="judul">Jangan percayai berkas ini</h1>
          <BarisBukti
            bukti={[
              { ikon: '⌗', nama: 'Sidik jari berkas', ket: '✕ Tidak cocok', nada: 'bad', nilai: ringkas(hasil.hashBerkas) },
              ...buktiRantai(hasil.ijazah),
            ]}
          />
          <p className="catatan">
            Berkas di IPFS tidak sama dengan sidik jari yang dicatat di blockchain saat ijazah diterbitkan. Laporkan ke BAAK
            Universitas Pamulang.
          </p>
        </>
      );
    case 'lengkap': {
      const d = hasil.data;
      return (
        <>
          <h1 className="judul" data-testid="nama">
            {d.nama}
          </h1>
          <p className="sub">
            {d.gelar} · {d.prodi} · Universitas Pamulang
          </p>
          <BarisBukti
            bukti={[
              { ikon: '⌗', nama: 'Sidik jari berkas', ket: '↑ Cocok 100%', nada: 'ok', nilai: ringkas(hasil.ijazah.docHash) },
              ...buktiRantai(hasil.ijazah),
            ]}
          />
          <dl className="data">
            <dt>NIM</dt>
            <dd className="mono">{d.nim}</dd>
            <dt>Nomor ijazah</dt>
            <dd className="mono">{d.nomor_ijazah}</dd>
            <dt>Tanggal lulus</dt>
            <dd>{tanggal(Date.parse(`${d.tanggal_lulus}T00:00:00+07:00`) / 1000)}</dd>
          </dl>
          <Pdf pdf={hasil.pdf} nama={d.nomor_ijazah.replace(/[^A-Za-z0-9]+/g, '-')} />
        </>
      );
    }
  }
}

export default function Hasil() {
  const [k, setK] = useState<Keadaan>({ tahap: 'memuat', tokenId: '' });

  useEffect(() => {
    const tokenId = tokenDariJalur(location.pathname);
    if (tokenId === null) {
      setK({ tahap: 'alamat-salah' });
      return;
    }
    setK({ tahap: 'memuat', tokenId: tokenId.toString() });
    let batal = false;
    (async () => {
      try {
        const s = await buatSumber(jaringan());
        const [hasil, blok] = await Promise.all([cekToken(tokenId, kunciDariFragmen(location.hash), s), s.blok()]);
        if (!batal) setK({ tahap: 'hasil', hasil, blok });
      } catch (e) {
        if (!batal) setK({ tahap: 'galat', tokenId: tokenId.toString(), pesan: pesanGalat(e) });
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (k.tahap === 'alamat-salah') {
    return (
      <div className="panggung">
        <section className="panggung-kanan">
          <h1 className="judul">Alamat ijazah tidak lengkap</h1>
          <p className="catatan">Alamat yang benar berbentuk /i/ diikuti nomor token, misalnya /i/1284.</p>
          <div className="aksi">
            <a className="br" data-utama href="/periksa">
              Ke halaman Periksa
            </a>
          </div>
        </section>
      </div>
    );
  }

  const t = k.tahap === 'hasil' ? tampilanHasil(k.hasil) : null;
  const nada: NadaSegel = t ? t.nada : k.tahap === 'galat' ? 'bad' : 'tunggu';
  const id = k.tahap === 'hasil' ? k.hasil.tokenId.toString() : k.tokenId;

  return (
    <div className="panggung" data-siap={k.tahap === 'memuat' ? undefined : ''}>
      <section aria-hidden="true">
        <Segel nada={nada}>
          <span className="hud">
            Ijazah
            <b>#{id}</b>
          </span>
        </Segel>
      </section>
      <section className="panggung-kanan" aria-live="polite">
        <div className="baris-hud">
          <div className="hud">
            PSK-{id}
            {t ? (
              <b data-nada={t.nada} data-testid="status">
                {t.simbol} {t.kata}
              </b>
            ) : k.tahap === 'galat' ? (
              <b data-nada="bad">! Gagal membaca</b>
            ) : (
              <b>Membaca blockchain…</b>
            )}
          </div>
          {k.tahap === 'hasil' && (
            <div className="hud" style={{ textAlign: 'right' }}>
              Blok<b>{angka(k.blok)}</b>
            </div>
          )}
        </div>
        {k.tahap === 'hasil' && <Isi hasil={k.hasil} />}
        {k.tahap === 'galat' && <p className="catatan">{k.pesan}</p>}
      </section>
    </div>
  );
}
