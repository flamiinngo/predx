// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/OracleConsumer.sol";
import "../src/LPVault.sol";
import "../src/MarketFactory.sol";
import "../src/PositionManager.sol";
import "../src/SLTPManager.sol";
import "../src/SettlementEngine.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 10_000_000 * 1e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract PredXTest is Test {
    MockUSDC        usdc;
    OracleConsumer  oracle;
    LPVault         vault;
    MarketFactory   factory;
    PositionManager pm;
    SLTPManager     sltp;
    SettlementEngine settlement;

    address owner   = address(this);
    address trader1 = address(0xA1);
    address trader2 = address(0xA2);
    address lp1     = address(0xB1);
    address keeper  = address(0xC1);

    function setUp() public {
        usdc       = new MockUSDC();
        oracle     = new OracleConsumer();
        vault      = new LPVault(address(usdc));
        factory    = new MarketFactory(address(oracle));
        pm         = new PositionManager(address(usdc), address(factory));
        sltp       = new SLTPManager(address(oracle), address(pm), address(vault));
        settlement = new SettlementEngine(address(factory), address(pm), address(vault), address(oracle));

        factory.setContracts(address(pm), address(vault), address(settlement));
        pm.setContracts(address(sltp), address(vault), address(settlement));
        vault.setContracts(address(settlement), address(sltp), address(pm), address(0));
        sltp.setKeeper(keeper);
        settlement.setKeeper(keeper);

        usdc.mint(trader1, 10_000 * 1e6);
        usdc.mint(trader2, 10_000 * 1e6);
        usdc.mint(lp1,     100_000 * 1e6);

        vm.prank(trader1); usdc.approve(address(pm), type(uint256).max);
        vm.prank(trader2); usdc.approve(address(pm), type(uint256).max);
        vm.prank(lp1);     usdc.approve(address(vault), type(uint256).max);
    }

    // ─────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────

    function _seedVault(uint256 amount) internal {
        vm.prank(lp1);
        vault.deposit(amount);
    }

    function _openMarket() internal returns (uint256 marketId) {
        marketId = factory.openMarket("BTC", MarketFactory.Timeframe.ONE_MIN);
    }

    function _openMarketAndSeedVault() internal returns (uint256 marketId) {
        _seedVault(50_000 * 1e6);
        marketId = _openMarket();
    }

    // ─────────────────────────────────────────────
    //  1. Oracle
    // ─────────────────────────────────────────────

    function test_oracle_fallback_prices() public view {
        assertEq(oracle.getPrice("BTC"),  83000 * 1e18);
        assertEq(oracle.getPrice("ETH"),  1800  * 1e18);
        assertEq(oracle.getPrice("INIT"), 15    * 1e17);
    }

    function test_oracle_set_fallback() public {
        oracle.setPrice("BTC", 90000 * 1e18);
        assertEq(oracle.getPrice("BTC"), 90000 * 1e18);
    }

    function test_oracle_unknown_symbol_reverts() public {
        vm.expectRevert(bytes("Oracle: no fallback price"));
        oracle.getPrice("SOL");
    }

    // ─────────────────────────────────────────────
    //  2. Market factory
    // ─────────────────────────────────────────────

    function test_open_market() public {
        uint256 mid = _openMarket();
        assertEq(mid, 1);
        MarketFactory.Market memory m = factory.getMarket(mid);
        assertEq(m.symbol,      "BTC");
        assertEq(m.strikePrice, 83000 * 1e18);
        assertEq(m.endTime,     block.timestamp + 1 minutes);
        assertFalse(m.settled);
    }

    function test_open_all_nine_markets() public {
        settlement.bootstrapMarkets();
        assertGt(factory.getActiveMarketId("BTC",  MarketFactory.Timeframe.ONE_MIN),     0);
        assertGt(factory.getActiveMarketId("BTC",  MarketFactory.Timeframe.FIVE_MIN),    0);
        assertGt(factory.getActiveMarketId("BTC",  MarketFactory.Timeframe.FIFTEEN_MIN), 0);
        assertGt(factory.getActiveMarketId("ETH",  MarketFactory.Timeframe.ONE_MIN),     0);
        assertGt(factory.getActiveMarketId("INIT", MarketFactory.Timeframe.ONE_MIN),     0);
    }

    function test_probability_starts_at_50_50() public {
        uint256 mid = _openMarket();
        assertEq(factory.getHigherProbability(mid), 5000);
    }

    function test_time_remaining() public {
        uint256 mid = _openMarket();
        uint256 rem = factory.getTimeRemaining(mid);
        assertGt(rem, 50);
        assertLe(rem, 60);
    }

    // ─────────────────────────────────────────────
    //  3. LP Vault
    // ─────────────────────────────────────────────

    function test_lp_deposit() public {
        _seedVault(10_000 * 1e6);
        assertEq(vault.totalDeposited(), 10_000 * 1e6);
        assertEq(vault.getLPBalance(lp1), 10_000 * 1e6);
    }

    function test_lp_withdraw() public {
        _seedVault(10_000 * 1e6);
        uint256 shares = vault.shares(lp1);
        vm.prank(lp1);
        vault.withdraw(shares);
        assertEq(vault.getLPBalance(lp1), 0);
        assertEq(usdc.balanceOf(lp1), 100_000 * 1e6);
    }

    function test_lp_zero_deposit_reverts() public {
        vm.prank(lp1);
        vm.expectRevert("Vault: zero amount");
        vault.deposit(0);
    }

    // ─────────────────────────────────────────────
    //  4. Positions
    // ─────────────────────────────────────────────

    function test_open_position_higher() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1);
        uint256 posId = pm.openPosition(mid, true, 100 * 1e6, 0, 0);

        PositionManager.Position memory p = pm.getPosition(posId);
        assertEq(p.trader,   trader1);
        assertEq(p.marketId, mid);
        assertTrue(p.higher);
        assertFalse(p.closed);
        assertEq(p.size, 98 * 1e6); // 100 - 2% fee
    }

    function test_open_position_lower() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader2);
        uint256 posId = pm.openPosition(mid, false, 200 * 1e6, 0, 0);

        PositionManager.Position memory p = pm.getPosition(posId);
        assertFalse(p.higher);
        assertEq(p.size, 196 * 1e6); // 200 - 2%
    }

    function test_probability_updates_with_positions() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1); pm.openPosition(mid, true,  300 * 1e6, 0, 0);
        vm.prank(trader2); pm.openPosition(mid, false, 100 * 1e6, 0, 0);
        uint256 prob = factory.getHigherProbability(mid);
        assertGt(prob, 7000);
        assertLt(prob, 8000);
    }

    function test_position_below_min_reverts() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1);
        vm.expectRevert("PM: invalid size");
        pm.openPosition(mid, true, 0, 0, 0);
    }

    function test_position_on_settled_market_reverts() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.warp(block.timestamp + 2 minutes);
        vm.prank(keeper); settlement.settle(mid);
        vm.prank(trader1);
        vm.expectRevert("PM: market settled");
        pm.openPosition(mid, true, 100 * 1e6, 0, 0);
    }

    // ─────────────────────────────────────────────
    //  5. Settlement
    // ─────────────────────────────────────────────

    function _setupSettlementTest() internal returns (uint256 mid, uint256 pos1, uint256 pos2) {
        _seedVault(50_000 * 1e6);
        mid = _openMarket();

        vm.prank(trader1); pos1 = pm.openPosition(mid, true,  100 * 1e6, 0, 0);
        vm.prank(trader2); pos2 = pm.openPosition(mid, false, 100 * 1e6, 0, 0);

        // manually register positions with settlement engine
        // (in production PositionManager calls this — wiring it here for tests)
        vm.prank(address(pm)); settlement.registerPosition(mid, pos1);
        vm.prank(address(pm)); settlement.registerPosition(mid, pos2);
    }

    function test_settlement_higher_wins() public {
        (uint256 mid, uint256 pos1,) = _setupSettlementTest();

        oracle.setPrice("BTC", 84000 * 1e18); // price UP — HIGHER wins
        uint256 balBefore = usdc.balanceOf(trader1);

        vm.warp(block.timestamp + 61 seconds);
        vm.prank(keeper); settlement.settle(mid);

        assertGt(usdc.balanceOf(trader1), balBefore, "HIGHER winner should receive payout");
        PositionManager.Position memory p = pm.getPosition(pos1);
        assertTrue(p.closed);
        assertTrue(p.won);
    }

    function test_settlement_lower_wins() public {
        (uint256 mid,, uint256 pos2) = _setupSettlementTest();

        oracle.setPrice("BTC", 82000 * 1e18); // price DOWN — LOWER wins
        uint256 balBefore = usdc.balanceOf(trader2);

        vm.warp(block.timestamp + 61 seconds);
        vm.prank(keeper); settlement.settle(mid);

        assertGt(usdc.balanceOf(trader2), balBefore, "LOWER winner should receive payout");
        PositionManager.Position memory p = pm.getPosition(pos2);
        assertTrue(p.closed);
        assertTrue(p.won);
    }

    function test_settlement_opens_next_market() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.warp(block.timestamp + 61 seconds);
        vm.prank(keeper); settlement.settle(mid);
        uint256 newMid = factory.getActiveMarketId("BTC", MarketFactory.Timeframe.ONE_MIN);
        assertGt(newMid, mid);
    }

    function test_settle_before_expiry_reverts() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(keeper);
        vm.expectRevert("SE: not expired");
        settlement.settle(mid);
    }

    // ─────────────────────────────────────────────
    //  6. SL/TP
    // ─────────────────────────────────────────────

    function test_stop_loss_triggers() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1);
        uint256 posId = pm.openPosition(mid, true, 100 * 1e6, 81000 * 1e18, 0);

        uint256 balBefore = usdc.balanceOf(trader1);
        oracle.setPrice("BTC", 80000 * 1e18);

        vm.prank(keeper); sltp.checkAndExecute();

        PositionManager.Position memory p = pm.getPosition(posId);
        assertTrue(p.closed, "Position closed after SL");
        assertGt(usdc.balanceOf(trader1), balBefore, "Trader gets SL refund");
    }

    function test_take_profit_triggers() public {
        // seed vault generously so it can cover 180% TP payout
        _seedVault(50_000 * 1e6);
        uint256 mid = _openMarket();

        vm.prank(trader1);
        uint256 posId = pm.openPosition(mid, true, 100 * 1e6, 0, 85000 * 1e18);

        uint256 balBefore = usdc.balanceOf(trader1);
        oracle.setPrice("BTC", 86000 * 1e18);

        vm.prank(keeper); sltp.checkAndExecute();

        PositionManager.Position memory p = pm.getPosition(posId);
        assertTrue(p.closed, "Position closed after TP");
        assertGt(usdc.balanceOf(trader1), balBefore, "Trader gets TP payout");
        assertGt(usdc.balanceOf(trader1) - balBefore, 50 * 1e6, "TP payout is substantial");
    }

    function test_sl_not_triggered_before_price_crosses() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1);
        uint256 posId = pm.openPosition(mid, true, 100 * 1e6, 81000 * 1e18, 0);

        oracle.setPrice("BTC", 82000 * 1e18); // above SL
        vm.prank(keeper); sltp.checkAndExecute();

        PositionManager.Position memory p = pm.getPosition(posId);
        assertFalse(p.closed, "Position should NOT be closed - price above SL");
    }

    function test_order_count_decreases_after_trigger() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.prank(trader1); pm.openPosition(mid, true,  100 * 1e6, 81000 * 1e18, 0);
        vm.prank(trader2); pm.openPosition(mid, false, 100 * 1e6, 85000 * 1e18, 0);

        assertEq(sltp.getActiveOrderCount(), 2);

        oracle.setPrice("BTC", 80000 * 1e18);
        vm.prank(keeper); sltp.checkAndExecute();

        assertEq(sltp.getActiveOrderCount(), 1);
    }

    // ─────────────────────────────────────────────
    //  7. Access control
    // ─────────────────────────────────────────────

    function test_only_keeper_can_settle() public {
        uint256 mid = _openMarketAndSeedVault();
        vm.warp(block.timestamp + 61 seconds);
        vm.prank(trader1);
        vm.expectRevert("SE: not keeper");
        settlement.settle(mid);
    }

    function test_only_keeper_can_execute_sltp() public {
        vm.prank(trader1);
        vm.expectRevert("SLTP: not keeper");
        sltp.checkAndExecute();
    }

    function test_only_pm_can_record_position() public {
        _openMarket();
        vm.prank(trader1);
        vm.expectRevert("MF: not PM");
        factory.recordPosition(1, true, 100 * 1e6);
    }

    function test_vault_unauthorized_payout_reverts() public {
        vm.prank(trader1);
        vm.expectRevert("Vault: not authorized");
        vault.coverPayout(100 * 1e6, trader1);
    }
}
