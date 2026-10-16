import { useLoginWithEmail, useLoginWithOAuth, useLoginWithSiwe, usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, type FormEvent } from 'react';
import { AKUN_UJI, masukUji, type PeranUji } from '../lib/akun-uji';
import { buatApi } from '../lib/api';
import { ingatDompet, temukanDompet, type DompetPeramban } from '../lib/eip6963';
import { jaringan } from '../lib/konfigurasi';
import { tujuanAman, tujuanPeran } from '../lib/peran';
import type { Sesi } from '../lib/sesi';
import { useSesi } from './sesi/konteks';
import PenyediaSesi, { MODE_UJI } from './sesi/PenyediaSesi';

async function arahkan(sesi: Sesi) {
  const info = await buatApi(() => sesi.token()).sesi();
  location.assign(tujuanAman(new URLSearchParams(location.search).get('ke')) ?? tujuanPeran(info.peran));
}

function pesanGalat(e: unknown): string {
  return e instanceof Error ? e.message : 'Gagal masuk. Coba lagi.';
}

function PanelEmail({ setGalat }: { setGalat: (s: string) => void }) {
  const { sendCode, loginWithCode, state } = useLoginWithEmail({ onError: (e) => setGalat(String(e)) });
  const [email, setEmail] = useState('');
  const [kode, setKode] = useState('');
  const menunggu = state.status === 'awaiting-code-input' || state.status === 'submitting-code';

  function kirim(e: FormEvent) {
    e.preventDefault();
    if (menunggu) void loginWithCode({ code: kode }).catch((x: unknown) => setGalat(pesanGalat(x)));
    else void sendCode({ email }).catch((x: unknown) => setGalat(pesanGalat(x)));
  }

  return (
    <form className="panel-isian" onSubmit={kirim}>
      {menunggu ? (
        <label>
          <span className="sub">Kode 6 angka dikirim ke {email}</span>
          <input inputMode="numeric" autoComplete="one-time-code" value={kode} onChange={(e) => setKode(e.currentTarget.value)} required />
        </label>
      ) : (
        <label>
          <span className="sub">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
        </label>
      )}
      <button type="submit" className="tombol-penuh" disabled={state.status === 'sending-code' || state.status === 'submitting-code'}>
        {menunggu ? 'Masuk' : 'Kirim kode'}
      </button>
    </form>
  );
}

function PanelPrivy() {
  const { initOAuth } = useLoginWithOAuth();
  const { generateSiweMessage, loginWithSiwe } = useLoginWithSiwe();
  const { login } = usePrivy();
  const [email, setEmail] = useState(false);
  const [dompet, setDompet] = useState<DompetPeramban[] | null>(null);
  const [galat, setGalat] = useState('');
  const j = jaringan();

  useEffect(() => {
    void temukanDompet().then(setDompet);
  }, []);

  async function denganDompet(d: DompetPeramban) {
    setGalat('');
    try {
      const [alamat] = (await d.provider.request({ method: 'eth_requestAccounts' })) as `0x${string}`[];
      if (!alamat) throw new Error('Wallet tidak memberikan alamat.');
      const pesan = await generateSiweMessage({ address: alamat, chainId: `eip155:${j.chainId}` });
      const signature = (await d.provider.request({ method: 'personal_sign', params: [pesan, alamat] })) as string;
      await loginWithSiwe({ message: pesan, signature });
      ingatDompet(d.rdns);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  const oauth = (provider: 'google' | 'apple' | 'twitter' | 'discord') => {
    setGalat('');
    void initOAuth({ provider }).catch((e: unknown) => setGalat(pesanGalat(e)));
  };

  return (
    <div className="masuk">
      <section className="panel" aria-labelledby="judul-masuk">
        <h2 id="judul-masuk">Masuk</h2>
        <button type="button" className="tombol-penuh" data-utama onClick={() => oauth('google')}>
          Lanjut dengan Google
        </button>
        <div className="kisi-masuk">
          <button type="button" className="tombol-penuh" aria-expanded={email} onClick={() => setEmail((x) => !x)}>
            Email
          </button>
          <button type="button" className="tombol-penuh" onClick={() => oauth('apple')}>
            Apple
          </button>
          <button type="button" className="tombol-penuh" onClick={() => oauth('twitter')}>
            X
          </button>
          <button type="button" className="tombol-penuh" onClick={() => oauth('discord')}>
            Discord
          </button>
        </div>
        {email && <PanelEmail setGalat={setGalat} />}
        <p className="catatan">Alumni masuk dengan email yang didaftarkan kampus; wallet ijazah dibuatkan otomatis.</p>
        {galat && (
          <p className="catatan" data-nada="bad" role="alert">
            {galat}
          </p>
        )}
      </section>
      <section className="panel" aria-labelledby="judul-wallet">
        <h2 id="judul-wallet">Hubungkan wallet</h2>
        <div className="daftar-dompet">
          {dompet === null && <p className="catatan">Mencari wallet di peramban…</p>}
          {dompet?.map((d) => (
            <button key={d.uuid} type="button" className="tombol-penuh" onClick={() => void denganDompet(d)}>
              <img src={d.ikon} alt="" /> {d.nama}
            </button>
          ))}
          {dompet?.length === 0 && (
            <p className="catatan">Tidak ada wallet di peramban ini. Pasang MetaMask, atau pakai wallet ponsel lewat WalletConnect.</p>
          )}
          <button type="button" className="tombol-penuh" onClick={() => login({ loginMethods: ['wallet'] })}>
            Wallet lain (WalletConnect)
          </button>
        </div>
        <p className="catatan">Operator BAAK dan pejabat memakai wallet yang perannya terdaftar di kontrak.</p>
      </section>
    </div>
  );
}

function PanelUji() {
  return (
    <div className="masuk">
      <section className="panel" aria-labelledby="judul-uji">
        <h2 id="judul-uji">Akun uji (Anvil lokal)</h2>
        <div className="daftar-dompet">
          {(Object.keys(AKUN_UJI) as PeranUji[]).map((p) => (
            <button
              key={p}
              type="button"
              className="tombol-penuh"
              onClick={() => {
                masukUji(p);
                location.reload();
              }}
            >
              Masuk sebagai {AKUN_UJI[p].label}
            </button>
          ))}
        </div>
        <p className="catatan">Build ini khusus pengujian; token dan wallet memakai kunci tes publik.</p>
      </section>
    </div>
  );
}

function Isi() {
  const sesi = useSesi();
  const [galat, setGalat] = useState('');
  useEffect(() => {
    if (sesi.status === 'masuk') void arahkan(sesi).catch((e: unknown) => setGalat(pesanGalat(e)));
  }, [sesi]);
  return (
    <div data-siap={sesi.status === 'memuat' ? undefined : ''}>
      {MODE_UJI ? <PanelUji /> : <PanelPrivy />}
      {galat && (
        <p className="catatan" data-nada="bad" role="alert" style={{ textAlign: 'center' }}>
          {galat}
        </p>
      )}
    </div>
  );
}

export default function Masuk() {
  return (
    <PenyediaSesi>
      <Isi />
    </PenyediaSesi>
  );
}
