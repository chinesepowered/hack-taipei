// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title GuardedWallet 阿嬤的守護錢包
/// @notice A stablecoin wallet whose refusals are enforced on-chain, not in a prompt.
///   - `owner` is the AI agent key acting for Ah-ma.
///   - Payments to allowlisted recipients within the daily limit go through directly.
///   - Anything else becomes a proposal that needs `threshold` guardian approvals.
///   - Any single guardian can reject a proposal. Guardians, not the owner, control the limit.
contract GuardedWallet {
    IERC20 public immutable token;
    address public owner;
    uint256 public dailyLimit;
    uint256 public threshold;
    address[] public guardians;

    mapping(address => bool) public isGuardian;
    mapping(address => bool) public allowlist;

    uint256 public spentToday;
    uint256 public currentDay;

    enum Status { Pending, Executed, Rejected }

    struct Proposal {
        address to;
        uint256 amount;
        string memo;
        uint8 riskScore;
        uint256 approvals;
        Status status;
        uint256 createdAt;
        address rejectedBy;
    }

    Proposal[] private _proposals;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    event PaymentExecuted(address indexed to, uint256 amount, string memo);
    event ProposalCreated(uint256 indexed id, address indexed to, uint256 amount, uint8 riskScore, string memo);
    event ProposalApproved(uint256 indexed id, address indexed guardian, uint256 approvals);
    event ProposalExecuted(uint256 indexed id);
    event ProposalRejected(uint256 indexed id, address indexed guardian);
    event AllowlistUpdated(address indexed who, bool allowed);
    event DailyLimitUpdated(uint256 newLimit);

    error NotOwner();
    error NotGuardian();
    error GuardiansRequired();
    error AlreadyDecided();
    error AlreadyApproved();
    error BadConfig();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyGuardian() {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        _;
    }

    constructor(
        address token_,
        address owner_,
        address[] memory guardians_,
        uint256 threshold_,
        uint256 dailyLimit_
    ) {
        if (guardians_.length == 0 || threshold_ == 0 || threshold_ > guardians_.length) revert BadConfig();
        token = IERC20(token_);
        owner = owner_;
        threshold = threshold_;
        dailyLimit = dailyLimit_;
        for (uint256 i = 0; i < guardians_.length; i++) {
            isGuardian[guardians_[i]] = true;
            guardians.push(guardians_[i]);
        }
        currentDay = block.timestamp / 1 days;
    }

    // ---------- views ----------

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function guardianCount() external view returns (uint256) {
        return guardians.length;
    }

    function remainingToday() public view returns (uint256) {
        if (block.timestamp / 1 days != currentDay) return dailyLimit;
        return spentToday >= dailyLimit ? 0 : dailyLimit - spentToday;
    }

    /// @notice True when the owner may pay without guardian approval.
    function canPayDirectly(address to, uint256 amount) public view returns (bool) {
        return allowlist[to] && amount <= remainingToday();
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return _proposals[id];
    }

    // ---------- owner (the agent) ----------

    /// @notice Direct payment. Reverts unless allowlisted and within the daily limit.
    function pay(address to, uint256 amount, string calldata memo) external onlyOwner {
        if (!canPayDirectly(to, amount)) revert GuardiansRequired();
        _rollDay();
        spentToday += amount;
        _send(to, amount);
        emit PaymentExecuted(to, amount, memo);
    }

    /// @notice Park a risky payment until guardians decide. `riskScore` is the Scam Shield score, kept on-chain for the audit trail.
    function propose(address to, uint256 amount, string calldata memo, uint8 riskScore)
        external
        onlyOwner
        returns (uint256 id)
    {
        _proposals.push(
            Proposal({
                to: to,
                amount: amount,
                memo: memo,
                riskScore: riskScore,
                approvals: 0,
                status: Status.Pending,
                createdAt: block.timestamp,
                rejectedBy: address(0)
            })
        );
        id = _proposals.length - 1;
        emit ProposalCreated(id, to, amount, riskScore, memo);
    }

    function setAllowlist(address who, bool allowed) external onlyOwner {
        allowlist[who] = allowed;
        emit AllowlistUpdated(who, allowed);
    }

    // ---------- guardians (the family) ----------

    function approve(uint256 id) external onlyGuardian {
        Proposal storage p = _proposals[id];
        if (p.status != Status.Pending) revert AlreadyDecided();
        if (hasApproved[id][msg.sender]) revert AlreadyApproved();
        hasApproved[id][msg.sender] = true;
        p.approvals += 1;
        emit ProposalApproved(id, msg.sender, p.approvals);
        if (p.approvals >= threshold) {
            p.status = Status.Executed;
            _send(p.to, p.amount);
            emit ProposalExecuted(id);
            emit PaymentExecuted(p.to, p.amount, p.memo);
        }
    }

    function reject(uint256 id) external onlyGuardian {
        Proposal storage p = _proposals[id];
        if (p.status != Status.Pending) revert AlreadyDecided();
        p.status = Status.Rejected;
        p.rejectedBy = msg.sender;
        emit ProposalRejected(id, msg.sender);
    }

    /// @notice Only guardians can move the limit, so a scammer cannot talk Ah-ma into raising it.
    function setDailyLimit(uint256 newLimit) external onlyGuardian {
        dailyLimit = newLimit;
        emit DailyLimitUpdated(newLimit);
    }

    // ---------- internal ----------

    function _rollDay() internal {
        uint256 today = block.timestamp / 1 days;
        if (today != currentDay) {
            currentDay = today;
            spentToday = 0;
        }
    }

    function _send(address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed();
    }
}
