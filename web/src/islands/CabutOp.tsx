import { useCallback, useEffect, useState } from 'react';
import Kerangka, { DOK_OPERATOR } from '../components/Kerangka';
import type { PermintaanCabut } from '../lib/api';
import { tanggal } from '../lib/format';
import { dataCabut } from '../lib/transaksi';
import PenyediaSesi from './sesi/PenyediaSesi';
import Penjaga, { useAplikasi } from './sesi/Penjaga';

const STATUS = {
  MENUNGGU_TTD: { ket: '○ Menunggu tanda tangan Rektor', nada: 'tunggu' },
  DITANDATANGANI: { ket: '◆ Ditandatangani · siap dikirim', nada: 'biru' },
  SELESAI: { ket: '↓ Dicabut di blockchain', nada: 'bad' },
} as const;

function Isi() {
  const { api, info, sesi, j } = useAplikasi();
  const [daftar, setDaftar] = useState<PermintaanCabut[]>([]);
  const [kabar, setKabar] = useState<{ teks: string; nada?: 'ok' | 'bad' } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => setDaftar((await api.daftarCabut()).data), [api]);
  useEffect(() => {
    void muat().catch((e: unknown) => setKabar({ teks: e instanceof Error ? e.message : String(e), nada: 'bad' }));
  }, [muat]);

  async function kirim(c: PermintaanCabut) {
    setSibuk(true);
    setKabar({ teks: `Mengirim pencabutan #${c.token_id} ke blockchain…` });
    try {
      const p = await sesi.penanda();
      const hash = await p.kirim({ to: j.kontrak, data: dataCabut(c) });
      await api.selesaiCabut(c.id, hash);
      setKabar({ teks: `Ijazah #${c.token_id} dicabut. Semua jalur verifikasi kini menampilkan DICABUT.`, nada: 'ok' });
      await muat();
    } catch (e) {
      setKabar({ teks: e instanceof Error ? (e.message.split('\n')[0] ?? 'Gagal') : String(e), nada: 'bad' });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Kerangka
      peran="Pusaka Operator"
      kode="PSK-OP"
      status="Pencabutan"
      wallet={info.wallet[0]}
      dok={DOK_OPERATOR}
      keluar={() => void sesi.keluar().then(() => location.assign('/masuk'))}
    >
      <div className="jendela">
        <div className="jendela-cari">
          <span aria-hidden="true">⛓</span>
          <span>Permintaan pencabutan</span>
          <span className="hud" style={{ marginLeft: 'auto' }}>
            {daftar.length} permintaan
          </span>
        </div>
        <div style={{ padding: '6px 0' }}>
          {daftar.length === 0 && <p className="catatan jendela-grup">Belum ada permintaan. Cabut ijazah dari Buku Induk lewat menu Aksi.</p>}
          {daftar.map((c) => (
            <div key={c.id} className="baris-item" style={{ cursor: 'default' }} data-testid="baris-cabut">
              <span className="ikon" data-nada={STATUS[c.status].nada} aria-hidden="true">
                ⛓
              </span>
              <span className="teks">
                <span>
                  {c.nama} · #{c.token_id}
                </span>
                <span className="ket" data-nada={STATUS[c.status].nada}>
                  {STATUS[c.status].ket} · {tanggal(Date.parse(c.dibuat) / 1000)}
                </span>
              </span>
              {c.status === 'DITANDATANGANI' && (
                <button type="button" className="br" data-utama disabled={sibuk} onClick={() => void kirim(c)}>
                  Kirim pencabutan ke blockchain
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="jendela-bar">
          <span className="kiri" data-testid="kabar" data-nada={kabar?.nada}>
            {kabar?.teks ?? 'Alasan pencabutan ikut dicatat permanen di blockchain.'}
          </span>
        </div>
      </div>
    </Kerangka>
  );
}

export default function CabutOp() {
  return (
    <PenyediaSesi>
      <Penjaga perlu="operator">
        <Isi />
      </Penjaga>
    </PenyediaSesi>
  );
}
