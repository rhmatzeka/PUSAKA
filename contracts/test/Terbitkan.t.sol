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
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, orang, peranOperator
            )
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
