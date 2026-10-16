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
