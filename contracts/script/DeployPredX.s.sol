// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/OracleConsumer.sol";
import "../src/LPVault.sol";
import "../src/MarketFactory.sol";
import "../src/PositionManager.sol";
import "../src/SLTPManager.sol";
import "../src/SettlementEngine.sol";

contract DeployPredX is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address deployerAddr = vm.addr(deployerKey);
        address usdc         = vm.envAddress("USDC_ADDRESS");
        address keeper       = vm.envOr("KEEPER_ADDRESS", deployerAddr);

        vm.startBroadcast(deployerKey);

        OracleConsumer oracle     = new OracleConsumer();
        LPVault        vault      = new LPVault(usdc);
        MarketFactory  factory    = new MarketFactory(address(oracle));
        PositionManager pm        = new PositionManager(usdc, address(factory));
        SLTPManager    sltp       = new SLTPManager(address(oracle), address(pm), address(vault));
        SettlementEngine settle   = new SettlementEngine(address(factory), address(pm), address(vault), address(oracle));

        factory.setContracts(address(pm), address(vault), address(settle));
        pm.setContracts(address(sltp), address(vault), address(settle));
        vault.setContracts(address(settle), address(sltp), address(pm), address(0));
        sltp.setKeeper(keeper);
        settle.setKeeper(keeper);
        settle.bootstrapMarkets();

        vm.stopBroadcast();

        console.log("=== PredX Deployed ===");
        console.log("Oracle:     ", address(oracle));
        console.log("Vault:      ", address(vault));
        console.log("Factory:    ", address(factory));
        console.log("PM:         ", address(pm));
        console.log("SLTP:       ", address(sltp));
        console.log("Settlement: ", address(settle));
    }
}
