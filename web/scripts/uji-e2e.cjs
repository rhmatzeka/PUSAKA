// Uji black box otomatis (KF-01..KF-10) di Chrome. window.ethereum disimulasikan dengan akun Hardhat lokal.
// Syarat: `npm run node` + `npm run deploy:lokal` di contracts/, lalu `npm run dev` di web/. Hasil + screenshot: web/hasil-uji/
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const { keccak256 } = require("ethers");

const DIR = path.join(__dirname, "..", "hasil-uji");
fs.mkdirSync(DIR, { recursive: true });
const WEB = "http://localhost:3000";
const RPC = "http://127.0.0.1:8545";
const shot = (p, n) => p.screenshot({ path: path.join(DIR, `shot-${n}.png`), fullPage: true });
const hasil = [];
const cek = (nama, ok, info = "") => { hasil.push([ok ? "LULUS" : "GAGAL", nama, info]); console.log(ok ? "✔" : "✘", nama, info); };

async function rpc(method, params) {
  const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  return r;
}

async function halaman(browser, akun) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1100, height: 900 });
  await p.exposeFunction("__rpc", async (method, params) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return { result: [akun] };
    if (method === "wallet_switchEthereumChain") return { result: null };
    return rpc(method, params);
  });
  await p.evaluateOnNewDocument(() => {
    window.ethereum = {
      request: async ({ method, params }) => {
        const r = await window.__rpc(method, params ?? []);
        if (r.error) { const e = new Error(r.error.message); e.code = r.error.code; e.data = r.error.data; throw e; }
        return r.result;
      },
      on() {}, removeListener() {},
    };
  });
  p.on("dialog", (d) => d.accept(d.type() === "prompt" ? "Salah data" : undefined));
  return p;
}

const tunggu = (p, teks, ms = 30000) =>
  p.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: ms }, teks);
const memuat = async (p, teks) => (await p.evaluate(() => document.body.innerText)).toLowerCase().includes(teks.toLowerCase());
const klik = async (p, teks) => {
  const el = await p.waitForSelector(`button::-p-text(${teks}), a::-p-text(${teks}), label::-p-text(${teks})`);
  await el.click();
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
  const akun = (await rpc("eth_accounts", [])).result;
  const [admin, alumni, orang] = akun;

  // PDF uji dibuat dari HTML
  const gen = await browser.newPage();
  const pdf = {};
  for (const [k, nama] of [["A", "Rahmat Eka"], ["B", "Budi Santoso"], ["C", "Citra Lestari"]]) {
    await gen.setContent(`<h1>IJAZAH UNIVERSITAS PAMULANG</h1><p>Diberikan kepada ${nama}</p><p>Program Studi Teknik Informatika</p>`);
    const f = path.join(DIR, `ijazah_${k}.pdf`);
    fs.writeFileSync(f, await gen.pdf({ format: "A4" }));
    pdf[k] = f;
  }
  const asli = fs.readFileSync(pdf.A);
  const ubah = Buffer.from(asli);
  const i = ubah.indexOf("Producer") + 12; ubah[i] = ubah[i] ^ 1; // ubah 1 bita di metadata PDF
  pdf.A_ubah = path.join(DIR, "ijazah_A_ubah.pdf");
  fs.writeFileSync(pdf.A_ubah, ubah);
  fs.writeFileSync(path.join(DIR, "lulusan.csv"),
    `nama,nim,prodi,nomor_ijazah,tanggal_lulus,wallet,file_pdf\nBudi Santoso,231011400002,Teknik Informatika,0002/UNPAM/2027,2027-03-01,${alumni},ijazah_B.pdf\nCitra Lestari,231011400003,Teknik Informatika,0003/UNPAM/2027,2027-03-01,${alumni},ijazah_C.pdf\n`);
  await gen.close();

  // KF-01: wallet tanpa role
  let p = await halaman(browser, orang);
  await p.goto(`${WEB}/admin`, { waitUntil: "networkidle0" });
  await klik(p, "Masuk dengan MetaMask");
  await tunggu(p, "tidak berhak menerbitkan");
  cek("KF-01 login wallet tanpa role ditolak", true);
  await p.close();

  // KF-01 + KF-02: admin login, terbit tunggal
  p = await halaman(browser, admin);
  await p.goto(`${WEB}/admin`, { waitUntil: "networkidle0" });
  await klik(p, "Masuk dengan MetaMask");
  await tunggu(p, "Diterbitkan");
  cek("KF-01 login admin ber-ISSUER_ROLE", true);
  await klik(p, "Terbitkan");
  await p.waitForSelector("#pdf");
  const isi = async (A) => {
    await (await p.$("#pdf")).uploadFile(A);
    await p.waitForFunction(() => /0x[0-9a-f]{64}/.test(document.body.innerText));
    await p.type("#wallet", alumni);
    await p.type("#nama", "Rahmat Eka");
    await p.type("#nim", "231011400001");
    await p.type("#nomor_ijazah", "0001/UNPAM/2027");
    await p.$eval("#tanggal_lulus", (el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(el, "2027-03-01"); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  await isi(pdf.A);
  await shot(p, "1-form-terbit");
  await klik(p, "Tanda tangani & Terbitkan");
  await tunggu(p, "Berhasil diterbitkan");
  const txt1 = await p.evaluate(() => document.body.innerText);
  cek("KF-02 terbit tunggal", /token:\s*#1/i.test(txt1), txt1.match(/Berhasil.*detik/i)?.[0]);
  await shot(p, "2-terbit-berhasil");

  // KF-02: PDF yang sama diterbitkan lagi
  await isi(pdf.A);
  await klik(p, "Tanda tangani & Terbitkan");
  await tunggu(p, "sudah pernah diterbitkan");
  cek("KF-02 PDF duplikat ditolak sebelum upload", true);

  // KF-03: batch CSV
  await p.goto(`${WEB}/admin`, { waitUntil: "networkidle0" });
  await klik(p, "Masuk dengan MetaMask");
  await tunggu(p, "Diterbitkan");
  await klik(p, "Terbitkan");
  await klik(p, "Batch CSV");
  await p.waitForSelector("#csv");
  await (await p.$("#csv")).uploadFile(path.join(DIR, "lulusan.csv"));
  await (await p.$("#pdfs")).uploadFile(pdf.B); // sengaja kurang satu PDF
  await klik(p, "Terbitkan batch");
  await tunggu(p, "ijazah_C.pdf belum diunggah");
  cek("KF-03 batch dengan PDF kurang ditolak per baris", true);
  await (await p.$("#pdfs")).uploadFile(pdf.B, pdf.C);
  await klik(p, "Terbitkan batch");
  await tunggu(p, "Berhasil diterbitkan");
  const txt2 = await p.evaluate(() => document.body.innerText);
  cek("KF-03 batch 2 ijazah dalam 1 transaksi", /#2\s*#3/.test(txt2));

  // KF-04 + KF-05: daftar & cabut
  await klik(p, "Register");
  await tunggu(p, "#3");
  await shot(p, "3-daftar");
  await p.waitForFunction(() => document.querySelectorAll("tbody button").length === 3);
  const tombol = await p.$$("tbody button");
  await tombol[1].click(); // token #2
  await tunggu(p, "Ijazah #2 berhasil dicabut");
  cek("KF-04 cabut ijazah #2", true);
  cek("KF-05 daftar menampilkan status", await memuat(p, "DICABUT (Salah data)"));
  await shot(p, "4-dicabut");
  await p.close();

  // KF-09: verifikasi unggah PDF (tanpa wallet)
  p = await browser.newPage();
  await p.setViewport({ width: 1100, height: 900 });
  await p.goto(`${WEB}/verify`, { waitUntil: "networkidle0" });
  let t0 = Date.now();
  await (await p.$("input[type=file]")).uploadFile(pdf.A);
  await tunggu(p, "sama persis");
  cek("KF-09 PDF asli -> VALID", await memuat(p, "valid"), `${Date.now() - t0} ms`);
  await shot(p, "5-valid");
  await p.goto(`${WEB}/verify`, { waitUntil: "networkidle0" });
  await (await p.$("input[type=file]")).uploadFile(pdf.A_ubah);
  await tunggu(p, "TIDAK VALID");
  cek("KF-09 PDF diubah 1 bita -> TIDAK VALID", true);
  await shot(p, "6-tidak-valid");

  // KF-08: token ID
  await p.goto(`${WEB}/verify/2`, { waitUntil: "networkidle0" });
  await tunggu(p, "DICABUT");
  cek("KF-08 token #2 -> DICABUT + alasan", await memuat(p, "Alasan pencabutan: Salah data"));
  await shot(p, "7-dicabut");
  await p.goto(`${WEB}/verify/99`, { waitUntil: "networkidle0" });
  await tunggu(p, "tidak ditemukan");
  cek("KF-08 token tidak ada -> tidak ditemukan", true);
  await p.close();

  // KF-07: portal alumni + unduh PDF cocok
  p = await halaman(browser, alumni);
  await p.goto(`${WEB}/alumni`, { waitUntil: "networkidle0" });
  await klik(p, "Hubungkan wallet");
  await tunggu(p, "Unduh QR");
  const kartu = await p.$$eval("::-p-text(Unduh QR)", (x) => x.length);
  cek("KF-07 portal alumni menampilkan 3 ijazah", kartu === 3);
  const urlPdf = await p.$eval("a[download^=ijazah-1]", (a) => a.href);
  const unduh = Buffer.from(await (await fetch(urlPdf)).arrayBuffer());
  cek("KF-07 PDF yang diunduh = PDF asli (hash sama)", keccak256(unduh) === keccak256(asli));
  await shot(p, "8-alumni");
  await p.close();
  p = await halaman(browser, orang);
  await p.goto(`${WEB}/alumni`, { waitUntil: "networkidle0" });
  await klik(p, "Hubungkan wallet");
  await tunggu(p, "Belum ada ijazah");
  cek("KF-07 wallet tanpa ijazah", true);
  await p.close();

  // KF-10: API tanpa login
  const r = await fetch(`${WEB}/api/ipfs`, { method: "POST", body: new FormData() });
  cek("KF-10 POST /api/ipfs tanpa login -> 401", r.status === 401);

  await browser.close();
  const gagal = hasil.filter((x) => x[0] === "GAGAL").length;
  console.log(`\n${hasil.length - gagal}/${hasil.length} lulus`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
