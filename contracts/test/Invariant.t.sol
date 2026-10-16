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
