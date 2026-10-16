import { useCallback, useEffect, useState } from 'react';
import BarisBukti from '../components/BarisBukti';
import Kerangka from '../components/Kerangka';
import LembarQr from '../components/LembarQr';
import Segel from '../components/Segel';
import type { IjazahMilik } from '../lib/api';
import { tanggal } from '../lib/format';
import type { Ijazah } from '../lib/jenis';
import { kunciDariFragmen } from '../lib/kunci';
import { buatSumber, type SumberRantai } from '../lib/sumber';
import { STATUS } from '../lib/tampilan';
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
  /** Status dibaca dari kontrak; `null` bila belum terbaca. */
  rantai: Ijazah | null;
}

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [kartu, setKartu] = useState<Kartu[] | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [qr, setQr] = useState<{ tautan: string; nama: string; nomor: string } | null>(null);
  const [sumber, setSumber] = useState<SumberRantai | null>(null);

  const muat = useCallback(async () => {
    const s = await buatSumber(j);
    setSumber(s);
    const { data } = await api.milik();
    setKartu(await Promise.all(data.map(async (m) => ({ milik: m, rantai: await s.ijazah(BigInt(m.token_id)) }))));
  }, [api, j]);

  useEffect(() => {
    void muat().catch((e: unknown) => {
      setKartu([]);
      setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });
    });
  }, [muat]);

  async function tautan(m: IjazahMilik): Promise<string> {
    const { kunci } = await api.kunci(m.token_id);
    return tautanBerkunci(location.origin, m.token_id, kunci);
  }

  const gagal = (e: unknown) => setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });

  async function unduh(m: IjazahMilik) {
    if (!sumber) return;
    const t = await tautan(m);
    const h = await cekToken(BigInt(m.token_id), kunciDariFragmen(new URL(t).hash), sumber);
    if (h.jenis !== 'lengkap') throw new Error('Berkas ijazah tidak cocok dengan catatan blockchain. Hubungi BAAK.');
    const url = URL.createObjectURL(new Blob([h.pdf.slice()], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ijazah-${m.nomor_ijazah.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setKabar({ teks: 'PDF diunduh (sidik jari cocok dengan blockchain)', nada: 'ok' });
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
          const t = rantai ? STATUS[statusIjazah(rantai)] : STATUS.TIDAK_ADA;
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
                  Terbit<b>{rantai ? tanggal(rantai.waktuTerbit) : '—'}</b>
                </div>
              </div>
              <h1 className="judul">{m.nama}</h1>
              <p className="sub">
                {m.gelar} · {m.prodi} · {m.nomor_ijazah}
              </p>
              {rantai && statusIjazah(rantai) === 'DICABUT' && (
                <BarisBukti bukti={[{ ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(rantai.waktuCabut)}`, nada: 'bad' }]} />
              )}
              <div className="aksi">
                <button type="button" className="br" data-utama onClick={() => void tautan(m).then((x) => location.assign(x)).catch(gagal)}>
                  Buka halaman ijazah
                </button>
                <button
                  type="button"
                  className="br"
                  onClick={() => void tautan(m).then((x) => setQr({ tautan: x, nama: m.nama, nomor: m.nomor_ijazah })).catch(gagal)}
                >
                  Lembar QR
                </button>
                <button
                  type="button"
                  className="br"
                  onClick={() =>
                    void tautan(m)
                      .then((x) => navigator.clipboard?.writeText(x))
                      .then(() => setKabar({ teks: 'Tautan berkunci disalin. Bagikan hanya ke pihak yang perlu memeriksa.', nada: 'ok' }))
                      .catch(gagal)
                  }
                >
                  Salin tautan berkunci
                </button>
                <button type="button" className="br" onClick={() => void unduh(m).catch(gagal)}>
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
