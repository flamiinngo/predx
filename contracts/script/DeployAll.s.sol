// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/OracleConsumer.sol";
import "../src/LPVault.sol";
import "../src/MarketFactory.sol";
import "../src/PositionManager.sol";
import "../src/SLTPManager.sol";
import "../src/SettlementEngine.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 100_000_000 * 1e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract DeployAll is Script {
    address constant TESTER = 0x8f457a8C4891952CEC10859f7c1156697732f1dd;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Reuse existing USDC if USDC_ADDRESS env is set (avoids redeploying a working token)
        address existingUsdc = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(pk);

        address usdcAddr;
        if (existingUsdc != address(0)) {
            usdcAddr = existingUsdc;
            console.log("USDC (reused):", usdcAddr);
        } else {
            MockUSDC usdc = new MockUSDC();
            usdcAddr = address(usdc);
            console.log("USDC (new):   ", usdcAddr);
        }

        OracleConsumer  oracle  = new OracleConsumer();
        LPVault         vault   = new LPVault(usdcAddr);
        MarketFactory   factory = new MarketFactory(address(oracle));
        PositionManager pm      = new PositionManager(usdcAddr, address(factory));
        SLTPManager     sltp    = new SLTPManager(address(oracle), address(pm), address(vault));
        SettlementEngine se     = new SettlementEngine(address(factory), address(pm), address(vault), address(oracle));

        // Wire all contracts together
        factory.setContracts(address(pm), address(vault), address(se));
        vault.setContracts(address(se), address(sltp), address(pm), address(0));
        pm.setContracts(address(sltp), address(vault), address(se));

        // Seed vault with 10k USDC
        ERC20(usdcAddr).approve(address(vault), 10_000 * 1e6);
        vault.deposit(10_000 * 1e6);

        // Give tester some USDC
        MockUSDC(usdcAddr).mint(TESTER, 10_000 * 1e6);

        console.log("Oracle:     ", address(oracle));
        console.log("Vault:      ", address(vault));
        console.log("Factory:    ", address(factory));
        console.log("PM:         ", address(pm));
        console.log("SLTP:       ", address(sltp));
        console.log("Settlement: ", address(se));

        vm.stopBroadcast();
    }
}
