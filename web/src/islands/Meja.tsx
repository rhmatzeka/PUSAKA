import { useCallback, useEffect, useRef, useState } from 'react';
import Kerangka from '../components/Kerangka';
import Segel from '../components/Segel';
import type { Draf, PermintaanCabut } from '../lib/api';
import { batasBaru, ttdPencabutan, ttdPenerbitan } from '../lib/eip712';
import { ringkas } from '../lib/format';
import type { Penanda } from '../lib/sesi';
import { buatSumber } from '../lib/sumber';
import { dariHex } from '../lib/tautan';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

const DOK_PEJABAT = [{ href: '/meja', ikon: '✍', label: 'Meja tanda tangan' }];

function pesan(e: unknown): string {
  return e instanceof Error ? (e.message.split('\n')[0] ?? 'Gagal') : 'Gagal';
}

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [tab, setTab] = useState<'terbit' | 'cabut'>('terbit');
  const [antre, setAntre] = useState<Draf[]>([]);
  const [cabut, setCabut] = useState<PermintaanCabut[]>([]);
  const [awal, setAwal] = useState(0);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [tolak, setTolak] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [pdf, setPdf] = useState<string | null>(null);
  const penanda = useRef<Penanda | null>(null);

  const muat = useCallback(async () => {
    const semua: Draf[] = [];
    for (let hal = 1; hal <= 5; hal++) {
      const h = await api.daftarDraf({ status: 'MENUNGGU_TTD', halaman: hal });
      semua.push(...h.data);
      if (h.data.length < h.per_halaman) break;
    }
    semua.reverse(); // yang paling lama menunggu lebih dulu
    setAntre(semua);
    setAwal((a) => Math.max(a, semua.length));
    setCabut((await api.daftarCabut('MENUNGGU_TTD')).data);
  }, [api]);

  useEffect(() => {
    void muat().catch((e: unknown) => setKabar({ teks: pesan(e), nada: 'bad' }));
  }, [muat]);

  const kini = antre[0] ?? null;
  useEffect(() => {
    setTolak(false);
    setAlasan('');
    setPdf((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  }, [kini?.id]);

  async function wallet(): Promise<Penanda> {
    penanda.current ??= await sesi.penanda();
    return penanda.current;
  }

  async function tandaTangani(d: Draf): Promise<void> {
    const p = await wallet();
    const batas = batasBaru();
    const sig = await p.tandaTangani(ttdPenerbitan(d, batas));
    await api.setujui(d.id, sig, batas);
    setAntre((a) => a.filter((x) => x.id !== d.id));
  }

  async function kerjakan(kerja: () => Promise<string>) {
    setSibuk(true);
    try {
      setKabar({ teks: await kerja(), nada: 'ok' });
    } catch (e) {
      setKabar({ teks: pesan(e), nada: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  const tandatanganiKini = () =>
    kini &&
    kerjakan(async () => {
      await tandaTangani(kini);
      return `${kini.nama} ditandatangani`;
    });

  const setujuiSisanya = () =>
    kerjakan(async () => {
      const daftar = [...antre];
      for (const [i, d] of daftar.entries()) {
        setKabar({ teks: `Menandatangani ${i + 1} dari ${daftar.length}: ${d.nama}` });
        await tandaTangani(d);
      }
      return `${daftar.length} ijazah ditandatangani`;
    });

  const kirimTolak = () =>
    kini &&
    kerjakan(async () => {
      await api.tolak(kini.id, alasan);
      setAntre((a) => a.filter((x) => x.id !== kini.id));
      return `${kini.nama} dikembalikan ke operator`;
    });

  const lihatPdf = () =>
    kini &&
    kerjakan(async () => {
      const d = await api.detailDraf(kini.id);
      const s = await buatSumber(j);
      const isi = s.buka(dariHex(d.kunci), await s.ambil(`ipfs://${d.cid_amplop}`));
      setPdf(URL.createObjectURL(new Blob([isi.pdf.slice()], { type: 'application/pdf' })));
      return 'Pratinjau dibuka dari IPFS (didekripsi di peramban ini)';
    });

  const tandatanganiCabut = (c: PermintaanCabut) =>
    kerjakan(async () => {
      const p = await wallet();
      const batas = batasBaru();
      await api.setujuiCabut(c.id, await p.tandaTangani(ttdPencabutan(c, batas)), batas);
      setCabut((x) => x.filter((y) => y.id !== c.id));
      return `Pencabutan ijazah #${c.token_id} ditandatangani`;
    });

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (tab !== 'terbit' || sibuk || tolak || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        void tandatanganiKini();
      }
      if (e.key.toLowerCase() === 'x') setTolak(true);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  const nomor = awal - antre.length + 1;

  return (
    <Kerangka
      peran="Pusaka Rektor"
      kode="PSK-RK"
      status={tab === 'terbit' ? (kini ? 'Menunggu tanda tangan' : 'Meja bersih') : 'Permintaan cabut'}
      wallet={info.wallet[0]}
      skala={kini ? [`${nomor} / ${awal}`] : []}
      dok={DOK_PEJABAT}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <div className="aksi" style={{ justifyContent: 'center' }}>
        <button type="button" className="chip" aria-pressed={tab === 'terbit'} onClick={() => setTab('terbit')}>
          Penerbitan · {antre.length}
        </button>
        <button type="button" className="chip" aria-pressed={tab === 'cabut'} onClick={() => setTab('cabut')}>
          Pencabutan · {cabut.length}
        </button>
      </div>

      {tab === 'terbit' &&
        (kini ? (
          <section aria-label="Ijazah yang menunggu tanda tangan">
            <div className="meja-ijazah">
              <div className="kertas">
                <span>
                  IJAZAH
                  <strong>{kini.nama}</strong>
                  <small>{kini.nomor_ijazah}</small>
                </span>
              </div>
            </div>
            <div className="meja-data">
              <div>
                <div className="hud">Lulusan</div>
                <p className="meja-nama" data-testid="nama-meja">
                  {kini.nama}
                </p>
                <div className="mono sub" style={{ fontSize: 12 }}>
                  {kini.nim} · {kini.prodi.toUpperCase()} · {kini.gelar}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="hud">Sidik jari</div>
                <div className="mono" style={{ fontSize: 15, marginTop: 6 }}>
                  {ringkas(kini.doc_hash)}
                </div>
              </div>
            </div>
            {tolak ? (
              <form
                className="panel-isian"
                style={{ maxWidth: 620, margin: '18px auto 0' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void kirimTolak();
                }}
              >
                <label>
                  <span className="sub">Alasan penolakan (dibaca operator BAAK)</span>
                  <textarea rows={3} required maxLength={500} autoFocus value={alasan} onChange={(e) => setAlasan(e.currentTarget.value)} />
                </label>
                <div className="aksi" style={{ marginTop: 0 }}>
                  <button type="submit" className="br" style={{ color: 'var(--bad)' }} disabled={sibuk}>
                    Kirim penolakan
                  </button>
                  <button type="button" className="br" onClick={() => setTolak(false)}>
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div className="meja-aksi">
                <button type="button" className="br" data-utama disabled={sibuk} onClick={() => void tandatanganiKini()}>
                  Tanda tangani <kbd>↵</kbd>
                </button>
                <button type="button" className="br" style={{ color: 'var(--bad)' }} disabled={sibuk} onClick={() => setTolak(true)}>
                  Tolak <kbd>X</kbd>
                </button>
                {antre.length > 1 && (
                  <button type="button" className="br" style={{ color: 'var(--ink2)' }} disabled={sibuk} onClick={() => void setujuiSisanya()}>
                    Setujui {antre.length} sisanya
                  </button>
                )}
                <button type="button" className="br" style={{ color: 'var(--ink2)' }} disabled={sibuk} onClick={() => void lihatPdf()}>
                  Lihat PDF
                </button>
              </div>
            )}
            {pdf && <iframe className="pratinjau" style={{ display: 'block' }} src={pdf} title={`PDF ijazah ${kini.nama}`} />}
          </section>
        ) : (
          <section style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{ width: 200, margin: '0 auto' }}>
              <Segel nada="ok" />
            </div>
            <h1 className="judul" data-testid="meja-bersih">
              Meja bersih
            </h1>
            <p className="sub">Tidak ada ijazah yang menunggu tanda tangan.</p>
          </section>
        ))}

      {tab === 'cabut' && (
        <section aria-label="Permintaan pencabutan" style={{ maxWidth: 680, margin: '20px auto 0' }}>
          {cabut.length === 0 && <p className="catatan">Tidak ada permintaan pencabutan.</p>}
          <ul className="bukti">
            {cabut.map((c) => (
              <li key={c.id}>
                <span className="ikon" aria-hidden="true">
                  ⛓
                </span>
                <span className="nama">
                  {c.nama} · #{c.token_id}
                  <span className="ket" data-nada="bad">
                    Alasan: {c.alasan}
                  </span>
                </span>
                <button type="button" className="br" disabled={sibuk} onClick={() => void tandatanganiCabut(c)}>
                  Tanda tangani pencabutan
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="catatan" data-testid="kabar" data-nada={kabar?.nada} style={{ textAlign: 'center', margin: '18px auto 0' }} aria-live="polite">
        {kabar?.teks ?? 'Tanda tangan EIP-712 mengikat penerima, sidik jari PDF, dan metadata; berlaku 7 hari.'}
      </p>
    </Kerangka>
  );
}

export default function Meja() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="penandatangan">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
