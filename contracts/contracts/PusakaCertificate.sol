// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title PUSAKA - ijazah digital UNPAM sebagai token ERC-721 soulbound
contract PusakaCertificate is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Sertifikat {
        bytes32 docHash;     // Keccak-256 dari bytes PDF
        bytes signature;     // tanda tangan ECDSA (EIP-191) penerbit atas docHash
        address penerbit;    // wallet BAAK yang menerbitkan
        uint64 diterbitkan;  // block.timestamp
        bool dicabut;
        string alasanCabut;
    }

    uint256 private _nextId = 1;
    mapping(uint256 => Sertifikat) private _sertifikat;
    mapping(bytes32 => uint256) public tokenOfHash;
    mapping(address => uint256[]) private _tokensOf;

    event CertificateIssued(uint256 indexed tokenId, address indexed to, bytes32 indexed docHash, address penerbit);
    event CertificateRevoked(uint256 indexed tokenId, string alasan);

    error HashSudahTerdaftar(bytes32 docHash);
    error TandaTanganTidakSah(address signer, address pengirim);
    error TidakDapatDipindahtangankan();
    error SertifikatTidakAda(uint256 tokenId);
    error SudahDicabut(uint256 tokenId);
    error PanjangArrayBerbeda();

    constructor(address admin) ERC721("PUSAKA Ijazah UNPAM", "PUSAKA") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function issue(address to, string calldata uri, bytes32 docHash, bytes calldata sig)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256)
    {
        return _issue(to, uri, docHash, sig);
    }

    function batchIssue(
        address[] calldata to,
        string[] calldata uri,
        bytes32[] calldata docHash,
        bytes[] calldata sig
    ) external onlyRole(ISSUER_ROLE) returns (uint256[] memory ids) {
        uint256 n = to.length;
        if (uri.length != n || docHash.length != n || sig.length != n) revert PanjangArrayBerbeda();
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = _issue(to[i], uri[i], docHash[i], sig[i]);
        }
    }

    function revoke(uint256 tokenId, string calldata alasan) external onlyRole(ISSUER_ROLE) {
        Sertifikat storage s = _sertifikat[tokenId];
        if (s.penerbit == address(0)) revert SertifikatTidakAda(tokenId);
        if (s.dicabut) revert SudahDicabut(tokenId);
        s.dicabut = true;
        s.alasanCabut = alasan;
        emit CertificateRevoked(tokenId, alasan);
    }

    /// Dipanggil halaman verifikasi (view, gratis). tokenId = 0 berarti hash tidak dikenal.
    function verifyByHash(bytes32 docHash)
        external
        view
        returns (uint256 tokenId, bool dicabut, bytes memory signature, address penerbit)
    {
        tokenId = tokenOfHash[docHash];
        if (tokenId == 0) return (0, false, "", address(0));
        Sertifikat storage s = _sertifikat[tokenId];
        return (tokenId, s.dicabut, s.signature, s.penerbit);
    }

    function getCertificate(uint256 tokenId) external view returns (Sertifikat memory) {
        if (_sertifikat[tokenId].penerbit == address(0)) revert SertifikatTidakAda(tokenId);
        return _sertifikat[tokenId];
    }

    function tokensOf(address pemilik) external view returns (uint256[] memory) {
        return _tokensOf[pemilik];
    }

    /// Jumlah ijazah yang pernah diterbitkan (termasuk yang dicabut). Token ID berurutan 1..totalIssued().
    function totalIssued() external view returns (uint256) {
        return _nextId - 1;
    }

    function _issue(address to, string calldata uri, bytes32 docHash, bytes calldata sig)
        internal
        returns (uint256 tokenId)
    {
        if (tokenOfHash[docHash] != 0) revert HashSudahTerdaftar(docHash);
        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(docHash), sig);
        if (signer != msg.sender) revert TandaTanganTidakSah(signer, msg.sender);

        tokenId = _nextId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _sertifikat[tokenId] = Sertifikat(docHash, sig, msg.sender, uint64(block.timestamp), false, "");
        tokenOfHash[docHash] = tokenId;
        _tokensOf[to].push(tokenId);
        emit CertificateIssued(tokenId, to, docHash, msg.sender);
    }

    // Soulbound: hanya mint (from == 0) yang diizinkan, transfer apa pun ditolak.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert TidakDapatDipindahtangankan();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
