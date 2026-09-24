const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PusakaCertificate", () => {
  let c, admin, baak2, alumni, orang;
  const pdf = ethers.toUtf8Bytes("%PDF-1.7 ijazah Rahmat");
  const H = ethers.keccak256(pdf);
  beforeEach(async () => {
    [admin, baak2, alumni, orang] = await ethers.getSigners();
    c = await (await ethers.getContractFactory("PusakaCertificate")).deploy(admin.address);
  });
  const sign = (s, h) => s.signMessage(ethers.getBytes(h));
  const gagal = async (p, nama) => { try { await p; } catch (e) { if (nama) expect(e.message).to.contain(nama); return; } throw new Error("seharusnya revert"); };

  it("terbit + verifikasi valid", async () => {
    const sig = await sign(admin, H);
    const tx = await c.issue(alumni.address, "ipfs://meta", H, sig);
    const r = await tx.wait(); console.log("      gas issue:", r.gasUsed.toString());
    const [id, dicabut, s, penerbit] = await c.verifyByHash(H);
    expect(id).to.equal(1n); expect(dicabut).to.equal(false); expect(penerbit).to.equal(admin.address);
    expect(ethers.verifyMessage(ethers.getBytes(H), s)).to.equal(penerbit);
    expect(await c.tokenURI(1)).to.equal("ipfs://meta");
    expect(await c.tokensOf(alumni.address)).to.deep.equal([1n]);
  });
  it("PDF diubah 1 byte -> tidak ditemukan", async () => {
    await c.issue(alumni.address, "u", H, await sign(admin, H));
    const H2 = ethers.keccak256(ethers.toUtf8Bytes("%PDF-1.7 ijazah Rahmas"));
    expect((await c.verifyByHash(H2))[0]).to.equal(0n);
  });
  it("tolak wallet tanpa ISSUER_ROLE", async () => {
    await gagal(c.connect(orang).issue(alumni.address, "u", H, await sign(orang, H)), "AccessControlUnauthorizedAccount");
  });
  it("tolak tanda tangan milik wallet lain", async () => {
    await gagal(c.issue(alumni.address, "u", H, await sign(orang, H)), "TandaTanganTidakSah");
  });
  it("tolak hash duplikat", async () => {
    const sig = await sign(admin, H);
    await c.issue(alumni.address, "u", H, sig);
    await gagal(c.issue(alumni.address, "u", H, sig), "HashSudahTerdaftar");
  });
  it("soulbound: transfer ditolak", async () => {
    await c.issue(alumni.address, "u", H, await sign(admin, H));
    await gagal(c.connect(alumni).transferFrom(alumni.address, orang.address, 1), "TidakDapatDipindahtangankan");
  });
  it("revoke + staf BAAK baru", async () => {
    await c.grantRole(await c.ISSUER_ROLE(), baak2.address);
    await c.connect(baak2).issue(alumni.address, "u", H, await sign(baak2, H));
    await c.connect(baak2).revoke(1, "salah data");
    expect((await c.verifyByHash(H))[1]).to.equal(true);
  });
  it("batchIssue 50 ijazah", async () => {
    const n = 50, to = [], uri = [], hs = [], sigs = [];
    for (let i = 0; i < n; i++) { const h = ethers.keccak256(ethers.toUtf8Bytes("pdf" + i)); to.push(alumni.address); uri.push("ipfs://m" + i); hs.push(h); sigs.push(await sign(admin, h)); }
    const r = await (await c.batchIssue(to, uri, hs, sigs)).wait();
    console.log("      gas batch 50:", r.gasUsed.toString(), "=> per ijazah", (r.gasUsed / 50n).toString());
    expect((await c.tokensOf(alumni.address)).length).to.equal(50);
  });
  it("cabut token yang tidak ada -> revert", async () => {
    await gagal(c.revoke(99, "x"), "SertifikatTidakAda");
  });
  it("cabut dua kali -> revert", async () => {
    await c.issue(alumni.address, "u", H, await sign(admin, H));
    await c.revoke(1, "salah data");
    await gagal(c.revoke(1, "lagi"), "SudahDicabut");
  });
  it("batchIssue panjang array berbeda -> revert", async () => {
    await gagal(c.batchIssue([alumni.address], [], [H], [await sign(admin, H)]), "PanjangArrayBerbeda");
  });
  it("getCertificate token tidak ada -> revert", async () => {
    await gagal(c.getCertificate(7), "SertifikatTidakAda");
  });
  it("penerbit dicabut role-nya: ijazah lama tetap tercatat sah", async () => {
    await c.grantRole(await c.ISSUER_ROLE(), baak2.address);
    await c.connect(baak2).issue(alumni.address, "u", H, await sign(baak2, H));
    await c.revokeRole(await c.ISSUER_ROLE(), baak2.address);
    const [id, dicabut, s, penerbit] = await c.verifyByHash(H);
    expect(id).to.equal(1n); expect(dicabut).to.equal(false);
    expect(ethers.verifyMessage(ethers.getBytes(H), s)).to.equal(penerbit);
    await gagal(c.connect(baak2).issue(alumni.address, "u", ethers.ZeroHash, await sign(baak2, ethers.ZeroHash)), "AccessControlUnauthorizedAccount");
  });
  it("totalIssued menghitung semua ijazah, termasuk yang dicabut", async () => {
    expect(await c.totalIssued()).to.equal(0n);
    await c.issue(alumni.address, "u", H, await sign(admin, H));
    const H2 = ethers.keccak256(ethers.toUtf8Bytes("pdf lain"));
    await c.issue(orang.address, "u2", H2, await sign(admin, H2));
    await c.revoke(1, "salah data");
    expect(await c.totalIssued()).to.equal(2n);
    expect((await c.getCertificate(2)).docHash).to.equal(H2);
  });
  it("mendukung antarmuka ERC-721", async () => {
    expect(await c.supportsInterface("0x80ac58cd")).to.equal(true);
  });
});
