// Deploy PusakaCertificate lalu tulis alamat + ABI ke ../web/lib/contract.json
// Pakai: npx hardhat run scripts/deploy.js --network amoy
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  console.log(`Jaringan : ${hre.network.name}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Admin    : ${admin}`);

  const c = await hre.ethers.deployContract("PusakaCertificate", [admin]);
  await c.waitForDeployment();
  const address = await c.getAddress();
  const receipt = await c.deploymentTransaction().wait();
  console.log(`Kontrak  : ${address} (blok ${receipt.blockNumber}, gas ${receipt.gasUsed})`);

  // Uji lokal: wallet MetaMask di ADMIN_ADDRESS diberi 100 ETH uji supaya bisa membayar gas
  if (hre.network.name === "localhost" && admin !== deployer.address) {
    await hre.network.provider.send("hardhat_setBalance", [admin, "0x56BC75E2D63100000"]);
    console.log(`Saldo uji: 100 ETH untuk ${admin}`);
  }

  const artifact = await hre.artifacts.readArtifact("PusakaCertificate");
  const out = {
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    address,
    deployBlock: receipt.blockNumber,
    abi: artifact.abi,
  };
  const dir = process.env.WEB_LIB_DIR || path.join(__dirname, "..", "..", "web", "lib");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "contract.json"), JSON.stringify(out, null, 2));
  console.log(`ABI + alamat ditulis ke ${path.join(dir, "contract.json")}`);
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log(`Verifikasi source: npx hardhat verify --network ${hre.network.name} ${address} ${admin}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
