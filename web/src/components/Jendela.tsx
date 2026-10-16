import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type Nada = 'ok' | 'bad' | 'tunggu' | 'biru' | 'redup';

export interface Item {
  id: string;
  judul: string;
  ket: string;
  nada: Nada;
  ikon: string;
  grup?: string;
  coret?: boolean;
}

export interface Aksi {
  id: string;
  label: string;
  jalankan: () => void;
  bahaya?: boolean;
}

export interface Chip {
  id: string;
  label: string;
}

/**
 * Jendela perintah gaya Raycast: kotak cari + chip, daftar kiri, detail kanan, bilah bawah dengan aksi utama (↵)
 * dan menu aksi (⌘K / Ctrl+K). `/` memindahkan fokus ke kotak cari; ↑/↓ memilih baris.
 */
export default function Jendela({
  cari,
  onCari,
  petunjuk,
  chip,
  chipAktif,
  onChip,
  item,
  terpilih,
  onPilih,
  detail,
  judulBar,
  aksiUtama,
  aksi,
  kosong,
}: {
  cari: string;
  onCari: (s: string) => void;
  petunjuk: string;
  chip: Chip[];
  chipAktif: string;
  onChip: (id: string) => void;
  item: Item[];
  terpilih: string | null;
  onPilih: (id: string) => void;
  detail: ReactNode;
  judulBar: ReactNode;
  aksiUtama: Aksi | null;
  aksi: Aksi[];
  kosong: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [pilihMenu, setPilihMenu] = useState(0);
  const kotak = useRef<HTMLInputElement>(null);
  const akar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const garis = (e: globalThis.KeyboardEvent) => {
      const mengetik = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !mengetik) {
        e.preventDefault();
        kotak.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPilihMenu(0);
        setMenu((m) => !m);
      }
    };
    window.addEventListener('keydown', garis);
    return () => window.removeEventListener('keydown', garis);
  }, []);

  function tekan(e: KeyboardEvent) {
    if (e.target instanceof HTMLTextAreaElement) return;
    if (menu) {
      if (e.key === 'Escape') setMenu(false);
      if (e.key === 'ArrowDown') setPilihMenu((i) => Math.min(i + 1, aksi.length - 1));
      if (e.key === 'ArrowUp') setPilihMenu((i) => Math.max(i - 1, 0));
      if (e.key === 'Enter') {
        e.preventDefault();
        const a = aksi[pilihMenu];
        setMenu(false);
        a?.jalankan();
      }
      return;
    }
    const i = item.findIndex((x) => x.id === terpilih);
    if (e.key === 'ArrowDown' && item.length) {
      e.preventDefault();
      onPilih(item[Math.min(i + 1, item.length - 1)]?.id ?? item[0]!.id);
    }
    if (e.key === 'ArrowUp' && item.length) {
      e.preventDefault();
      onPilih(item[Math.max(i - 1, 0)]?.id ?? item[0]!.id);
    }
    // Enter di kotak cari, tombol, atau tautan tidak boleh menjalankan aksi utama (bisa berupa transaksi).
    const diKendali =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement ||
      e.target instanceof HTMLAnchorElement;
    if (e.key === 'Enter' && aksiUtama && !diKendali) {
      e.preventDefault();
      aksiUtama.jalankan();
    }
  }

  let grupTerakhir = '';
  return (
    <div className="jendela" ref={akar} onKeyDown={tekan}>
      <div className="jendela-cari">
        <span aria-hidden="true">⌕</span>
        <input
          ref={kotak}
          value={cari}
          onChange={(e) => onCari(e.currentTarget.value)}
          placeholder={petunjuk}
          aria-label={petunjuk}
        />
        {chip.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={chipAktif === c.id} onClick={() => onChip(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="jendela-isi">
        <div className="jendela-daftar" role="listbox" aria-label="Daftar">
          {item.length === 0 && <div className="jendela-grup catatan">{kosong}</div>}
          {item.map((x) => {
            const judulGrup = x.grup && x.grup !== grupTerakhir ? x.grup : null;
            if (x.grup) grupTerakhir = x.grup;
            return (
              <div key={x.id}>
                {judulGrup && <div className="hud jendela-grup">{judulGrup}</div>}
                <button
                  type="button"
                  role="option"
                  className="baris-item"
                  aria-selected={x.id === terpilih}
                  data-coret={x.coret ? '' : undefined}
                  onClick={() => onPilih(x.id)}
                  onDoubleClick={() => aksiUtama?.jalankan()}
                >
                  <span className="ikon" data-nada={x.nada} aria-hidden="true">
                    {x.ikon}
                  </span>
                  <span className="teks">
                    <span>{x.judul}</span>
                    <span className="ket" data-nada={x.nada}>
                      {x.ket}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="jendela-detail">{detail}</div>
      </div>
      <div className="jendela-bar">
        <span className="kiri">{judulBar}</span>
        <span className="kanan">
          {aksiUtama && (
            <button type="button" onClick={aksiUtama.jalankan}>
              {aksiUtama.label} <kbd>↵</kbd>
            </button>
          )}
          {aksi.length > 0 && (
            <button type="button" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              Aksi <kbd>⌘</kbd>
              <kbd>K</kbd>
            </button>
          )}
        </span>
      </div>
      {menu && (
        <div className="menu-aksi" role="menu">
          {aksi.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              aria-selected={i === pilihMenu}
              data-bahaya={a.bahaya ? '' : undefined}
              onMouseEnter={() => setPilihMenu(i)}
              onClick={() => {
                setMenu(false);
                a.jalankan();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
