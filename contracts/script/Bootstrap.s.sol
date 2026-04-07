// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
interface ISettlementEngine {
    function bootstrapMarkets() external;
}
contract Bootstrap is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        ISettlementEngine(0x2135898314ee406280cb09A8cF7010b200c7F279).bootstrapMarkets();
        console.log("All 9 markets bootstrapped");
        vm.stopBroadcast();
    }
}
