// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {PusakaIjazah} from "../src/PusakaIjazah.sol";
import {Dasar} from "./Dasar.sol";

/// Temuan review: penerbitan & pencabutan wajib melibatkan dua wallet berbeda.
contract PemisahanTugasTest is Dasar {
    function test_satuWalletDuaPeranTidakBolehMenerbitkanSendiri() public {
        (address ganda, uint256 pk) = makeAddrAndKey("dua-peran");
        bytes32 peranOperator = k.OPERATOR_ROLE();
        bytes32 peranTtd = k.PENANDATANGAN_ROLE();
        vm.startPrank(admin);
        k.grantRole(peranOperator, ganda);
        k.grantRole(peranTtd, ganda);
        vm.stopPrank();

        PusakaIjazah.Penerbitan memory p = _penerbitan(DOC, URI);
        bytes memory sig = _ttd(pk, k.digestPenerbitan(p));
        vm.prank(ganda);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PemisahanTugasDilanggar.selector, ganda));
        k.terbitkan(p, sig, URI);
    }

    function test_satuWalletDuaPeranTidakBolehMencabutSendiri() public {
        uint256 id = _terbitkan(DOC);
        bytes32 peranOperator = k.OPERATOR_ROLE();
        vm.prank(admin);
        k.grantRole(peranOperator, rektor);
        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "x");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.prank(rektor);
        vm.expectRevert(abi.encodeWithSelector(PusakaIjazah.PemisahanTugasDilanggar.selector, rektor));
        k.cabut(c, sig, "x");
    }

    function test_tandaTanganPenerbitanDitolakUntukCabut() public {
        uint256 id = _terbitkan(DOC);
        bytes memory sigPenerbitan = _ttd(PK_REKTOR, k.digestPenerbitan(_penerbitan(DOC, URI)));
        vm.prank(operator);
        vm.expectPartialRevert(PusakaIjazah.PenandaTanganTidakBerwenang.selector);
        k.cabut(_pencabutan(id, "x"), sigPenerbitan, "x");
    }

    function test_cabutDanBatchHanyaOperator() public {
        uint256 id = _terbitkan(DOC);
        address orang = makeAddr("orang");
        bytes32 peranOperator = k.OPERATOR_ROLE();

        PusakaIjazah.Pencabutan memory c = _pencabutan(id, "x");
        bytes memory sig = _ttd(PK_REKTOR, k.digestPencabutan(c));
        vm.prank(orang);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, orang, peranOperator
            )
        );
        k.cabut(c, sig, "x");

        (PusakaIjazah.Penerbitan[] memory p, bytes[] memory s, string[] memory u) = _batch(2, "op");
        vm.prank(orang);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, orang, peranOperator
            )
        );
        k.terbitkanBatch(p, s, u);
    }
}
