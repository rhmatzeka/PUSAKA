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
