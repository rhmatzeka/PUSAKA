// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SmokeTest is Test {
    function test_remappingBekerja() public pure {
        assertEq(keccak256(""), 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470);
        assertEq(uint8(ECDSA.RecoverError.NoError), 0);
    }
}
