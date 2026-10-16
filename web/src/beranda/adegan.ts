//! Adegan three.js beranda: Segel Pusaka dan inti kristal. `atur(p)` menghitung seluruh keadaan
//! dari progres scroll 0..1 (tanpa timeline tersimpan), sehingga lompat ke titik mana pun konsisten.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { halus, lokal } from './babak';

export interface Adegan {
  atur(p: number): void;
  render(): void;
  ukur(lebar: number, tinggi: number): void;
  buang(): void;
}

/** Heksagon datar atas-bawah, sedikit melebar (siluet segel). */
function heksagon(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = Math.cos(a) * r * 1.12;
    const y = Math.sin(a) * r * 0.9;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

const acak = (() => {
  let s = 20261016;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
})();

export function buatAdegan(kanvas: HTMLCanvasElement): Adegan {
  const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Transmisi kaca menambah satu lintasan render; di layar kecil DPR dibatasi lebih rendah.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const adegan = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  adegan.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  kamera.position.set(0, 0, 11);

  adegan.add(new THREE.AmbientLight(0x6f8cff, 0.35));
  const kunci = new THREE.DirectionalLight(0xbfd6ff, 1.4);
  kunci.position.set(-4, 5, 6);
  adegan.add(kunci);

  // ------------------------------------------------------------ segel (dua keping + tombol)
  const segel = new THREE.Group();
  adegan.add(segel);
  const bahanCangkang = new THREE.MeshPhysicalMaterial({
    color: 0x1a2232,
    metalness: 0.65,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.25,
    transparent: true,
  });
  const ekstrusi = (tebal: number) =>
    new THREE.ExtrudeGeometry(heksagon(1.6), { depth: tebal, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4 });
  const gBelakang = ekstrusi(0.22);
  const gDepan = ekstrusi(0.22);
  const belakang = new THREE.Mesh(gBelakang, bahanCangkang);
  belakang.position.z = -0.34;
  const depan = new THREE.Mesh(gDepan, bahanCangkang);
  depan.position.z = 0.04;
  segel.add(belakang, depan);

  const bahanTombol = new THREE.MeshPhysicalMaterial({ color: 0x0c111a, metalness: 0.8, roughness: 0.2, emissive: 0xff2b45, emissiveIntensity: 0, transparent: true });
  const tombol = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 48), bahanTombol);
  tombol.rotation.x = Math.PI / 2;
  tombol.position.set(0.62, -0.62, 0.38);
  const cincin = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.02, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x9cc3ff, transparent: true, opacity: 0.6 }),
  );
  cincin.position.copy(tombol.position);
  depan.add(tombol, cincin);
  tombol.position.z -= 0.04;
  cincin.position.z -= 0.04;

  // garis cetak biru
  const bahanGaris = new THREE.LineBasicMaterial({ color: 0x1f2a3d, transparent: true, opacity: 0 });
  const garisBelakang = new THREE.LineSegments(new THREE.EdgesGeometry(gBelakang, 25), bahanGaris);
  const garisDepan = new THREE.LineSegments(new THREE.EdgesGeometry(gDepan, 25), bahanGaris);
  belakang.add(garisBelakang);
  depan.add(garisDepan);

  // lima lapis bukti (cetak biru): PDF → Keccak → ECDSA → ERC-721 → IPFS
  const lapisan = new THREE.Group();
  const titikHeks = heksagon(1.5).getPoints(6);
  const bahanLapis = new THREE.LineBasicMaterial({ color: 0x3b6bd6, transparent: true, opacity: 0 });
  const lapis: THREE.LineLoop[] = [];
  for (let k = 0; k < 5; k++) {
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(titikHeks.map((v) => new THREE.Vector3(v.x, v.y, 0))), bahanLapis);
    lapisan.add(l);
    lapis.push(l);
  }
  segel.add(lapisan);

  // ------------------------------------------------------------ inti kristal, simpul jaringan, berkas
  const bahanKristal = new THREE.MeshPhysicalMaterial({
    color: 0xa8e4ff,
    emissive: 0x3aa8ff,
    emissiveIntensity: 0,
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.35,
    thickness: 0.6,
    transparent: true,
  });
  const kristal = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), bahanKristal);
  kristal.scale.set(0.8, 1.35, 0.8);
  adegan.add(kristal);
  const cahayaInti = new THREE.PointLight(0x5fb8ff, 0, 12);
  kristal.add(cahayaInti);

  const simpul: THREE.Mesh[] = [];
  const berkas: THREE.Mesh[] = [];
  const bahanSimpul = new THREE.MeshPhysicalMaterial({ color: 0xc9d6ea, metalness: 0.9, roughness: 0.15, transparent: true });
  const bahanBerkas = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.9 });
  for (const [x, y] of [
    [-3.4, 1.3],
    [3.3, 1.5],
    [-3.1, -1.6],
    [3.6, -1.2],
  ] as const) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 16, 40), bahanSimpul);
    s.position.set(x, y, -0.6);
    simpul.push(s);
    adegan.add(s);
    const panjang = Math.hypot(x, y, 0.6);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), bahanBerkas);
    b.userData['panjang'] = panjang;
    b.userData['arah'] = new THREE.Vector3(x, y, -0.6).normalize();
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.userData['arah'] as THREE.Vector3);
    berkas.push(b);
    adegan.add(b);
  }

  // ------------------------------------------------------------ bintang dan pecahan kristal
  const n = 1400;
  const posisi = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    posisi[i * 3] = (acak() - 0.5) * 60;
    posisi[i * 3 + 1] = (acak() - 0.5) * 36;
    posisi[i * 3 + 2] = -10 - acak() * 30;
  }
  const bahanBintang = new THREE.PointsMaterial({ color: 0x9cc3ff, size: 0.06, transparent: true, opacity: 1, sizeAttenuation: true });
  const bintang = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(posisi, 3)), bahanBintang);
  adegan.add(bintang);

  const bahanPecahan = new THREE.MeshPhysicalMaterial({ color: 0xdfeeff, roughness: 0.1, transmission: 0.5, thickness: 0.3, transparent: true, opacity: 0 });
  const pecahan: { m: THREE.Mesh; asal: THREE.Vector3; putar: THREE.Vector3 }[] = [];
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + acak() * 0.16, 0), bahanPecahan);
    const asal = new THREE.Vector3((acak() - 0.5) * 9, (acak() - 0.5) * 5.5, (acak() - 0.5) * 3);
    m.position.copy(asal);
    pecahan.push({ m, asal, putar: new THREE.Vector3(acak(), acak(), acak()) });
    adegan.add(m);
  }

  let lebarLayar = 1;
  const sempit = () => lebarLayar < 768;

  function atur(p: number) {
    const l = [0, 1, 2, 3, 4, 5].map((i) => lokal(p, i)) as [number, number, number, number, number, number];
    const masuk = (i: number) => halus(l[i]! / 0.35); // peralihan di awal babak i

    // Babak 1: segel berputar pelan di ruang bintang, sedikit ke kiri (teks di sudut).
    const geserX = sempit() ? 0 : -0.7;
    segel.position.set(geserX, 0, 0);
    segel.rotation.set(0.42 - p * 0.3, -0.5 + l[0] * 0.55 + l[1] * 0.25, 0.04);
    segel.scale.setScalar(sempit() ? 0.72 : 1);
    bahanBintang.opacity = 1 - masuk(1) + masuk(2) * 0.8 - masuk(3) * 0.8 + masuk(4) * 0.8 - masuk(5) * 0.8;

    // Babak 2: cetak biru — cangkang memudar, garis tampil, lima lapis terurai.
    const biru = masuk(1) * (1 - masuk(2));
    bahanCangkang.opacity = 1 - biru;
    bahanTombol.opacity = 1 - biru;
    (cincin.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - biru);
    bahanGaris.opacity = biru;
    bahanLapis.opacity = biru * 0.85;
    const urai = halus((l[1] - 0.2) / 0.5) * (1 - masuk(2));
    lapis.forEach((x, k) => {
      x.position.z = (k - 2) * 0.9 * urai;
      x.position.x = (k - 2) * 0.35 * urai;
    });
    if (biru > 0) {
      segel.rotation.y += biru * 0.55;
      segel.rotation.x -= biru * 0.15;
    }

    // Babak 3: ponsel naik di kiri; segel bergeser ke kanan dan mengecil.
    const ponsel = masuk(2) * (1 - masuk(3));
    segel.position.x += ponsel * (sempit() ? 0 : 3.3 - geserX);
    segel.position.y += ponsel * (sempit() ? 1.6 : 0.2);
    segel.scale.multiplyScalar(1 - ponsel * 0.28);

    // Babak 4: kamera mendekat ke tombol, mode merah.
    const dekat = masuk(3) * (1 - masuk(4));
    segel.scale.multiplyScalar(1 + dekat * 0.45);
    segel.position.x += dekat * (sempit() ? 0 : 1.6 - segel.position.x);
    segel.position.y += dekat * 0.35;
    segel.rotation.x -= dekat * 0.3;
    bahanTombol.emissiveIntensity = dekat * (0.6 + 0.6 * halus((l[3] - 0.45) / 0.2));

    // Babak 5: segel membuka, inti kristal menyala, berkas cahaya ke simpul jaringan.
    const buka = masuk(4);
    const tutup = masuk(5);
    depan.position.y = buka * 2.3;
    depan.position.z = 0.04 + buka * 0.8;
    depan.rotation.x = -buka * 0.55;
    belakang.position.y = -buka * 2.3;
    belakang.rotation.x = buka * 0.4;
    segel.rotation.x -= buka * 0.3;
    segel.rotation.y -= buka * 0.4;
    bahanCangkang.opacity *= 1 - tutup;
    bahanTombol.opacity *= 1 - tutup;
    (cincin.material as THREE.MeshBasicMaterial).opacity *= 1 - tutup;

    const nyala = halus((l[4] - 0.1) / 0.4) * (1 - tutup * 0.6);
    kristal.position.set(segel.position.x * (1 - buka), 0, 0);
    kristal.scale.set(0.8 * buka * (1 - tutup * 0.7), 1.35 * buka * (1 - tutup * 0.7), 0.8 * buka * (1 - tutup * 0.7));
    kristal.rotation.y = p * 6;
    kristal.visible = buka > 0.01;
    bahanKristal.emissiveIntensity = 0.4 + nyala * 2.6;
    cahayaInti.intensity = nyala * 30;
    const sebar = halus((l[4] - 0.35) / 0.4) * (1 - tutup);
    for (const s of simpul) s.rotation.y = p * 4;
    for (const b of berkas) {
      const panjang = (b.userData['panjang'] as number) * sebar;
      const arah = b.userData['arah'] as THREE.Vector3;
      b.scale.set(1, Math.max(panjang, 0.0001), 1);
      b.position.copy(arah).multiplyScalar(panjang / 2);
      b.visible = sebar > 0.01;
    }

    // Babak 6: putih, pecahan kristal melayang.
    bahanPecahan.opacity = tutup;
    for (const { m, asal, putar } of pecahan) {
      m.position.set(asal.x, asal.y + l[5] * 0.8 * (putar.y - 0.5), asal.z);
      m.rotation.set(p * 9 * putar.x, p * 7 * putar.y, p * 5 * putar.z);
      m.visible = tutup > 0.01;
    }
    bahanSimpul.opacity = (1 - tutup) * halus((l[4] - 0.2) / 0.3);
  }

  return {
    atur,
    render: () => renderer.render(adegan, kamera),
    ukur(lebar, tinggi) {
      lebarLayar = lebar;
      renderer.setSize(lebar, tinggi, false);
      kamera.aspect = lebar / tinggi;
      kamera.position.z = lebar < 768 ? 15 : 11;
      kamera.updateProjectionMatrix();
    },
    buang() {
      renderer.dispose();
      pmrem.dispose();
    },
  };
}
