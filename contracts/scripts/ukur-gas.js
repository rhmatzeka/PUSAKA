// Ukur gas issue dan batchIssue (10/25/50) di Amoy untuk data Bab IV, lalu hitung biaya memakai harga gas POLYGON MAINNET.
// Kenapa mainnet: jumlah gas (gasUsed) di Amoy sama dengan di mainnet karena EVM-nya sama, tetapi harga gas di testnet
// tidak mencerminkan biaya nyata. Jadi: gasUsed dari Amoy x harga gas mainnet saat pengujian x harga POL.
// Pakai: HARGA_POL_IDR=<harga 1 POL dalam rupiah hari ini> npx hardhat run scripts/ukur-gas.js --network amoy
// Opsional: CONTRACT_ADDRESS=0x... (pakai kontrak yang sudah di-deploy), UKURAN_BATCH=10,25,50,
//           POLYGON_RPC_URL (default RPC publik dari docs Polygon), GAS_PRICE_MAINNET_GWEI (isi manual, mis. dari gas tracker Polygonscan),
//           JUMLAH_LULUSAN (dari data BAAK, untuk proyeksi biaya per wisuda)
// Hasil: hasil-gas.csv. Rumus: biaya_POL = gasUsed x hargaGasMainnet (wei) / 1e18; biaya_IDR = biaya_POL x HARGA_POL_IDR
const fs = require("fs");
const hre = require("hardhat");
const { ethers } = hre;

async function hargaGasMainnet() {
  if (process.env.GAS_PRICE_MAINNET_GWEI) {
    return { wei: ethers.parseUnits(process.env.GAS_PRICE_MAINNET_GWEI, "gwei"), sumber: "GAS_PRICE_MAINNET_GWEI (manual)" };
  }
  const url = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const p = new ethers.JsonRpcProvider(url, 137, { staticNetwork: true });
  const fee = await p.getFeeData(); // eth_gasPrice = base fee + tip yang disarankan node
  return { wei: fee.gasPrice, sumber: `eth_gasPrice ${url}` };
}

async function main() {
  const [admin] = await ethers.getSigners();
  const hargaPol = Number(process.env.HARGA_POL_IDR || 0);
  const ukuran = (process.env.UKURAN_BATCH || "10,25,50").split(",").map(Number);
  const mainnet = await hargaGasMainnet();
  const waktuUkur = new Date().toISOString();
  console.log(`Harga gas Polygon mainnet: ${ethers.formatUnits(mainnet.wei, "gwei")} gwei (${mainnet.sumber}, ${waktuUkur})`);

  const c = process.env.CONTRACT_ADDRESS
    ? await ethers.getContractAt("PusakaCertificate", process.env.CONTRACT_ADDRESS)
    : await ethers.deployContract("PusakaCertificate", [admin.address]);
  await c.waitForDeployment();

  const acak = () => ethers.keccak256(ethers.randomBytes(64)); // pengganti hash PDF uji
  const sign = (h) => admin.signMessage(ethers.getBytes(h));
  const baris = [["waktu_ukur", "skenario", "jumlah_ijazah", "gas_total", "gas_per_ijazah", "gas_price_amoy_gwei", "gas_price_mainnet_gwei",
    "biaya_pol_mainnet", "biaya_idr_mainnet", "biaya_idr_per_ijazah", "waktu_konfirmasi_detik", "tx_hash"]];
  const hasil = [];

  async function catat(nama, n, kirim) {
    const t0 = Date.now();
    const tx = await kirim();
    const r = await tx.wait();
    const detik = (Date.now() - t0) / 1000;
    const priceAmoy = r.gasPrice ?? r.effectiveGasPrice ?? 0n;
    const perIjazah = r.gasUsed / BigInt(n);
    const pol = Number(r.gasUsed * mainnet.wei) / 1e18;
    const idr = pol * hargaPol;
    hasil.push({ nama, n, perIjazah });
    baris.push([waktuUkur, nama, n, r.gasUsed, perIjazah, ethers.formatUnits(priceAmoy, "gwei"), ethers.formatUnits(mainnet.wei, "gwei"),
      pol.toFixed(8), idr.toFixed(2), (idr / n).toFixed(2), detik.toFixed(2), r.hash]);
    console.log(`${nama.padEnd(12)} n=${String(n).padStart(3)} gas=${r.gasUsed} per_ijazah=${perIjazah} waktu=${detik.toFixed(2)}s biaya_mainnet=Rp${idr.toFixed(2)}`);
  }

  const h = acak();
  await catat("issue", 1, async () => c.issue(admin.address, "ipfs://uji", h, await sign(h)));
  for (const n of ukuran) {
    const to = [], uri = [], hs = [], sigs = [];
    for (let i = 0; i < n; i++) { const x = acak(); to.push(admin.address); uri.push(`ipfs://uji${i}`); hs.push(x); sigs.push(await sign(x)); }
    await catat("batchIssue", n, () => c.batchIssue(to, uri, hs, sigs));
  }

  fs.writeFileSync("hasil-gas.csv", baris.map((b) => b.join(",")).join("\n") + "\n");
  console.log("Tersimpan: hasil-gas.csv" + (hargaPol ? "" : " (HARGA_POL_IDR belum diisi, kolom biaya_idr = 0)"));

  // Proyeksi per wisuda memakai batch 25 (batas prototipe), atau batch terakhir kalau 25 tidak diukur
  const lulusan = Number(process.env.JUMLAH_LULUSAN || 0);
  if (lulusan && hargaPol) {
    const acuan = hasil.find((x) => x.n === 25) ?? hasil[hasil.length - 1];
    const idr = (Number(acuan.perIjazah * BigInt(lulusan) * mainnet.wei) / 1e18) * hargaPol;
    console.log(`Proyeksi ${lulusan} lulusan (acuan ${acuan.nama} n=${acuan.n}): Rp${idr.toFixed(0)}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
