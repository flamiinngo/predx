// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 10_000_000 * 1e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract DeployMockUSDC is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:", address(usdc));
        vm.stopBroadcast();
    }
}
