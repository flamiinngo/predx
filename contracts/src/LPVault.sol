// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPVault {
    using SafeERC20 for IERC20;

    address public owner;
    IERC20  public usdc;
    address public settlementEngine;
    address public sltpManager;
    address public positionManager;

    mapping(address => uint256) public shares;
    uint256 public totalShares;
    uint256 public totalDeposited;

    IERC20  public initToken;
    mapping(address => uint256) public pendingInitRewards;
    uint256 public rewardsPerShare;
    mapping(address => uint256) public rewardDebt;

    event Deposited(address indexed lp, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lp, uint256 amount, uint256 shares);
    event PayoutCovered(address indexed recipient, uint256 amount);
    event InitRewardClaimed(address indexed lp, uint256 amount);

    constructor(address _usdc) {
        owner = msg.sender;
        usdc  = IERC20(_usdc);
    }

    modifier onlyOwner() { require(msg.sender == owner, "Vault: not owner"); _; }
    modifier onlyAuthorized() {
        require(
            msg.sender == settlementEngine ||
            msg.sender == sltpManager      ||
            msg.sender == positionManager,
            "Vault: not authorized"
        );
        _;
    }

    function setContracts(address _settlement, address _sltp, address _pm, address _initToken)
        external onlyOwner
    {
        settlementEngine = _settlement;
        sltpManager      = _sltp;
        positionManager  = _pm;
        if (_initToken != address(0)) initToken = IERC20(_initToken);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Vault: zero amount");
        _updateRewards(msg.sender);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 newShares = (totalShares == 0 || totalDeposited == 0)
            ? amount
            : (amount * totalShares) / totalDeposited;
        shares[msg.sender] += newShares;
        totalShares        += newShares;
        totalDeposited     += amount;
        rewardDebt[msg.sender] = (shares[msg.sender] * rewardsPerShare) / 1e18;
        emit Deposited(msg.sender, amount, newShares);
    }

    function withdraw(uint256 shareAmount) external {
        require(shareAmount > 0 && shareAmount <= shares[msg.sender], "Vault: bad shares");
        _updateRewards(msg.sender);
        _claimInitRewards(msg.sender);
        uint256 usdcOut = (shareAmount * totalDeposited) / totalShares;
        shares[msg.sender] -= shareAmount;
        totalShares        -= shareAmount;
        totalDeposited     -= usdcOut;
        rewardDebt[msg.sender] = (shares[msg.sender] * rewardsPerShare) / 1e18;
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Withdrawn(msg.sender, usdcOut, shareAmount);
    }

    function receiveLoserFunds(uint256 amount) external onlyAuthorized {
        totalDeposited += amount;
    }

    /// @notice Pays out directly to recipient — avoids multi-hop transfer issues
    function coverPayout(uint256 amount, address recipient) external onlyAuthorized {
        require(usdc.balanceOf(address(this)) >= amount, "Vault: insufficient liquidity");
        if (totalDeposited >= amount) totalDeposited -= amount;
        usdc.safeTransfer(recipient, amount);
        emit PayoutCovered(recipient, amount);
    }

    function distributeInitRewards(uint256 amount) external onlyOwner {
        require(totalShares > 0, "Vault: no LPs");
        require(address(initToken) != address(0), "Vault: no INIT token");
        IERC20(initToken).safeTransferFrom(msg.sender, address(this), amount);
        rewardsPerShare += (amount * 1e18) / totalShares;
    }

    function claimInitRewards() external {
        _updateRewards(msg.sender);
        _claimInitRewards(msg.sender);
    }

    function getLPBalance(address lp) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[lp] * totalDeposited) / totalShares;
    }

    function getVaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function _updateRewards(address lp) internal {
        if (shares[lp] > 0) {
            uint256 accumulated = (shares[lp] * rewardsPerShare) / 1e18;
            pendingInitRewards[lp] += accumulated - rewardDebt[lp];
        }
        rewardDebt[lp] = (shares[lp] * rewardsPerShare) / 1e18;
    }

    function _claimInitRewards(address lp) internal {
        uint256 pending = pendingInitRewards[lp];
        if (pending > 0 && address(initToken) != address(0)) {
            pendingInitRewards[lp] = 0;
            IERC20(initToken).safeTransfer(lp, pending);
            emit InitRewardClaimed(lp, pending);
        }
    }
}
