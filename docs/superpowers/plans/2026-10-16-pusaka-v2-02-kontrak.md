# PUSAKA v2 · Rencana 02 — Kontrak `PusakaIjazah`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kontrak ERC-721 soulbound (ERC-5192) yang hanya menerbitkan atau mencabut ijazah bila membawa tanda tangan EIP-712 dari wallet berperan `PENANDATANGAN_ROLE` dan dikirim oleh `OPERATOR_ROLE`, lengkap dengan tes unit, fuzz, invariant, pengukuran gas, skrip deploy, dan ekspor ABI.

**Architecture:** Satu kontrak `PusakaIjazah` (OpenZeppelin 5.7: `ERC721URIStorage`, `AccessControl`, `EIP712`, `ECDSA`) dan antarmuka `IERC5192`. Tes memakai kelas dasar `Dasar` yang men-deploy kontrak ke alamat tetap `0x5FbD…0aa3` di chain 31337, supaya hash EIP-712 bisa dibandingkan dengan vektor ethers dari peta jalan.

**Tech Stack:** Foundry 1.8 (forge, anvil), Solidity 0.8.28, OpenZeppelin Contracts v5.7.0, forge-std v1.17.0, jq.

**Spec:** `docs/superpowers/specs/2026-10-16-pusaka-v2-design.md` (bagian 5; tahap 2 di bagian 13). Vektor acuan: `docs/superpowers/plans/2026-10-16-pusaka-v2-00-peta-jalan.md`.

## Global Constraints

- Kerjakan setelah rencana 01 di-merge. Branch: `feat/pusaka-v2-kontrak` dari `main`. Tanpa atribusi AI di commit/PR.
- `pragma solidity 0.8.28;` persis, `evm_version = "cancun"`, optimizer 200 run.
- EIP-712 domain: `name "PUSAKA"`, `version "2"`.
- Typehash persis: `Penerbitan(address penerima,bytes32 docHash,bytes32 metadataHash,uint64 batasWaktu)` dan `Pencabutan(uint256 tokenId,bytes32 alasanHash,uint64 batasWaktu)`.
- Nama ERC-721: `"PUSAKA Ijazah UNPAM"`, simbol `"PUSAKA"`.
- `MAKS_BATCH = 50`, `MAKS_HALAMAN = 100`.
- Peran: `DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE = keccak256("OPERATOR_ROLE")`, `PENANDATANGAN_ROLE = keccak256("PENANDATANGAN_ROLE")`.
- Tambahan atas spec (disepakati di rencana ini): error `AlasanTidakCocok` (alasan tidak sesuai `alasanHash`), error `HashKosong` (`docHash == 0`), serta view `domainSeparator()`, `digestPenerbitan()`, dan `digestPencabutan()` untuk debugging dan pengecekan lintas bahasa.
- `forge fmt --check` bersih.

## Review Focus

- Tanda tangan dari wallet yang hanya ber-`OPERATOR_ROLE` (operator mencoba menandatangani sendiri) harus ditolak → `test_tolakOperatorMenandatanganiSendiri` (Task 2).
- Satu ijazah bermasalah di dalam batch harus membatalkan seluruh batch, bukan sebagian → `test_batchAtomik` (Task 3).
- Ijazah lama tetap VALID setelah peran rektor dicabut (pergantian rektor) → `test_ijazahTetapSahSetelahPeranRektorDicabut` (Task 2).
- `daftar` dengan `mulai = 0`, di luar jangkauan, atau `jumlah` sangat besar tidak boleh revert/out-of-gas → `test_daftarBatas` (Task 3).
- Byte tanda tangan sampah (panjang salah, nilai acak) menghasilkan error `PenandaTanganTidakBerwenang`, bukan error OpenZeppelin mentah → `testFuzz_sigSampah` (Task 4).

---

### Task 1: Proyek Foundry + dependensi

**Files:**
- Create: `contracts/foundry.toml`, `contracts/.gitignore`, `contracts/lib/` (vendor), `contracts/test/Smoke.t.sol`

**Interfaces:**
- Produces: proyek Foundry yang bisa `forge build` dan `forge test` dengan remapping `@openzeppelin/contracts/` dan `forge-std/`.

- [ ] **Step 1: Branch dan konfigurasi**

```bash
cd ~/Skripsi/pusaka && git switch main && git pull && git switch -c feat/pusaka-v2-kontrak
mkdir -p contracts/src contracts/test contracts/script contracts/deployments
```

`contracts/foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc_version = "0.8.28"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
fs_permissions = [{ access = "read-write", path = "./deployments" }]
remappings = [
  "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
  "forge-std/=lib/forge-std/src/",
]

[fuzz]
runs = 1000

[invariant]
runs = 128
depth = 32

[fmt]
line_length = 110
```

`contracts/.gitignore`:
```
out/
cache/
broadcast/
deployments/31337.json
```

- [ ] **Step 2: Instal dependensi tanpa submodule**

Run: `cd contracts && forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.7.0 foundry-rs/forge-std@v1.17.0`
Expected: folder `lib/openzeppelin-contracts` dan `lib/forge-std` ada; `git status` tidak menampilkan `.gitmodules`.

- [ ] **Step 3: Tes asap**

`contracts/test/Smoke.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SmokeTest is Test {
    function test_remappingBekerja() public pure {
        assertEq(keccak256(""), 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470);
        assertEq(uint8(ECDSA.RecoverError.NoError), 0);
    }
}
```

Run: `forge test --match-contract SmokeTest`
Expected: `1 passed`.

- [ ] **Step 4: Commit**

```bash
git add contracts/foundry.toml contracts/.gitignore contracts/lib contracts/test/Smoke.t.sol
git commit -m "chore(kontrak): proyek Foundry + OpenZeppelin 5.7 + forge-std"
```

---

### Task 2: `terbitkan`, `periksa`, soulbound

**Files:**
- Create: `contracts/src/IERC5192.sol`, `contracts/src/PusakaIjazah.sol`, `contracts/test/Dasar.sol`, `contracts/test/Terbitkan.t.sol`
- Delete: `contracts/test/Smoke.t.sol`

**Interfaces:**
- Produces (dipakai rencana 03–05 lewat ABI):
  - `struct Penerbitan { address penerima; bytes32 docHash; bytes32 metadataHash; uint64 batasWaktu; }`
  - `struct Pencabutan { uint256 tokenId; bytes32 alasanHash; uint64 batasWaktu; }`
  - `struct Ijazah { bytes32 docHash; address penandaTangan; uint64 waktuTerbit; uint64 waktuCabut; }`
  - `enum Status { TIDAK_ADA, VALID, DICABUT }`
  - `terbitkan(Penerbitan,bytes,string) returns (uint256)`, `periksa(bytes32) returns (Status,uint256,Ijazah)`, `ijazah(uint256) returns (Ijazah)`, `totalTerbit() returns (uint256)`, `tokenDariHash(bytes32) returns (uint256)`, `locked(uint256) returns (bool)`, `domainSeparator()`, `digestPenerbitan(Penerbitan)`, `digestPencabutan(Pencabutan)`
  - Event `Diterbitkan(uint256 indexed tokenId, address indexed penerima, bytes32 indexed docHash, address penandaTangan)`, `Dicabut(uint256 indexed tokenId, string alasan)`, `Locked(uint256 tokenId)`

- [ ] **Step 1: Kelas dasar tes**

`contracts/test/Dasar.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";

/// Deploy kontrak ke alamat & chain yang sama dengan vektor ethers di peta jalan.
abstract contract Dasar is Test {
    address internal constant ALAMAT_KONTRAK = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    uint256 internal constant PK_REKTOR = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    address internal constant ALUMNI = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    string internal constant URI = "ipfs://bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    bytes32 internal constant DOC = keccak256("%PDF-1.7 ijazah PUSAKA");
    uint64 internal constant BATAS = 1793000000;
    uint256 internal constant SEKARANG = 1792000000;

    PusakaIjazah internal k;
    address internal admin = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal rektor;

    function setUp() public virtual {
        vm.chainId(31337);
        vm.warp(SEKARANG);
        rektor = vm.addr(PK_REKTOR);
        deployCodeTo("PusakaIjazah.sol:PusakaIjazah", abi.encode(admin), ALAMAT_KONTRAK);
        k = PusakaIjazah(ALAMAT_KONTRAK);
        vm.startPrank(admin);
        k.grantRole(k.OPERATOR_ROLE(), operator);
        k.grantRole(k.PENANDATANGAN_ROLE(), rektor);
        vm.stopPrank();
    }

    function _penerbitan(bytes32 doc, string memory uri) internal pure returns (PusakaIjazah.Penerbitan memory) {
        return PusakaIjazah.Penerbitan({
            penerima: ALUMNI,
            docHash: doc,
            metadataHash: keccak256(bytes(uri)),
            batasWaktu: BATAS
        });
    }

    function _pencabutan(uint256 tokenId, string memory alasan)
        internal
        pure
        returns (PusakaIjazah.Pencabutan memory)
    {
        return PusakaIjazah.Pencabutan({tokenId: tokenId, alasanHash: keccak256(bytes(alasan)), batasWaktu: BATAS});
    }

    function _ttd(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _terbitkan(bytes32 doc) internal returns (uint256) {
        PusakaIjazah.Penerbitan memory p = _penerbitan(doc, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        return k.terbitkan(p, sig, URI);
    }

    function _batch(uint256 n, string memory awalan)
        internal
        view
        returns (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u)
    {
        p = new PusakaIjazah.Penerbitan[](n);
        s = new bytes[](n);
        u = new string[](n);
        for (uint256 i; i < n; ++i) {
            u[i] = string.concat("ipfs://", awalan, "-", vm.toString(i));
            p[i] = _penerbitan(keccak256(abi.encode(awalan, i)), u[i]);
            s[i] = _ttd(PK_REKTOR, k.digestPenerbitan(p[i]));
        }
    }
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`contracts/test/Terbitkan.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

contract TerbitkanTest is Dasar {
    function test_vektorEip712SamaDenganEthers() public view {
        assertEq(k.domainSeparator(), 0x234afa7e8e5a1ef9ad82593a023f56bd249579702732f95795cd18b5e39ed04c);
        assertEq(DOC, 0x413538c95b60dfa9a17c6008dda06f5589538080ef91043561f8668fde026edb);
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        assertEq(p.metadataHash, 0x14ecfb0c60c4bdfac4451a0238994b0b8024f8e018440289db82f5b6e4cf9e5f);
        assertEq(k.digestPenerbitan(p), 0x069e362cc547e60dc1beb36e2f4502c5e07a3689275ac21faaaa791b024f9be5);
        assertEq(
            k.digestPencabutan(_pencabutan(7, "salah nama ibu")),
            0xd9bc14d3408df457dab6f74a5d04e5c5768e3526573c85bbf7080d0ae73e8bc6
        );
    }

    function test_tandaTanganDariEthersDiterima() public {
        bytes memory sig =
            hex"005375b038da81be905bbe4ab2ddd240a489ccd90e34c85ac7d6a1913e33859358dbb04ecdd2f170e730c5813a49cc71b3fca320e102dd263359a15e40448fae1b";
        vm.prank(operator);
        assertEq(k.terbitkan(_penerbitan(DOC, URI), sig, URI), 1);
    }

    function test_terbitkanMencatatIjazah() public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.expectEmit(address(k));
        emit PusakaIjazah.Diterbitkan(1, ALUMNI, DOC, rektor);
        vm.prank(operator);
        uint256 id = k.terbitkan(p, sig, URI);

        assertEq(id, 1);
        assertEq(k.ownerOf(id), ALUMNI);
        assertEq(k.tokenURI(id), URI);
        assertEq(k.totalTerbit(), 1);
        assertEq(k.tokenDariHash(DOC), 1);
        assertTrue(k.locked(id));

        (PusakaIjazah.Status st, uint256 t, PusakaIjazah.Ijazah memory d) = k.periksa(DOC);
        assertEq(uint8(st), uint8(PusakaIjazah.Status.VALID));
        assertEq(t, 1);
        assertEq(d.docHash, DOC);
        assertEq(d.penandaTangan, rektor);
        assertEq(d.waktuTerbit, SEKARANG);
        assertEq(d.waktuCabut, 0);
    }

    function test_periksaHashTidakDikenal() public view {
        (PusakaIjazah.Status st, uint256 t,) = k.periksa(keccak256("palsu"));
        assertEq(uint8(st), uint8(PusakaIjazah.Status.TIDAK_ADA));
        assertEq(t, 0);
    }

    function test_tolakBukanOperator() public {
        address orang = makeAddr("orang");
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        bytes32 peranOperator = k.OPERATOR_ROLE();
        vm.prank(orang);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, orang, peranOperator)
        );
        k.terbitkan(p, sig, URI);
    }

    function test_tolakPenandaTanganTanpaPeran() public {
        (address bukan, uint256 pk) = makeAddrAndKey("bukan-rektor");
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(pk, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, bukan));
        k.terbitkan(p, sig, URI);
    }

    function test_tolakOperatorMenandatanganiSendiri() public {
        (address op2, uint256 pkOp2) = makeAddrAndKey("operator-2");
        bytes32 peranOperator = k.OPERATOR_ROLE();
        vm.prank(admin);
        k.grantRole(peranOperator, op2);
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(pkOp2, k.digestPenerbitan(p));
        vm.prank(op2);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, op2));
        k.terbitkan(p, sig, URI);
    }

    function test_tolakKedaluwarsa() public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.warp(uint256(BATAS) + 1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.TandaTanganKedaluwarsa.selector, BATAS));
        k.terbitkan(p, sig, URI);
    }

    function test_tolakMetadataTidakCocok() public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(PusakaIjazah.MetadataTidakCocok.selector);
        k.terbitkan(p, sig, "ipfs://lain");
    }

    function test_tolakHashGanda() public {
        _terbitkan(DOC);
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.HashSudahTerbit.selector, DOC));
        k.terbitkan(p, sig, URI);
    }

    function test_tolakHashKosong() public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(bytes32(0), URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(PusakaIjazah.HashKosong.selector);
        k.terbitkan(p, sig, URI);
    }

    function test_ijazahTetapSahSetelahPeranRektorDicabut() public {
        _terbitkan(DOC);
        bytes32 peran = k.PENANDATANGAN_ROLE();
        vm.prank(admin);
        k.revokeRole(peran, rektor);

        (PusakaIjazah.Status st,,) = k.periksa(DOC);
        assertEq(uint8(st), uint8(PusakaIjazah.Status.VALID));

        bytes32 doc2 = keccak256("ijazah lain");
        PusakaIjazah.Penerbitan memory p = _penerbitan(doc2, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, rektor));
        k.terbitkan(p, sig, URI);
    }

    function test_tidakDapatDipindahtangankan() public {
        uint256 id = _terbitkan(DOC);
        vm.prank(ALUMNI);
        vm.expectRevert(PusakaIjazah.TidakDapatDipindahtangankan.selector);
        k.transferFrom(ALUMNI, makeAddr("pembeli"), id);
    }

    function test_mendukungAntarmuka() public view {
        assertTrue(k.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(k.supportsInterface(0xb45a3c0e)); // ERC-5192
        assertTrue(k.supportsInterface(0x7965db0b)); // AccessControl
        assertFalse(k.supportsInterface(0xffffffff));
    }

    function test_lockedTokenTidakAda() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 99));
        k.locked(99);
    }

    function test_ijazahTokenTidakAda() public {
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.IjazahTidakAda.selector, 99));
        k.ijazah(99);
    }
}
```

Hapus `contracts/test/Smoke.t.sol` (sudah tergantikan).

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd contracts && forge test`
Expected: gagal kompilasi, `PusakaIjazah.sol` tidak ditemukan.

- [ ] **Step 4: Tulis antarmuka dan kontrak**

`contracts/src/IERC5192.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// ERC-5192: Minimal Soulbound NFTs. interfaceId = 0xb45a3c0e.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}
```

`contracts/src/PusakaIjazah.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC5192} from "./IERC5192.sol";

/// @title PUSAKA v2 — ijazah digital Universitas Pamulang
/// @notice Token ERC-721 soulbound. Penerbitan dan pencabutan wajib membawa tanda tangan EIP-712
///         pejabat ber-PENANDATANGAN_ROLE dan dikirim oleh wallet ber-OPERATOR_ROLE.
contract PusakaIjazah is ERC721URIStorage, AccessControl, EIP712, IERC5192 {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PENANDATANGAN_ROLE = keccak256("PENANDATANGAN_ROLE");
    bytes32 public constant PENERBITAN_TYPEHASH =
        keccak256("Penerbitan(address penerima,bytes32 docHash,bytes32 metadataHash,uint64 batasWaktu)");
    bytes32 public constant PENCABUTAN_TYPEHASH =
        keccak256("Pencabutan(uint256 tokenId,bytes32 alasanHash,uint64 batasWaktu)");
    uint256 public constant MAKS_BATCH = 50;
    uint256 public constant MAKS_HALAMAN = 100;

    enum Status {
        TIDAK_ADA,
        VALID,
        DICABUT
    }

    struct Penerbitan {
        address penerima;
        bytes32 docHash;
        bytes32 metadataHash;
        uint64 batasWaktu;
    }

    struct Pencabutan {
        uint256 tokenId;
        bytes32 alasanHash;
        uint64 batasWaktu;
    }

    struct Ijazah {
        bytes32 docHash;
        address penandaTangan;
        uint64 waktuTerbit;
        uint64 waktuCabut;
    }

    mapping(uint256 tokenId => Ijazah) private _ijazah;
    mapping(bytes32 docHash => uint256 tokenId) public tokenDariHash;
    uint256 private _total;

    event Diterbitkan(
        uint256 indexed tokenId, address indexed penerima, bytes32 indexed docHash, address penandaTangan
    );
    event Dicabut(uint256 indexed tokenId, string alasan);

    error HashKosong();
    error HashSudahTerbit(bytes32 docHash);
    error PenandaTanganTidakBerwenang(address penandaTangan);
    error TandaTanganKedaluwarsa(uint64 batasWaktu);
    error MetadataTidakCocok();
    error AlasanTidakCocok();
    error IjazahTidakAda(uint256 tokenId);
    error SudahDicabut(uint256 tokenId);
    error TidakDapatDipindahtangankan();
    error PanjangTidakSama();
    error BatchTerlaluBesar(uint256 jumlah);

    constructor(address admin) ERC721("PUSAKA Ijazah UNPAM", "PUSAKA") EIP712("PUSAKA", "2") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ------------------------------------------------------------------ tulis

    function terbitkan(Penerbitan calldata p, bytes calldata sig, string calldata uri)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256)
    {
        return _terbitkan(p, sig, uri);
    }

    // ------------------------------------------------------------------ baca

    function periksa(bytes32 docHash) external view returns (Status status, uint256 tokenId, Ijazah memory data) {
        tokenId = tokenDariHash[docHash];
        if (tokenId == 0) return (Status.TIDAK_ADA, 0, data);
        data = _ijazah[tokenId];
        status = data.waktuCabut == 0 ? Status.VALID : Status.DICABUT;
    }

    function ijazah(uint256 tokenId) external view returns (Ijazah memory) {
        Ijazah memory d = _ijazah[tokenId];
        if (d.waktuTerbit == 0) revert IjazahTidakAda(tokenId);
        return d;
    }

    function totalTerbit() external view returns (uint256) {
        return _total;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function digestPenerbitan(Penerbitan calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(PENERBITAN_TYPEHASH, p.penerima, p.docHash, p.metadataHash, p.batasWaktu))
        );
    }

    function digestPencabutan(Pencabutan calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PENCABUTAN_TYPEHASH, c.tokenId, c.alasanHash, c.batasWaktu)));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    // ------------------------------------------------------------------ internal

    function _terbitkan(Penerbitan calldata p, bytes calldata sig, string calldata uri)
        private
        returns (uint256 tokenId)
    {
        if (block.timestamp > p.batasWaktu) revert TandaTanganKedaluwarsa(p.batasWaktu);
        if (p.docHash == bytes32(0)) revert HashKosong();
        if (keccak256(bytes(uri)) != p.metadataHash) revert MetadataTidakCocok();
        if (tokenDariHash[p.docHash] != 0) revert HashSudahTerbit(p.docHash);
        address penandaTangan = _wajibPenandaTangan(digestPenerbitan(p), sig);

        tokenId = ++_total;
        tokenDariHash[p.docHash] = tokenId;
        _ijazah[tokenId] = Ijazah(p.docHash, penandaTangan, uint64(block.timestamp), 0);
        _mint(p.penerima, tokenId);
        _setTokenURI(tokenId, uri);
        emit Diterbitkan(tokenId, p.penerima, p.docHash, penandaTangan);
        emit Locked(tokenId);
    }

    /// Pulihkan penanda tangan; tolak bila tanda tangan rusak atau penanda tangan tak berperan.
    function _wajibPenandaTangan(bytes32 digest, bytes calldata sig) private view returns (address) {
        (address penandaTangan, ECDSA.RecoverError galat,) = ECDSA.tryRecover(digest, sig);
        if (galat != ECDSA.RecoverError.NoError || !hasRole(PENANDATANGAN_ROLE, penandaTangan)) {
            revert PenandaTanganTidakBerwenang(penandaTangan);
        }
        return penandaTangan;
    }

    /// Soulbound: hanya mint (pemilik lama = 0) yang diizinkan.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert TidakDapatDipindahtangankan();
        return super._update(to, tokenId, auth);
    }
}
```

- [ ] **Step 5: Jalankan, pastikan lulus**

Run: `forge test --match-contract TerbitkanTest -vv && forge fmt --check`
Expected: `16 passed`, fmt bersih. Jika `forge fmt --check` gagal, jalankan `forge fmt` lalu ulangi.

- [ ] **Step 6: Commit**

```bash
git add contracts/src contracts/test && git rm -q --cached contracts/test/Smoke.t.sol 2>/dev/null; rm -f contracts/test/Smoke.t.sol
git commit -m "feat(kontrak): terbitkan EIP-712 + periksa + soulbound ERC-5192"
```

---

### Task 3: Batch, cabut, daftar

**Files:**
- Modify: `contracts/src/PusakaIjazah.sol`
- Test: `contracts/test/BatchCabut.t.sol`

**Interfaces:**
- Consumes: semua dari Task 2.
- Produces: `terbitkanBatch(Penerbitan[],bytes[],string[]) returns (uint256[])`, `cabut(Pencabutan,bytes,string)`, `daftar(uint256 mulai,uint256 jumlah) returns (Ijazah[])` (token ke-i = `mulai + i`).

- [ ] **Step 1: Tulis tes yang gagal**

`contracts/test/BatchCabut.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

contract BatchCabutTest is Dasar {
    function test_batch25() public {
        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) = _batch(25, "b");
        vm.prank(operator);
        uint256[] memory ids = k.terbitkanBatch(p, s, u);
        assertEq(ids.length, 25);
        assertEq(ids[0], 1);
        assertEq(ids[24], 25);
        assertEq(k.totalTerbit(), 25);
        assertEq(k.tokenURI(25), u[24]);
    }

    function test_batchPanjangBeda() public {
        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s,) = _batch(2, "b");
        string[] memory u = new string[](1);
        vm.prank(operator);
        vm.expectRevert(PusakaIjazah.PanjangTidakSama.selector);
        k.terbitkanBatch(p, s, u);
    }

    function test_batchKosongDanTerlaluBesar() public {
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.BatchTerlaluBesar.selector, 0));
        k.terbitkanBatch(new PusakaIjazah.Penerbitan[](0), new bytes[](0), new string[](0));
        vm.stopPrank();

        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) = _batch(51, "besar");
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.BatchTerlaluBesar.selector, 51));
        k.terbitkanBatch(p, s, u);
    }

    function test_batchAtomik() public {
        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) = _batch(3, "atom");
        p[2] = p[0];
        u[2] = u[0];
        s[2] = s[0];
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.HashSudahTerbit.selector, p[0].docHash));
        k.terbitkanBatch(p, s, u);
        assertEq(k.totalTerbit(), 0);
    }

    function test_cabut() public {
        uint256 id = _terbitkan(DOC);
        vm.warp(SEKARANG + 100);
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "salah nama ibu");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));

        vm.expectEmit(address(k));
        emit PusakaIjazah.Dicabut(id, "salah nama ibu");
        vm.prank(operator);
        k.cabut(c, sig, "salah nama ibu");

        (PusakaIjazah.Status st,, PusakaIjazah.Ijazah memory d) = k.periksa(DOC);
        assertEq(uint8(st), uint8(PusakaIjazah.Status.DICABUT));
        assertEq(d.waktuCabut, SEKARANG + 100);
        assertEq(k.ownerOf(id), ALUMNI);
    }

    function test_cabutTanpaTandaTanganSah() public {
        uint256 id = _terbitkan(DOC);
        (address bukan, uint256 pk) = makeAddrAndKey("bukan-rektor");
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "x");
        bytes memory sig = _ttd(pk, k.digestPencabutan(c));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, bukan));
        k.cabut(c, sig, "x");
    }

    function test_cabutAlasanBeda() public {
        uint256 id = _terbitkan(DOC);
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "alasan asli");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.prank(operator);
        vm.expectRevert(PusakaIjazah.AlasanTidakCocok.selector);
        k.cabut(c, sig, "alasan diganti");
    }

    function test_cabutDuaKali() public {
        uint256 id = _terbitkan(DOC);
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "x");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.startPrank(operator);
        k.cabut(c, sig, "x");
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.SudahDicabut.selector, id));
        k.cabut(c, sig, "x");
        vm.stopPrank();
    }

    function test_cabutTokenTidakAda() public {
        PusakaIjazah.Pencabutan memory c = _pencabutan(9, "x");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.IjazahTidakAda.selector, 9));
        k.cabut(c, sig, "x");
    }

    function test_cabutKedaluwarsa() public {
        uint256 id = _terbitkan(DOC);
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "x");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.warp(uint256(BATAS) + 1);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.TandaTanganKedaluwarsa.selector, BATAS));
        k.cabut(c, sig, "x");
    }

    function test_daftar() public {
        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) = _batch(3, "d");
        vm.prank(operator);
        k.terbitkanBatch(p, s, u);

        PusakaIjazah.Ijazah[] memory semua = k.daftar(1, 10);
        assertEq(semua.length, 3);
        assertEq(semua[0].docHash, p[0].docHash);
        assertEq(semua[2].docHash, p[2].docHash);

        PusakaIjazah.Ijazah[] memory satu = k.daftar(2, 1);
        assertEq(satu.length, 1);
        assertEq(satu[0].docHash, p[1].docHash);
    }

    function test_daftarBatas() public {
        _terbitkan(DOC);
        assertEq(k.daftar(0, 5).length, 0);
        assertEq(k.daftar(2, 5).length, 0);
        assertEq(k.daftar(1, 0).length, 0);
        assertEq(k.daftar(1, type(uint256).max).length, 1);
    }
}
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `forge test --match-contract BatchCabutTest`
Expected: gagal kompilasi, `terbitkanBatch`, `cabut`, dan `daftar` belum ada.

- [ ] **Step 3: Implementasi**

Di `contracts/src/PusakaIjazah.sol`, tambahkan setelah fungsi `terbitkan` (bagian `// ---- tulis`):
```solidity
    function terbitkanBatch(Penerbitan[] calldata p, bytes[] calldata sig, string[] calldata uri)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256[] memory ids)
    {
        uint256 n = p.length;
        if (sig.length != n || uri.length != n) revert PanjangTidakSama();
        if (n == 0 || n > MAKS_BATCH) revert BatchTerlaluBesar(n);
        ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = _terbitkan(p[i], sig[i], uri[i]);
        }
    }

    function cabut(Pencabutan calldata c, bytes calldata sig, string calldata alasan)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (block.timestamp > c.batasWaktu) revert TandaTanganKedaluwarsa(c.batasWaktu);
        if (keccak256(bytes(alasan)) != c.alasanHash) revert AlasanTidakCocok();
        Ijazah storage d = _ijazah[c.tokenId];
        if (d.waktuTerbit == 0) revert IjazahTidakAda(c.tokenId);
        if (d.waktuCabut != 0) revert SudahDicabut(c.tokenId);
        _wajibPenandaTangan(digestPencabutan(c), sig);
        d.waktuCabut = uint64(block.timestamp);
        emit Dicabut(c.tokenId, alasan);
    }
```

Tambahkan setelah fungsi `ijazah` (bagian `// ---- baca`):
```solidity
    /// Halaman data untuk Buku Induk. Elemen ke-i adalah token `mulai + i`.
    function daftar(uint256 mulai, uint256 jumlah) external view returns (Ijazah[] memory hasil) {
        uint256 total = _total;
        if (mulai == 0 || mulai > total || jumlah == 0) return new Ijazah[](0);
        uint256 sisa = total - mulai + 1;
        uint256 n = jumlah < sisa ? jumlah : sisa;
        if (n > MAKS_HALAMAN) n = MAKS_HALAMAN;
        hasil = new Ijazah[](n);
        for (uint256 i; i < n; ++i) {
            hasil[i] = _ijazah[mulai + i];
        }
    }
```

- [ ] **Step 4: Jalankan semua tes**

Run: `forge test && forge fmt --check`
Expected: semua tes (`TerbitkanTest` + `BatchCabutTest`) lulus.

- [ ] **Step 5: Commit**

```bash
git add contracts/src contracts/test
git commit -m "feat(kontrak): terbitkanBatch, cabut bertanda tangan pejabat, daftar per halaman"
```

---

### Task 4: Fuzz, invariant, dan ukur gas

**Files:**
- Test: `contracts/test/Fuzz.t.sol`, `contracts/test/Invariant.t.sol`, `contracts/test/UkurGas.t.sol`

**Interfaces:**
- Consumes: kontrak lengkap dari Task 3.
- Produces: data gas untuk BAB IV (log `UkurGas`).

- [ ] **Step 1: Tes fuzz**

`contracts/test/Fuzz.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

contract FuzzTest is Dasar {
    uint256 internal constant ORDE_SECP256K1 =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function testFuzz_kunciAcakDitolak(uint256 pk) public {
        pk = bound(pk, 1, ORDE_SECP256K1 - 1);
        vm.assume(pk != PK_REKTOR);
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(pk, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, vm.addr(pk)));
        k.terbitkan(p, sig, URI);
    }

    function testFuzz_batasWaktu(uint64 batas) public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        p.batasWaktu = batas;
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        if (batas < SEKARANG) {
            vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.TandaTanganKedaluwarsa.selector, batas));
            k.terbitkan(p, sig, URI);
        } else {
            assertEq(k.terbitkan(p, sig, URI), 1);
        }
    }

    function testFuzz_hashUnik(bytes32 doc) public {
        vm.assume(doc != bytes32(0));
        assertEq(_terbitkan(doc), 1);
        PusakaIjazah.Penerbitan memory p = _penerbitan(doc, URI);
        bytes memory sig = _ttd(PK_REKTOR, k.digestPenerbitan(p));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.HashSudahTerbit.selector, doc));
        k.terbitkan(p, sig, URI);
        (, uint256 id,) = k.periksa(doc);
        assertEq(id, 1);
    }

    function testFuzz_sigSampah(bytes memory sig) public {
        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        // Fuzzer bisa memakai konstanta dari kode tes, termasuk tanda tangan sah rektor; itu bukan sampah.
        (address penandaTangan, ECDSA.RecoverError galat,) = ECDSA.tryRecover(k.digestPenerbitan(p), sig);
        vm.assume(galat != ECDSA.RecoverError.NoError || penandaTangan != rektor);
        vm.prank(operator);
        vm.expectPartialRevert(PusakaIjazah.PenandaTanganTidakBerwenang.selector);
        k.terbitkan(p, sig, URI);
    }
}
```

- [ ] **Step 2: Tes invariant**

`contracts/test/Invariant.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

/// Pemanggil acak untuk tes invariant: menerbitkan ijazah dan mencoba memindahkannya.
contract Penangan is Test {
    PusakaIjazah internal immutable k;
    address internal immutable operator;
    uint256 internal immutable pkRektor;
    address[3] internal calon;

    uint256 public jumlah;
    mapping(uint256 => address) public penerimaAsli;

    constructor(PusakaIjazah k_, address operator_, uint256 pkRektor_) {
        k = k_;
        operator = operator_;
        pkRektor = pkRektor_;
        calon = [makeAddr("calon-a"), makeAddr("calon-b"), makeAddr("calon-c")];
    }

    function terbitkan(uint256 benih, uint8 pilih) external {
        address ke = calon[pilih % 3];
        string memory uri = string.concat("ipfs://inv-", vm.toString(jumlah));
        PusakaIjazah.Penerbitan memory p = PusakaIjazah.Penerbitan({
            penerima: ke,
            docHash: keccak256(abi.encode(benih, jumlah)),
            metadataHash: keccak256(bytes(uri)),
            batasWaktu: type(uint64).max
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkRektor, k.digestPenerbitan(p));
        vm.prank(operator);
        uint256 id = k.terbitkan(p, abi.encodePacked(r, s, v), uri);
        penerimaAsli[id] = ke;
        jumlah++;
    }

    function cobaPindah(uint256 id, uint8 pilih) external {
        if (jumlah == 0) return;
        id = bound(id, 1, jumlah);
        address pemilik = k.ownerOf(id);
        vm.prank(pemilik);
        try k.transferFrom(pemilik, calon[pilih % 3], id) {} catch {}
    }
}

contract InvariantTest is Dasar {
    Penangan internal h;

    function setUp() public override {
        super.setUp();
        h = new Penangan(k, operator, PK_REKTOR);
        targetContract(address(h));
    }

    function invariant_pemilikTidakPernahBerubah() public view {
        for (uint256 id = 1; id <= h.jumlah(); ++id) {
            assertEq(k.ownerOf(id), h.penerimaAsli(id));
        }
    }

    function invariant_totalSamaDenganJumlahTerbit() public view {
        assertEq(k.totalTerbit(), h.jumlah());
    }

    function invariant_hashMenunjukTokennyaSendiri() public view {
        for (uint256 id = 1; id <= h.jumlah(); ++id) {
            assertEq(k.tokenDariHash(k.ijazah(id).docHash), id);
        }
    }
}
```

- [ ] **Step 3: Ukur gas**

`contracts/test/UkurGas.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console} from "forge-std/console.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

/// Data gas untuk BAB IV. Jalankan: forge test --match-contract UkurGas -vv
contract UkurGasTest is Dasar {
    function test_ukurGas() public {
        uint256 g = gasleft();
        uint256 id = _terbitkan(DOC);
        console.log("terbitkan tunggal (termasuk tanda tangan di tes):", g - gasleft());

        uint256[4] memory ukuran = [uint256(1), 10, 25, 50];
        for (uint256 j; j < ukuran.length; ++j) {
            uint256 n = ukuran[j];
            (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) =
                _batch(n, string.concat("gas", vm.toString(n)));
            vm.prank(operator);
            g = gasleft();
            k.terbitkanBatch(p, s, u);
            uint256 pakai = g - gasleft();
            console.log("batch", n, pakai);
            console.log("  per ijazah", pakai / n);
        }

        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "salah nama ibu");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.prank(operator);
        g = gasleft();
        k.cabut(c, sig, "salah nama ibu");
        console.log("cabut:", g - gasleft());
    }
}
```

- [ ] **Step 4: Jalankan semua tes + laporan gas**

Run: `forge test && forge test --match-contract UkurGas -vv && forge test --gas-report --match-contract BatchCabutTest | tail -30 && forge fmt --check`
Expected: semua tes lulus (fuzz 1000 run, invariant 128×32); log `batch 1/10/25/50` beserta `per ijazah`; tabel gas report untuk `terbitkan`, `terbitkanBatch`, dan `cabut`. Jika `vm.expectPartialRevert` tidak dikenal di forge-std v1.17.0, ganti dengan `vm.expectRevert(PusakaIjazah.PenandaTanganTidakBerwenang.selector)` lalu ulangi.

- [ ] **Step 5: Commit**

```bash
git add contracts/test
git commit -m "test(kontrak): fuzz, invariant soulbound, dan ukur gas batch 1/10/25/50"
```

---

### Task 5: Skrip deploy, ekspor ABI, dan CI kontrak

**Files:**
- Create: `contracts/script/Deploy.s.sol`, `contracts/script/ekspor-abi.sh`, `abi/PusakaIjazah.json` (generated)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  - `abi/PusakaIjazah.json` (array ABI), dipakai `alloy::sol!` di rencana 04 dan viem di rencana 05.
  - `contracts/deployments/<chainId>.json` berisi `{"alamat": "0x…", "chainId": n, "blokDeploy": n}`.
  - Deploy lokal standar: admin = Anvil #0, `PENANDATANGAN` = Anvil #2 (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`), `OPERATOR` = Anvil #3 (`0x90F79bf6EB2c4f870365E785982E1f101E93b906`), alumni contoh = Anvil #1. Alamat kontrak pertama di Anvil baru = `0x5FbDB2315678afecb367f032d93F642f64180aa3`.

- [ ] **Step 1: Skrip deploy**

`contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";

/// Env: DEPLOYER_PK, OPERATOR, PENANDATANGAN.
/// Lokal: forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract Deploy is Script {
    function run() external returns (PusakaIjazah k) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address operator = vm.envAddress("OPERATOR");
        address penandaTangan = vm.envAddress("PENANDATANGAN");

        vm.startBroadcast(pk);
        k = new PusakaIjazah(vm.addr(pk));
        k.grantRole(k.OPERATOR_ROLE(), operator);
        k.grantRole(k.PENANDATANGAN_ROLE(), penandaTangan);
        vm.stopBroadcast();

        string memory j = "deploy";
        vm.serializeAddress(j, "alamat", address(k));
        vm.serializeUint(j, "chainId", block.chainid);
        string memory isi = vm.serializeUint(j, "blokDeploy", block.number);
        vm.writeJson(isi, string.concat("deployments/", vm.toString(block.chainid), ".json"));
        console.log("PusakaIjazah:", address(k));
    }
}
```

- [ ] **Step 2: Skrip ekspor ABI**

`contracts/script/ekspor-abi.sh`:
```bash
#!/usr/bin/env bash
# Tulis ABI kontrak ke abi/PusakaIjazah.json (dipakai Rust dan web).
set -euo pipefail
cd "$(dirname "$0")/.."
forge build --silent
mkdir -p ../abi
jq '.abi' out/PusakaIjazah.sol/PusakaIjazah.json > ../abi/PusakaIjazah.json
echo "ABI: abi/PusakaIjazah.json ($(jq length ../abi/PusakaIjazah.json) entri)"
```

Run: `chmod +x contracts/script/ekspor-abi.sh && contracts/script/ekspor-abi.sh`
Expected: `ABI: abi/PusakaIjazah.json (N entri)` dengan N > 40.

- [ ] **Step 3: Uji deploy ke Anvil**

```bash
anvil --silent &
sleep 2
cd contracts
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
OPERATOR=0x90F79bf6EB2c4f870365E785982E1f101E93b906 \
PENANDATANGAN=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
cat deployments/31337.json
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "domainSeparator()(bytes32)" --rpc-url http://127.0.0.1:8545
pkill anvil
```
Expected: `"alamat": "0x5FbDB2315678afecb367f032d93F642f64180aa3"`, dan `domainSeparator` = `0x234afa7e8e5a1ef9ad82593a023f56bd249579702732f95795cd18b5e39ed04c` (sama dengan vektor ethers).

- [ ] **Step 4: Job CI kontrak**

Tambahkan ke `.github/workflows/ci.yml` di bawah `jobs:`:
```yaml
  kontrak:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: contracts } }
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge fmt --check
      - run: forge test
      - run: ./script/ekspor-abi.sh && git diff --exit-code ../abi
```

- [ ] **Step 5: Commit, push, PR**

```bash
git add contracts/script abi .github/workflows/ci.yml
git commit -m "feat(kontrak): skrip deploy, ekspor ABI, job CI kontrak"
git push -u origin feat/pusaka-v2-kontrak
gh pr create --base main --title "PUSAKA v2: kontrak PusakaIjazah" \
  --body "Rencana 02: ERC-721 soulbound (ERC-5192), terbit/cabut dengan tanda tangan EIP-712 pejabat, batch maks 50, daftar per halaman. Tes unit + fuzz + invariant, data gas, deploy Anvil, ABI di abi/."
```
Expected: CI job `kontrak` hijau; URL PR tercetak.
