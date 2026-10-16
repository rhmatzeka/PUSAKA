import { useEffect } from 'react';
import { renderSVG } from 'uqr';

/** Lembar QR siap cetak berisi tautan berkunci satu ijazah. QR dibuat lokal; tidak ada layanan luar. */
export default function LembarQr({ tautan, nama, nomor, tutup }: { tautan: string; nama: string; nomor: string; tutup: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && tutup();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [tutup]);
  return (
    <div className="lembar" role="dialog" aria-modal="true" aria-label={`Lembar QR ${nama}`}>
      <div className="lembar-isi">
        <p style={{ margin: 0, fontWeight: 600 }}>Ijazah Universitas Pamulang</p>
        <p style={{ margin: '4px 0 12px' }}>
          {nama} · {nomor}
        </p>
        {/* SVG dibuat uqr dari tautan kita sendiri, bukan masukan pengguna. */}
        <div data-testid="qr" dangerouslySetInnerHTML={{ __html: renderSVG(tautan, { ecc: 'M', border: 2 }) }} />
        <p className="url" data-testid="tautan-qr">
          {tautan}
        </p>
        <p style={{ fontSize: 12, margin: '10px 0 0' }}>Pindai untuk memeriksa ijazah. Tautan ini membawa kunci berkas; simpan seperti dokumen asli.</p>
      </div>
      <div className="aksi" style={{ justifyContent: 'center' }}>
        <button type="button" className="br" data-utama onClick={() => window.print()}>
          Cetak lembar
        </button>
        <button type="button" className="br" onClick={tutup}>
          Tutup
        </button>
      </div>
    </div>
  );
}
