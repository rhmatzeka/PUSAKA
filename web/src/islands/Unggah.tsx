import { useEffect, useState, type FormEvent } from 'react';
import Kerangka, { DOK_OPERATOR } from '../components/Kerangka';
import type { DrafBaru } from '../lib/api';
import { muatCore } from '../lib/core';
import type { DataLulusan } from '../lib/jenis';
import { cocokkanPdf, siapkanDraf, type AlatUnggah, type BerkasPdf, type HasilCsv } from '../lib/unggah';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

type Tahap = 'antre' | 'menyegel' | 'siap' | 'galat' | 'terkirim';

interface Baris {
  kunci: string;
  nama: string;
  email: string;
  data: DataLulusan | null;
  pdf: Uint8Array | null;
  tahap: Tahap;
  pesan: string;
  draf: DrafBaru | null;
}

const KOSONG: DataLulusan & { email: string } = { nama: '', nim: '', prodi: '', gelar: '', nomor_ijazah: '', tanggal_lulus: '', email: '' };

const LABEL: Record<keyof typeof KOSONG, string> = {
  nama: 'Nama lulusan',
  nim: 'NIM',
  prodi: 'Program studi',
  gelar: 'Gelar',
  nomor_ijazah: 'Nomor ijazah',
  tanggal_lulus: 'Tanggal lulus',
  email: 'Email alumni',
};

const KET: Record<Tahap, { teks: string; nada: string }> = {
  antre: { teks: 'Antre', nada: 'redup' },
  menyegel: { teks: 'Menyegel & mengunggah ke IPFS…', nada: 'biru' },
  siap: { teks: 'Keccak ✓ · AES ✓ · IPFS ✓', nada: 'ok' },
  galat: { teks: '', nada: 'bad' },
  terkirim: { teks: '↑ Terkirim ke Meja Rektor', nada: 'ok' },
};

async function bacaPdf(f: FileList | null): Promise<BerkasPdf[]> {
  return Promise.all([...(f ?? [])].map(async (x) => ({ nama: x.name, isi: new Uint8Array(await x.arrayBuffer()) })));
}

function Isi() {
  const { api, info, sesi } = useAplikasi();
  const ulang = new URLSearchParams(location.search).get('ulang');
  const [mode, setMode] = useState<'csv' | 'satu'>(ulang ? 'satu' : 'csv');
  const [namaCsv, setNamaCsv] = useState('');
  const [teksCsv, setTeksCsv] = useState<string | null>(null);
  const [pdf, setPdf] = useState<BerkasPdf[]>([]);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [isian, setIsian] = useState(KOSONG);
  const [pdfSatu, setPdfSatu] = useState<Uint8Array | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!ulang) return;
    api
      .detailDraf(ulang)
      .then((d) => {
        setIsian({ nama: d.nama, nim: d.nim, prodi: d.prodi, gelar: d.gelar, nomor_ijazah: d.nomor_ijazah, tanggal_lulus: d.tanggal_lulus, email: d.email });
        setKabar({ teks: `Ditolak Rektor: ${d.alasan_tolak ?? '-'}. Perbaiki lalu kirim ulang dengan PDF yang benar.`, nada: 'bad' });
      })
      .catch((e: unknown) => setKabar({ teks: e instanceof Error ? e.message : 'Draf tidak bisa dimuat', nada: 'bad' }));
  }, [api, ulang]);

  // Susun ulang baris setiap CSV atau kumpulan PDF berubah.
  useEffect(() => {
    if (teksCsv === null) return;
    let batal = false;
    void muatCore().then((core) => {
      if (batal) return;
      try {
        const h = JSON.parse(core.baca_csv(teksCsv)) as HasilCsv;
        const sah: Baris[] = cocokkanPdf(h.baris, pdf).map(({ baris: b, pdf: p }) => ({
          kunci: `b${b.nomor_baris}`,
          nama: b.data.nama,
          email: b.email,
          data: b.data,
          pdf: p?.isi ?? null,
          tahap: p ? 'antre' : 'galat',
          pesan: p ? '' : `PDF ${b.file_pdf} belum dipilih`,
          draf: null,
        }));
        const salah: Baris[] = h.galat.map((g) => ({
          kunci: `g${g.nomor_baris}`,
          nama: `Baris ${g.nomor_baris}`,
          email: '',
          data: null,
          pdf: null,
          tahap: 'galat',
          pesan: g.pesan,
          draf: null,
        }));
        setBaris([...sah, ...salah]);
        setKabar(null);
      } catch (e) {
        setBaris([]);
        setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });
      }
    });
    return () => {
      batal = true;
    };
  }, [teksCsv, pdf]);

  async function alat(): Promise<AlatUnggah> {
    const core = await muatCore();
    return {
      keccak: (b) => core.keccak256_hex(b) as `0x${string}`,
      segel: (k, n, dj, p) => core.segel_amplop(k, n, dj, p),
      acak: (n) => crypto.getRandomValues(new Uint8Array(n)),
      unggah: (nama, isi) => api.unggahIpfs(nama, isi),
      gambar: `${location.origin}/segel.svg`,
    };
  }

  const ubah = (k: string, p: Partial<Baris>) => setBaris((bs) => bs.map((b) => (b.kunci === k ? { ...b, ...p } : b)));

  async function kirimCsv() {
    const antre = baris.filter((b) => b.tahap === 'antre' || b.tahap === 'siap');
    if (antre.length === 0 || sibuk) return;
    setSibuk(true);
    setKabar({ teks: 'Menyiapkan draf…' });
    try {
      const a = await alat();
      const siap: { kunci: string; draf: DrafBaru }[] = [];
      for (const b of antre) {
        if (b.draf) {
          siap.push({ kunci: b.kunci, draf: b.draf });
          continue;
        }
        if (!b.data || !b.pdf) continue;
        ubah(b.kunci, { tahap: 'menyegel' });
        try {
          const draf = await siapkanDraf(b.data, b.email, b.pdf, a);
          ubah(b.kunci, { tahap: 'siap', draf });
          siap.push({ kunci: b.kunci, draf });
        } catch (e) {
          ubah(b.kunci, { tahap: 'galat', pesan: e instanceof Error ? e.message : String(e) });
        }
      }
      if (siap.length === 0) throw new Error('Tidak ada baris yang siap dikirim.');
      await api.buatDraf(siap.map((s) => s.draf));
      for (const s of siap) ubah(s.kunci, { tahap: 'terkirim' });
      setKabar({ teks: `${siap.length} draf terkirim ke Meja Rektor`, nada: 'ok' });
    } catch (e) {
      setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  async function kirimSatu(e: FormEvent) {
    e.preventDefault();
    if (!pdfSatu || sibuk) return;
    setSibuk(true);
    setKabar({ teks: 'Menyegel dan mengunggah ke IPFS…' });
    try {
      const { email, ...data } = isian;
      const draf = await siapkanDraf(data, email, pdfSatu, await alat());
      if (ulang) await api.kirimUlang(ulang, draf);
      else await api.buatDraf([draf]);
      setKabar({ teks: ulang ? 'Draf diperbaiki dan dikirim ulang ke Meja Rektor' : 'Draf terkirim ke Meja Rektor', nada: 'ok' });
      if (!ulang) {
        setIsian(KOSONG);
        setPdfSatu(null);
      }
    } catch (x) {
      setKabar({ teks: x instanceof Error ? x.message : String(x), nada: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && mode === 'csv') {
        e.preventDefault();
        void kirimCsv();
      }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  const jumlah = (t: Tahap) => baris.filter((b) => b.tahap === t).length;
  const bisaKirim = jumlah('antre') + jumlah('siap');

  return (
    <Kerangka
      peran="Pusaka Operator"
      kode={ulang ? 'Kirim ulang' : 'Draf baru'}
      status={mode === 'csv' ? `Batch · ${bisaKirim} / ${baris.length}` : 'Satu draf'}
      wallet={info.wallet[0]}
      dok={DOK_OPERATOR}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <div className="jendela">
        <div className="jendela-cari">
          <span aria-hidden="true">⇪</span>
          {!ulang && (
            <>
              <button type="button" className="chip" aria-pressed={mode === 'csv'} onClick={() => setMode('csv')}>
                CSV + PDF
              </button>
              <button type="button" className="chip" aria-pressed={mode === 'satu'} onClick={() => setMode('satu')}>
                Satu draf
              </button>
            </>
          )}
          <span className="hud" style={{ marginLeft: 'auto' }}>
            {mode === 'csv' ? `${namaCsv || 'Belum ada CSV'} · ${pdf.length} PDF` : 'IPFS · terenkripsi'}
          </span>
        </div>

        {mode === 'csv' ? (
          <>
            <div className="formulir">
              <label>
                Berkas CSV (nama,nim,prodi,gelar,nomor_ijazah,tanggal_lulus,email,file_pdf)
                <input
                  type="file"
                  accept=".csv,text/csv"
                  data-testid="pilih-csv"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (!f) return;
                    setNamaCsv(f.name);
                    void f.text().then(setTeksCsv);
                  }}
                />
              </label>
              <label>
                PDF ijazah (pilih semuanya sekaligus)
                <input type="file" accept="application/pdf,.pdf" multiple data-testid="pilih-pdf" onChange={(e) => void bacaPdf(e.currentTarget.files).then(setPdf)} />
              </label>
            </div>
            <div style={{ padding: '0 0 6px' }} role="list" aria-label="Baris draf">
              {baris.length === 0 && <p className="catatan jendela-grup">Pilih CSV lulusan dan PDF-nya. Satu batch maksimal 50 baris.</p>}
              {baris.map((b) => (
                <div key={b.kunci} className="baris-item" role="listitem" data-testid="baris-draf" style={{ cursor: 'default' }}>
                  <span className="ikon" data-nada={KET[b.tahap].nada} aria-hidden="true">
                    {b.tahap === 'galat' ? '!' : b.tahap === 'terkirim' || b.tahap === 'siap' ? '✓' : b.tahap === 'menyegel' ? '◐' : '○'}
                  </span>
                  <span className="teks">
                    <span>
                      {b.nama} <span style={{ color: 'var(--ink3)' }}>{b.email && `· ${b.email}`}</span>
                    </span>
                    {b.tahap === 'menyegel' && (
                      <span className="progres">
                        <i style={{ width: '60%' }} />
                      </span>
                    )}
                  </span>
                  <span className="ket" data-nada={KET[b.tahap].nada} style={{ textAlign: 'right' }}>
                    {b.tahap === 'galat' ? b.pesan : KET[b.tahap].teks}
                  </span>
                </div>
              ))}
            </div>
            <div className="jendela-bar">
              <span className="kiri" data-testid="kabar" data-nada={kabar?.nada}>
                {kabar?.teks ?? `${bisaKirim} siap · ${jumlah('menyegel')} proses · ${jumlah('galat')} perlu diperbaiki`}
              </span>
              <span className="kanan">
                <button type="button" disabled={sibuk || bisaKirim === 0} onClick={() => void kirimCsv()}>
                  Kirim {bisaKirim} ke Meja Rektor <kbd>⌘</kbd>
                  <kbd>↵</kbd>
                </button>
              </span>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void kirimSatu(e)}>
            <div className="formulir">
              {(Object.keys(KOSONG) as (keyof typeof KOSONG)[]).map((k) => (
                <label key={k}>
                  {LABEL[k]}
                  <input
                    name={k}
                    required
                    type={k === 'email' ? 'email' : k === 'tanggal_lulus' ? 'date' : 'text'}
                    inputMode={k === 'nim' ? 'numeric' : undefined}
                    value={isian[k]}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setIsian((s) => ({ ...s, [k]: v }));
                    }}
                  />
                </label>
              ))}
              <label className="lebar">
                PDF ijazah
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  data-testid="pilih-pdf-satu"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) void f.arrayBuffer().then((b) => setPdfSatu(new Uint8Array(b)));
                  }}
                />
              </label>
            </div>
            <div className="jendela-bar">
              <span className="kiri" data-testid="kabar" data-nada={kabar?.nada}>
                {kabar?.teks ?? 'Data dienkripsi di peramban ini sebelum diunggah ke IPFS.'}
              </span>
              <span className="kanan">
                <button type="submit" disabled={sibuk || !pdfSatu}>
                  {ulang ? 'Kirim ulang ke Meja Rektor' : 'Kirim ke Meja Rektor'} <kbd>↵</kbd>
                </button>
              </span>
            </div>
          </form>
        )}
      </div>
    </Kerangka>
  );
}

export default function Unggah() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="operator">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
