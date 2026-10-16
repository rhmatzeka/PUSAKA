import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Jendela, { type Aksi, type Item } from '../components/Jendela';
import Kerangka, { DOK_OPERATOR } from '../components/Kerangka';
import LembarQr from '../components/LembarQr';
import Segel from '../components/Segel';
import { GalatApi, type Draf, type StatusDraf } from '../lib/api';
import { CHIP_STATUS, labelHari, nadaSegelDraf, tampilanDraf } from '../lib/buku-induk';
import { angka, ringkas, tanggal } from '../lib/format';
import { tautanBerkunci } from '../lib/tautan';
import { ambilTertunda, hapusTertunda, simpanTertunda, ulangiLaporan } from '../lib/laporan';
import { dataTerbitkan, MAKS_BATCH, pilihSiapDicatat } from '../lib/transaksi';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

interface Hitungan {
  tercatat: number;
  siap: number;
  menunggu: number;
}

function pesan(e: unknown): string {
  return e instanceof GalatApi || e instanceof Error ? e.message.split('\n')[0] ?? 'Gagal' : 'Gagal';
}

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [cari, setCari] = useState('');
  const [chip, setChip] = useState<'semua' | StatusDraf>('semua');
  const [daftar, setDaftar] = useState<Draf[]>([]);
  const [total, setTotal] = useState(0);
  const [hitung, setHitung] = useState<Hitungan>({ tercatat: 0, siap: 0, menunggu: 0 });
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [cabut, setCabut] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [qr, setQr] = useState<{ tautan: string; nama: string; nomor: string } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const jalan = useRef(false);

  const muat = useCallback(async () => {
    const kueri = { ...(chip === 'semua' ? {} : { status: chip }), cari };
    const [h, a, b, c] = await Promise.all([
      api.daftarDraf(kueri),
      api.daftarDraf({ status: 'TERBIT' }),
      api.daftarDraf({ status: 'DITANDATANGANI' }),
      api.daftarDraf({ status: 'MENUNGGU_TTD' }),
    ]);
    setDaftar(h.data);
    setTotal(h.total);
    setHitung({ tercatat: a.total, siap: b.total, menunggu: c.total });
    setTerpilih((t) => (t && h.data.some((d) => d.id === t) ? t : (h.data[0]?.id ?? null)));
  }, [api, chip, cari]);

  useEffect(() => {
    const t = setTimeout(() => void muat().catch((e: unknown) => setKabar({ teks: pesan(e), nada: 'bad' })), 200);
    return () => clearTimeout(t);
  }, [muat]);

  const d = daftar.find((x) => x.id === terpilih) ?? null;
  useEffect(() => {
    setCabut(false);
    setAlasan('');
    setKonfirmasi(false);
  }, [terpilih, chip]);

  // Transaksi yang sudah tercatat di blockchain tetapi belum sempat dilaporkan ke server.
  useEffect(() => {
    const t = ambilTertunda(sessionStorage);
    if (t?.jenis !== 'terbit') return;
    void ulangiLaporan(() => api.terbit(t.hash))
      .then((r) => {
        hapusTertunda(sessionStorage);
        setKabar({ teks: `Transaksi tertunda dilaporkan: ${r.terbit.length} ijazah tercatat`, nada: 'ok' });
        return muat();
      })
      .catch((e: unknown) => setKabar({ teks: `Transaksi ${t.hash.slice(0, 10)}… belum bisa dilaporkan: ${pesan(e)}`, nada: 'bad' }));
  }, [api, muat]);

  async function jalankan(label: string, kerja: () => Promise<string>) {
    if (jalan.current) return;
    jalan.current = true;
    setSibuk(true);
    setKonfirmasi(false);
    setKabar({ teks: `${label}…` });
    try {
      setKabar({ teks: await kerja(), nada: 'ok' });
      await muat();
    } catch (e) {
      setKabar({ teks: pesan(e), nada: 'bad' });
    } finally {
      jalan.current = false;
      setSibuk(false);
    }
  }

  const catat = () =>
    jalankan('Mengirim transaksi ke blockchain', async () => {
      const siap: Draf[] = [];
      for (let hal = 1; siap.length < MAKS_BATCH; hal++) {
        const h = await api.daftarDraf({ status: 'DITANDATANGANI', halaman: hal });
        siap.push(...h.data.filter((x) => x.ttd));
        if (h.data.length < h.per_halaman) break;
      }
      const { siap: berlaku, kedaluwarsa } = pilihSiapDicatat(siap);
      if (berlaku.length === 0) {
        throw new Error(
          kedaluwarsa.length
            ? `${kedaluwarsa.length} tanda tangan sudah (hampir) kedaluwarsa. Minta Rektor menandatangani ulang.`
            : 'Belum ada draf yang ditandatangani Rektor.',
        );
      }
      const batch = berlaku.slice(0, MAKS_BATCH);
      const penanda = await sesi.penanda();
      const hash = await penanda.kirim({ to: j.kontrak, data: dataTerbitkan(batch) }, (h) =>
        simpanTertunda(sessionStorage, { jenis: 'terbit', hash: h }),
      );
      const r = await ulangiLaporan(() => api.terbit(hash));
      hapusTertunda(sessionStorage);
      const lewat = kedaluwarsa.length ? ` (${kedaluwarsa.length} dilewati karena tanda tangan kedaluwarsa)` : '';
      return `${r.terbit.length} ijazah tercatat di blockchain${lewat}`;
    });

  async function tautanUntuk(x: Draf): Promise<string> {
    if (x.token_id === null) throw new Error('Ijazah belum tercatat');
    const { kunci } = await api.kunci(x.token_id);
    return tautanBerkunci(location.origin, x.token_id, kunci);
  }

  const nSiap = Math.min(hitung.siap, MAKS_BATCH);
  const minta: Aksi = { id: 'catat', label: `Catat ${nSiap} ijazah ke blockchain`, jalankan: () => setKonfirmasi(true) };
  const aksiUtama: Aksi | null = konfirmasi
    ? { id: 'ya', label: `Ya, catat ${nSiap} ijazah sekarang`, jalankan: () => void catat() }
    : !d
    ? null
    : d.status === 'DITANDATANGANI'
      ? minta
      : d.status === 'TERBIT' || d.status === 'DICABUT'
        ? {
            id: 'buka',
            label: 'Buka tautan ijazah',
            jalankan: () => void tautanUntuk(d).then((t) => window.open(t, '_blank', 'noopener,noreferrer')).catch((e: unknown) => setKabar({ teks: pesan(e), nada: 'bad' })),
          }
        : d.status === 'DITOLAK'
          ? { id: 'ulang', label: 'Perbaiki dan kirim ulang', jalankan: () => location.assign(`/op/unggah?ulang=${d.id}`) }
          : null;

  const aksi: Aksi[] = [];
  if (d?.status === 'TERBIT') {
    aksi.push(
      {
        id: 'qr',
        label: 'Lembar QR',
        jalankan: () => void tautanUntuk(d).then((t) => setQr({ tautan: t, nama: d.nama, nomor: d.nomor_ijazah })).catch((e: unknown) => setKabar({ teks: pesan(e), nada: 'bad' })),
      },
      {
        id: 'salin',
        label: 'Salin tautan berkunci',
        jalankan: () =>
          void tautanUntuk(d)
            .then((t) => navigator.clipboard?.writeText(t))
            .then(() => setKabar({ teks: 'Tautan berkunci disalin', nada: 'ok' }))
            .catch((e: unknown) => setKabar({ teks: pesan(e), nada: 'bad' })),
      },
      { id: 'cabut', label: 'Cabut ijazah…', bahaya: true, jalankan: () => setCabut(true) },
    );
  }
  if (hitung.siap > 0 && d?.status !== 'DITANDATANGANI') {
    aksi.push(minta);
  }
  aksi.push({ id: 'unggah', label: 'Unggah draf baru', jalankan: () => location.assign('/op/unggah') });

  const item: Item[] = useMemo(
    () =>
      daftar.map((x) => {
        const t = tampilanDraf(x);
        return { id: x.id, judul: x.nama, ket: t.ket, nada: t.nada, ikon: t.ikon, coret: t.coret, grup: labelHari(x.dibuat) };
      }),
    [daftar],
  );

  const detail = d ? (
    <>
      <div style={{ width: 150, margin: '0 auto' }}>
        <Segel nada={nadaSegelDraf(d.status)} />
      </div>
      <div className="hud">Informasi</div>
      <dl className="data" style={{ marginTop: 6 }}>
        <dt>NIM</dt>
        <dd className="mono">{d.nim}</dd>
        <dt>Prodi</dt>
        <dd>{d.prodi}</dd>
        <dt>Nomor ijazah</dt>
        <dd className="mono">{d.nomor_ijazah}</dd>
        <dt>Email</dt>
        <dd>{d.email}</dd>
        <dt>Sidik jari</dt>
        <dd className="mono">{ringkas(d.doc_hash)}</dd>
        <dt>Penerima</dt>
        <dd className="mono">{ringkas(d.penerima)}</dd>
        {d.ttd && (
          <>
            <dt>Ditandatangani</dt>
            <dd>Berlaku s.d. {tanggal(d.ttd.batas_waktu)}</dd>
          </>
        )}
        {d.alasan_tolak && (
          <>
            <dt>Alasan tolak</dt>
            <dd data-nada="bad">{d.alasan_tolak}</dd>
          </>
        )}
      </dl>
      {cabut && (
        <form
          className="panel-isian"
          onSubmit={(e) => {
            e.preventDefault();
            if (d.token_id === null) return;
            const t = d.token_id;
            void jalankan('Mengirim permintaan cabut', async () => {
              await api.mintaCabut(t, alasan);
              setCabut(false);
              return 'Permintaan cabut dikirim ke Meja Rektor';
            });
          }}
        >
          <label>
            <span className="sub">Alasan pencabutan (dicatat permanen di blockchain)</span>
            <textarea rows={3} required maxLength={500} value={alasan} onChange={(e) => setAlasan(e.currentTarget.value)} />
          </label>
          <div className="aksi" style={{ marginTop: 0 }}>
            <button type="submit" className="br" data-utama disabled={sibuk}>
              Minta pencabutan
            </button>
            <button type="button" className="br" onClick={() => setCabut(false)}>
              Batal
            </button>
          </div>
        </form>
      )}
    </>
  ) : (
    <p className="catatan">Pilih ijazah di daftar untuk melihat rinciannya.</p>
  );

  return (
    <Kerangka
      peran="Pusaka Operator"
      kode="PSK-OP"
      status="BAAK · Aktif"
      wallet={info.wallet[0]}
      skala={[`${angka(hitung.tercatat)} tercatat`, `${angka(hitung.siap)} siap`, `${angka(hitung.menunggu)} menunggu`]}
      dok={DOK_OPERATOR}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <Jendela
        cari={cari}
        onCari={setCari}
        petunjuk="Cari nama, NIM, atau nomor ijazah…"
        chip={CHIP_STATUS}
        chipAktif={chip}
        onChip={(c) => setChip(c as 'semua' | StatusDraf)}
        item={item}
        terpilih={terpilih}
        onPilih={setTerpilih}
        detail={detail}
        judulBar={
          <span data-testid="kabar" data-nada={kabar?.nada}>
            {kabar?.teks ?? `Buku Induk · ${angka(total)} ijazah`}
          </span>
        }
        aksiUtama={sibuk ? null : aksiUtama}
        aksi={sibuk ? [] : aksi}
        kosong={cari || chip !== 'semua' ? 'Tidak ada ijazah yang cocok.' : 'Belum ada draf. Mulai dari Unggah draf.'}
      />
      {qr && <LembarQr {...qr} tutup={() => setQr(null)} />}
    </Kerangka>
  );
}

export default function BukuInduk() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="operator">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
