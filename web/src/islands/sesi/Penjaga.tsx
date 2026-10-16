import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buatApi, GalatApi, type Api, type InfoSesi } from '../../lib/api';
import { jaringan, type Jaringan } from '../../lib/konfigurasi';
import { tujuanPeran } from '../../lib/peran';
import type { Sesi } from '../../lib/sesi';
import { useSesi } from './konteks';

export interface Aplikasi {
  api: Api;
  info: InfoSesi;
  sesi: Sesi;
  j: Jaringan;
}

const KonteksAplikasi = createContext<Aplikasi | null>(null);

export function useAplikasi(): Aplikasi {
  const a = useContext(KonteksAplikasi);
  if (!a) throw new Error('useAplikasi di luar Penjaga');
  return a;
}

const NAMA_PERAN = { operator: 'operator BAAK', penandatangan: 'pejabat penanda tangan', masuk: 'pengguna yang sudah masuk' };

type Keadaan = { tahap: 'memuat' } | { tahap: 'siap'; info: InfoSesi } | { tahap: 'galat'; pesan: string };

/** Menunggu sesi, membaca peran dari API, lalu hanya menampilkan isi bila perannya cocok. */
export default function Penjaga({ perlu, children }: { perlu: 'operator' | 'penandatangan' | 'masuk'; children: ReactNode }) {
  const sesi = useSesi();
  const api = useMemo(() => buatApi(() => sesi.token()), [sesi]);
  const [k, setK] = useState<Keadaan>({ tahap: 'memuat' });

  useEffect(() => {
    if (sesi.status === 'memuat') return;
    if (sesi.status === 'keluar') {
      location.assign(`/masuk?ke=${encodeURIComponent(location.pathname)}`);
      return;
    }
    let batal = false;
    api
      .sesi()
      .then((info) => !batal && setK({ tahap: 'siap', info }))
      .catch((e: unknown) => {
        if (batal) return;
        if (e instanceof GalatApi && e.status === 401) {
          location.assign(`/masuk?ke=${encodeURIComponent(location.pathname)}`);
          return;
        }
        setK({ tahap: 'galat', pesan: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      batal = true;
    };
  }, [sesi.status, api]);

  if (k.tahap === 'memuat') {
    return (
      <div className="aplikasi">
        <div className="hud">
          PSK<b>Memeriksa sesi…</b>
        </div>
      </div>
    );
  }
  if (k.tahap === 'galat') {
    return (
      <div className="aplikasi">
        <div className="hud">
          PSK<b data-nada="bad">! Sesi gagal dibaca</b>
        </div>
        <p className="catatan">{k.pesan}</p>
      </div>
    );
  }
  const boleh = perlu === 'masuk' || k.info.peran[perlu];
  if (!boleh) {
    return (
      <div className="aplikasi" data-siap="">
        <div className="hud">
          PSK<b data-nada="bad">✕ Bukan untuk akun ini</b>
        </div>
        <h1 className="judul">Halaman ini untuk {NAMA_PERAN[perlu]}</h1>
        <p className="catatan">
          Wallet akun ini tidak memegang peran itu di kontrak PUSAKA. Bila seharusnya punya, minta admin rektorat memberikan
          perannya.
        </p>
        <div className="aksi">
          <a className="br" data-utama href={tujuanPeran(k.info.peran)}>
            Ke halaman saya
          </a>
          <button type="button" className="br" onClick={() => void sesi.keluar().then(() => location.assign('/masuk'))}>
            Keluar
          </button>
        </div>
      </div>
    );
  }
  return <KonteksAplikasi.Provider value={{ api, info: k.info, sesi, j: jaringan() }}>{children}</KonteksAplikasi.Provider>;
}
