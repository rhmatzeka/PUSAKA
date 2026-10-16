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
    error PemisahanTugasDilanggar(address wallet);

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

    // ------------------------------------------------------------------ baca

    function periksa(bytes32 docHash)
        external
        view
        returns (Status status, uint256 tokenId, Ijazah memory data)
    {
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
        return
            _hashTypedDataV4(
                keccak256(abi.encode(PENCABUTAN_TYPEHASH, c.tokenId, c.alasanHash, c.batasWaktu))
            );
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

    /// Pulihkan penanda tangan; tolak bila tanda tangan rusak, penanda tangan tak berperan,
    /// atau penanda tangan sama dengan pengirim transaksi.
    function _wajibPenandaTangan(bytes32 digest, bytes calldata sig) private view returns (address) {
        (address penandaTangan, ECDSA.RecoverError galat,) = ECDSA.tryRecover(digest, sig);
        if (galat != ECDSA.RecoverError.NoError || !hasRole(PENANDATANGAN_ROLE, penandaTangan)) {
            revert PenandaTanganTidakBerwenang(penandaTangan);
        }
        // Pemisahan tugas: pengirim transaksi (operator) tidak boleh menyetujui dirinya sendiri.
        if (penandaTangan == msg.sender) revert PemisahanTugasDilanggar(msg.sender);
        return penandaTangan;
    }

    /// Soulbound: hanya mint (pemilik lama = 0) yang diizinkan.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert TidakDapatDipindahtangankan();
        return super._update(to, tokenId, auth);
    }
}
