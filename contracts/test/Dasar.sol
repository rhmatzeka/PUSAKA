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

    function _penerbitan(bytes32 doc, string memory uri)
        internal
        pure
        returns (PusakaIjazah.Penerbitan memory)
    {
        return PusakaIjazah.Penerbitan({
            penerima: ALUMNI, docHash: doc, metadataHash: keccak256(bytes(uri)), batasWaktu: BATAS
        });
    }

    function _pencabutan(uint256 tokenId, string memory alasan)
        internal
        pure
        returns (PusakaIjazah.Pencabutan memory)
    {
        return PusakaIjazah.Pencabutan({
            tokenId: tokenId, alasanHash: keccak256(bytes(alasan)), batasWaktu: BATAS
        });
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
