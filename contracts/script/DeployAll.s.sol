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
        vm.startBroadcast(pk);

        MockUSDC usdc        = new MockUSDC();
        OracleConsumer oracle = new OracleConsumer();
        LPVault vault        = new LPVault(address(usdc));
        MarketFactory factory = new MarketFactory(address(oracle));
        PositionManager pm   = new PositionManager(address(usdc), address(factory));
        SLTPManager sltp     = new SLTPManager(address(oracle), address(pm), address(vault));
        SettlementEngine se  = new SettlementEngine(address(factory), address(pm), address(vault), address(oracle));

        factory.setContracts(address(pm), address(vault), address(se));
        usdc.mint(TESTER, 10_000 * 1e6);

        console.log("USDC:      ", address(usdc));
        console.log("Oracle:    ", address(oracle));
        console.log("Vault:     ", address(vault));
        console.log("Factory:   ", address(factory));
        console.log("PM:        ", address(pm));
        console.log("SLTP:      ", address(sltp));
        console.log("Settlement:", address(se));

        vm.stopBroadcast();
    }
}
