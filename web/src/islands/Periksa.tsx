import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import BarisBukti from '../components/BarisBukti';
import Segel, { type NadaSegel } from '../components/Segel';
import { ringkas, tanggal } from '../lib/format';
import type { HasilBerkas } from '../lib/jenis';
import { jaringan } from '../lib/konfigurasi';
import { buatSumber } from '../lib/sumber';
import { STATUS, pesanGalat } from '../lib/tampilan';
import { cekBerkas } from '../lib/verifikasi';
import PindaiQr from './PindaiQr';

/** Ijazah PUSAKA selalu di bawah 4 MiB; batas ini hanya mencegah peramban menghitung berkas raksasa. */
export const MAKS_PDF = 8 * 1024 * 1024;

type Keadaan =
  | { tahap: 'siap' }
  | { tahap: 'menghitung'; nama: string }
  | { tahap: 'hasil'; nama: string; hasil: HasilBerkas }
  | { tahap: 'galat'; pesan: string };

type Panel = 'tidak-ada' | 'token' | 'qr';

function HasilBerkasView({ nama, hasil, ulang }: { nama: string; hasil: HasilBerkas; ulang: () => void }) {
  if (hasil.jenis === 'tidak-ada') {
    const t = STATUS.TIDAK_ADA;
    return (
      <>
        <div className="hud">
          PSK-VR
          <b data-nada={t.nada} data-testid="status">
            {t.simbol} {t.kata}
          </b>
        </div>
        <h1 className="judul">Tidak tercatat</h1>
        <p className="sub">{nama}</p>
        <BarisBukti
          bukti={[
            { ikon: '⌗', nama: 'Sidik jari berkas', ket: '✕ Tidak ada di blockchain', nada: 'bad', nilai: ringkas(hasil.docHash) },
          ]}
        />
        <p className="catatan">
          Berkas ini tidak cocok dengan ijazah mana pun yang diterbitkan lewat PUSAKA. Satu bita yang berubah sudah cukup
          membuat sidik jarinya berbeda.
        </p>
        <div className="aksi">
        <button type="button" className="br" onClick={ulang}>
          Periksa berkas lain
        </button>
        </div>
      </>
    );
  }
  const t = STATUS[hasil.status];
  const dicabut = hasil.status === 'DICABUT';
  return (
    <>
      <div className="hud">
        PSK-{hasil.tokenId.toString()}
        <b data-nada={t.nada} data-testid="status">
          {t.simbol} {t.kata}
        </b>
      </div>
      <h1 className="judul">Ijazah #{hasil.tokenId.toString()}</h1>
      <p className="sub">Diterbitkan {tanggal(hasil.ijazah.waktuTerbit)}</p>
      <BarisBukti
        bukti={[
          { ikon: '⌗', nama: 'Sidik jari berkas', ket: '↑ Cocok 100%', nada: 'ok', nilai: ringkas(hasil.docHash) },
          { ikon: '✍', nama: 'Tanda tangan Rektor', ket: '↑ Sah · EIP-712', nada: 'ok', nilai: ringkas(hasil.ijazah.penandaTangan) },
          dicabut
            ? { ikon: '⛓', nama: 'Status di blockchain', ket: `↓ Dicabut ${tanggal(hasil.ijazah.waktuCabut)}`, nada: 'bad' }
            : { ikon: '⛓', nama: 'Status di blockchain', ket: '↑ Tidak dicabut', nada: 'ok' },
        ]}
      />
      <p className="catatan">
        {dicabut
          ? 'Ijazah ini sudah dicabut universitas dan tidak berlaku lagi.'
          : 'Nama dan data lulusan tidak disimpan terbuka. Untuk melihatnya, buka tautan atau QR berkunci dari pemilik ijazah.'}
      </p>
      <div className="aksi">
        <a className="br" data-utama href={`/i/${hasil.tokenId.toString()}`}>
          Lihat rincian ijazah #{hasil.tokenId.toString()}
        </a>
        <button type="button" className="br" onClick={ulang}>
          Periksa berkas lain
        </button>
      </div>
    </>
  );
}

export default function Periksa() {
  const [k, setK] = useState<Keadaan>({ tahap: 'siap' });
  const [seret, setSeret] = useState(false);
  const [panel, setPanel] = useState<Panel>('tidak-ada');
  const [nomor, setNomor] = useState('');
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);

  async function periksa(f: File) {
    if (f.size > MAKS_PDF) {
      setK({ tahap: 'galat', pesan: 'Berkas lebih dari 8 MB. Ijazah PUSAKA selalu di bawah 4 MB; pastikan ini PDF ijazahnya.' });
      return;
    }
    setK({ tahap: 'menghitung', nama: f.name });
    try {
      const s = await buatSumber(jaringan());
      setK({ tahap: 'hasil', nama: f.name, hasil: await cekBerkas(new Uint8Array(await f.arrayBuffer()), s) });
    } catch (e) {
      setK({ tahap: 'galat', pesan: pesanGalat(e) });
    }
  }

  function jatuhkan(e: DragEvent) {
    e.preventDefault();
    setSeret(false);
    const f = e.dataTransfer.files[0];
    if (f) void periksa(f);
  }

  function bukaToken(e: FormEvent) {
    e.preventDefault();
    if (/^\d{1,20}$/.test(nomor)) location.assign(`/i/${nomor}`);
  }

  const nada: NadaSegel = seret
    ? 'seret'
    : k.tahap === 'hasil'
      ? k.hasil.jenis === 'ada'
        ? STATUS[k.hasil.status].nada
        : 'bad'
      : k.tahap === 'menghitung'
        ? 'tunggu'
        : 'diam';

  return (
    <div className="panggung" data-siap={siap ? '' : undefined}>
      <section aria-label="Periksa berkas">
        <div className="hud">
          PSK-VR<b>{k.tahap === 'menghitung' ? 'Menghitung sidik jari…' : 'Letakkan PDF'}</b>
        </div>
        <label
          className="pilih-pdf"
          onDragOver={(e) => {
            e.preventDefault();
            setSeret(true);
          }}
          onDragLeave={() => setSeret(false)}
          onDrop={jatuhkan}
        >
          <input
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void periksa(f);
              e.currentTarget.value = '';
            }}
          />
          <Segel nada={nada}>
            <span className="hud">
              Tarik PDF
              <br />
              ke segel
              <b>atau pilih berkas</b>
            </span>
          </Segel>
        </label>
        <div className="aksi" style={{ justifyContent: 'center' }}>
          <button type="button" className="br" aria-expanded={panel === 'qr'} onClick={() => setPanel(panel === 'qr' ? 'tidak-ada' : 'qr')}>
            Pindai QR
          </button>
          <button type="button" className="br" aria-expanded={panel === 'token'} onClick={() => setPanel(panel === 'token' ? 'tidak-ada' : 'token')}>
            Nomor token
          </button>
        </div>
        {panel === 'token' && (
          <form onSubmit={bukaToken}>
            <label className="isian">
              <span className="sr-only">Nomor token ijazah</span>
              <span className="hud" aria-hidden="true">
                #
              </span>
              <input
                inputMode="numeric"
                pattern="\d{1,20}"
                autoFocus
                required
                placeholder="Nomor token, misalnya 1284"
                value={nomor}
                onChange={(e) => setNomor(e.currentTarget.value.replace(/\D/g, ''))}
              />
              <button type="submit" className="br">
                Buka
              </button>
            </label>
          </form>
        )}
        {panel === 'qr' && <PindaiQr tutup={() => setPanel('tidak-ada')} />}
      </section>

      <section className="panggung-kanan" aria-live="polite">
        {k.tahap === 'hasil' ? (
          <HasilBerkasView nama={k.nama} hasil={k.hasil} ulang={() => setK({ tahap: 'siap' })} />
        ) : k.tahap === 'galat' ? (
          <>
            <div className="hud">
              PSK-VR<b data-nada="bad">! Gagal memeriksa</b>
            </div>
            <p className="catatan">{k.pesan}</p>
          </>
        ) : (
          <>
            <div className="hud">
              PSK-VR<b>{k.tahap === 'menghitung' ? k.nama : 'Siap memeriksa'}</b>
            </div>
            <h1 className="judul">Periksa ijazah</h1>
            <p className="sub">Unggah PDF ijazah, pindai QR-nya, atau masukkan nomor token.</p>
            <p className="catatan">
              Berkas tidak dikirim ke mana pun. Sidik jarinya dihitung di peramban ini lalu dicocokkan dengan catatan di
              blockchain Polygon, tanpa melewati server PUSAKA.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
