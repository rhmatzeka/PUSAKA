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
