import { useEffect, useRef, useState } from 'react';
import { tautanIjazah } from '../lib/jalur';

interface Deteksi {
  rawValue: string;
}
interface Pendeteksi {
  detect(sumber: CanvasImageSource): Promise<Deteksi[]>;
}
type KelasPendeteksi = new (opsi: { formats: string[] }) => Pendeteksi;

const KelasBarcode = (globalThis as { BarcodeDetector?: KelasPendeteksi }).BarcodeDetector;

/** Pindai QR lewat kamera (BarcodeDetector). Peramban tanpa dukungan diarahkan ke aplikasi kamera ponsel. */
export default function PindaiQr({ tutup }: { tutup: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [pesan, setPesan] = useState(
    KelasBarcode ? 'Arahkan kamera ke QR di ijazah.' : 'Peramban ini tidak bisa memindai QR. Buka aplikasi kamera ponsel dan arahkan ke QR; tautannya langsung membuka halaman hasil.',
  );

  useEffect(() => {
    if (!KelasBarcode) return;
    const pendeteksi = new KelasBarcode({ formats: ['qr_code'] });
    let aliran: MediaStream | null = null;
    let jalan = true;
    (async () => {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = video.current;
        // Panel bisa sudah ditutup saat izin kamera masih ditunggu: matikan aliran yang baru dibuka.
        if (!v || !jalan) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        v.srcObject = aliran;
        await v.play();
        while (jalan) {
          const [hasil] = await pendeteksi.detect(v);
          if (hasil) {
            const tautan = tautanIjazah(hasil.rawValue, location.origin);
            if (tautan) {
              location.assign(tautan);
              return;
            }
            setPesan('QR ini bukan tautan ijazah PUSAKA.');
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setPesan('Kamera tidak bisa dibuka. Izinkan akses kamera atau masukkan nomor token.');
      }
    })();
    return () => {
      jalan = false;
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      {KelasBarcode && <video ref={video} className="kamera" muted playsInline />}
      <p className="catatan">{pesan}</p>
      <div className="aksi">
        <button type="button" className="br" onClick={tutup}>
          Tutup kamera
        </button>
      </div>
    </div>
  );
}
