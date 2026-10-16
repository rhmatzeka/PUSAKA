// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

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
        vm.expectRevert(
            abi.encodeWithSelector(PusakaIjazah.PenandaTanganTidakBerwenang.selector, vm.addr(pk))
        );
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
        vm.prank(operator);
        vm.expectPartialRevert(PusakaIjazah.PenandaTanganTidakBerwenang.selector);
        k.terbitkan(p, sig, URI);
    }
}
