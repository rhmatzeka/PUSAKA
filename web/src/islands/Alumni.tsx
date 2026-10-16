import { useCallback, useEffect, useRef, useState } from 'react';
import BarisBukti from '../components/BarisBukti';
import Kerangka from '../components/Kerangka';
import LembarQr from '../components/LembarQr';
import Segel from '../components/Segel';
import { pesanUnduh, tampilanKartu, type StatusRantai } from '../lib/alumni';
import type { Hex } from 'viem';
import type { IjazahMilik } from '../lib/api';
import { tanggal } from '../lib/format';
import { kunciDariFragmen } from '../lib/kunci';
import { buatSumber, type SumberRantai } from '../lib/sumber';
import { tautanBerkunci } from '../lib/tautan';
import { cekToken, statusIjazah } from '../lib/verifikasi';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

const DOK_ALUMNI = [
  { href: '/alumni', ikon: '⬢', label: 'Ijazah saya' },
  { href: '/periksa', ikon: '⌕', label: 'Periksa ijazah' },
];

interface Kartu {
  milik: IjazahMilik;
  /** Status dibaca dari kontrak per token; gagal baca tidak menghapus kartu lain. */
  rantai: StatusRantai;
}

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [kartu, setKartu] = useState<Kartu[] | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [qr, setQr] = useState<{ tautan: string; nama: string; nomor: string } | null>(null);
  const [sumber, setSumber] = useState<SumberRantai | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const kunciTersimpan = useRef(new Map<number, Hex>());

  const muat = useCallback(async () => {
    setKabar(null);
    const { data } = await api.milik();
    let s: SumberRantai | null = null;
    try {
      s = await buatSumber(j);
      setSumber(s);
    } catch {
      // Daftar tetap tampil; status menunggu blockchain terjangkau.
    }
    const baca = async (m: IjazahMilik): Promise<StatusRantai> => {
      if (!s) return 'galat';
      try {
        return await s.ijazah(BigInt(m.token_id));
      } catch {
        return 'galat';
      }
    };
    setKartu(await Promise.all(data.map(async (m) => ({ milik: m, rantai: await baca(m) }))));
  }, [api, j]);

  useEffect(() => {
    void muat().catch((e: unknown) => {
      setKartu([]);
      setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });
    });
  }, [muat]);

  async function tautan(m: IjazahMilik): Promise<string> {
    let kunci = kunciTersimpan.current.get(m.token_id);
    if (!kunci) {
      kunci = (await api.kunci(m.token_id)).kunci;
      kunciTersimpan.current.set(m.token_id, kunci);
    }
    return tautanBerkunci(location.origin, m.token_id, kunci);
  }

  const gagal = (e: unknown) => setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });

  /** Satu aksi pada satu waktu; tombol nonaktif selama berjalan. */
  async function aksi(kerja: () => Promise<void>) {
    if (sibuk) return;
    setSibuk(true);
    setKabar(null);
    try {
      await kerja();
    } catch (e) {
      gagal(e);
    } finally {
      setSibuk(false);
    }
  }

  async function unduh(m: IjazahMilik) {
    if (!sumber) throw new Error('Blockchain belum terjangkau. Coba lagi sebentar.');
    const t = await tautan(m);
    const h = await cekToken(BigInt(m.token_id), kunciDariFragmen(new URL(t).hash), sumber);
    if (h.jenis !== 'lengkap') throw new Error('Berkas ijazah tidak cocok dengan catatan blockchain. Hubungi BAAK.');
    const url = URL.createObjectURL(new Blob([h.pdf.slice()], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ijazah-${m.nomor_ijazah.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setKabar(pesanUnduh(h.ijazah));
  }

  return (
    <Kerangka
      peran="Pusaka Alumni"
      kode="PSK-AL"
      status="Ijazah saya"
      wallet={info.wallet[0]}
      dok={DOK_ALUMNI}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <section style={{ maxWidth: 720, margin: '18px auto 0' }} aria-live="polite">
        {kartu === null && <p className="catatan">Membaca ijazah dari blockchain…</p>}
        {kartu?.length === 0 && !kabar && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 200, margin: '0 auto' }}>
              <Segel nada="diam" />
            </div>
            <h1 className="judul">Belum ada ijazah di akun ini</h1>
            <p className="catatan" style={{ marginInline: 'auto' }}>
              Ijazah muncul di sini setelah BAAK mencatatnya ke blockchain dengan email yang sama dengan akun ini.
            </p>
          </div>
        )}
        {kartu?.map(({ milik: m, rantai }) => {
          const t = tampilanKartu(rantai);
          const terbaca = rantai !== null && rantai !== 'galat' ? rantai : null;
          return (
            <article key={m.token_id} data-testid="ijazah-alumni" style={{ marginTop: 18 }}>
              <div className="baris-hud">
                <div className="hud">
                  PSK-{m.token_id}
                  <b data-nada={t.nada} data-testid="status">
                    {t.simbol} {t.kata}
                  </b>
                </div>
                <div className="hud" style={{ textAlign: 'right' }}>
                  Terbit<b>{terbaca ? tanggal(terbaca.waktuTerbit) : '—'}</b>
                </div>
              </div>
              <h1 className="judul">{m.nama}</h1>
              <p className="sub">
                {m.gelar} · {m.prodi} · {m.nomor_ijazah}
              </p>
              {terbaca && statusIjazah(terbaca) === 'DICABUT' && (
                <BarisBukti bukti={[{ ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(terbaca.waktuCabut)}`, nada: 'bad' }]} />
              )}
              {rantai === 'galat' && (
                <p className="catatan">
                  Status di blockchain belum terbaca.{' '}
                  <button type="button" className="br" onClick={() => void aksi(muat)} disabled={sibuk}>
                    Coba lagi
                  </button>
                </p>
              )}
              <div className="aksi">
                <button type="button" className="br" data-utama disabled={sibuk} onClick={() => void aksi(async () => location.assign(await tautan(m)))}>
                  Buka halaman ijazah
                </button>
                <button
                  type="button"
                  className="br"
                  disabled={sibuk}
                  onClick={() => void aksi(async () => setQr({ tautan: await tautan(m), nama: m.nama, nomor: m.nomor_ijazah }))}
                >
                  Lembar QR
                </button>
                <button
                  type="button"
                  className="br"
                  disabled={sibuk}
                  onClick={() =>
                    void aksi(async () => {
                      if (!navigator.clipboard) throw new Error('Peramban ini tidak mengizinkan salin otomatis. Pakai Lembar QR.');
                      await navigator.clipboard.writeText(await tautan(m));
                      setKabar({ teks: 'Tautan berkunci disalin. Bagikan hanya ke pihak yang perlu memeriksa.', nada: 'ok' });
                    })
                  }
                >
                  Salin tautan berkunci
                </button>
                <button type="button" className="br" disabled={sibuk} onClick={() => void aksi(() => unduh(m))}>
                  Unduh PDF
                </button>
              </div>
            </article>
          );
        })}
        {kabar && (
          <p className="catatan" data-testid="kabar" data-nada={kabar.nada}>
            {kabar.teks}
          </p>
        )}
      </section>
      {qr && <LembarQr {...qr} tutup={() => setQr(null)} />}
    </Kerangka>
  );
}

export default function Alumni() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="masuk">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
