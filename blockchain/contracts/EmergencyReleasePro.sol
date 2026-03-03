// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmergencyReleasePro
 * @dev Advanced Death-Man Switch with Guardian Multi-Sig and Veto Buffers.
 * This is the production-grade eVault AI release protocol.
 */
contract EmergencyReleasePro is ReentrancyGuard, Ownable {
    // ── Enums & Structs ───────────────────────────────────────────────────────

    enum ReleaseStatus { NONE, PENDING, RELEASED, CANCELLED }

    struct vault_config {
        address   owner;
        uint256   vetoBuffer;      // Seconds to wait after trigger before release
        uint256   triggerTime;     // Timestamp when release was triggered
        string    encryptedKey;    // The protected secret
        ReleaseStatus status;
        address[] guardians;       // List of authorized guardian wallets
    }

    // ── State Variables ───────────────────────────────────────────────────────

    mapping(address => vault_config) public vaults;
    mapping(address => mapping(address => bool)) public guardianApprovals; // owner => guardian => approved

    uint256 public constant MIN_VETO_BUFFER = 3600; // 1 Hour
    uint256 public constant MIN_GUARDIANS = 2;

    // ── Events ────────────────────────────────────────────────────────────────

    event VaultSecured(address indexed owner, uint256 vetoBuffer, uint256 timestamp);
    event ReleaseTriggered(address indexed owner, address indexed triggeredBy, uint256 releaseTime);
    event GuardianApproved(address indexed owner, address indexed guardian);
    event ReleaseFinalized(address indexed owner, string secret);
    event ReleaseCancelled(address indexed owner, uint256 timestamp);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyVaultOwner() {
        require(vaults[msg.sender].owner == msg.sender, "ERP: Not the vault owner");
        _;
    }

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Secure a vault with a secret key and guardian list.
     * @param _vetoBuffer Seconds the owner has to 'veto' a triggered release.
     * @param _guardians List of 2+ trusted guardian addresses.
     * @param _encryptedKey The encrypted vault key.
     */
    function secureVault(
        uint256 _vetoBuffer,
        address[] calldata _guardians,
        string calldata _encryptedKey
    ) external {
        require(_vetoBuffer >= MIN_VETO_BUFFER, "ERP: Veto buffer too short");
        require(_guardians.length >= MIN_GUARDIANS, "ERP: Insufficient guardians");
        require(bytes(_encryptedKey).length > 0, "ERP: Empty key");

        // Prevent self-guardian bypass
        for (uint256 i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != msg.sender, "ERP: Owner cannot be guardian");
        }

        vaults[msg.sender] = vault_config({
            owner: msg.sender,
            vetoBuffer: _vetoBuffer,
            triggerTime: 0,
            encryptedKey: _encryptedKey,
            status: ReleaseStatus.NONE,
            guardians: _guardians
        });

        emit VaultSecured(msg.sender, _vetoBuffer, block.timestamp);
    }

    /**
     * @notice A guardian triggers the release process. Starts the veto timer.
     * @param _owner The address of the vault to trigger.
     */
    function triggerRelease(address _owner) external {
        vault_config storage v = vaults[_owner];
        require(v.owner == _owner, "ERP: Vault not found");
        require(v.status == ReleaseStatus.NONE || v.status == ReleaseStatus.CANCELLED, "ERP: Cannot trigger now");

        // Check if caller is an authorized guardian
        bool isGuardian = false;
        for (uint256 i = 0; i < v.guardians.length; i++) {
            if (v.guardians[i] == msg.sender) isGuardian = true;
        }
        require(isGuardian, "ERP: Not an authorized guardian");

        v.status = ReleaseStatus.PENDING;
        v.triggerTime = block.timestamp;

        // Auto-approve by the triggering guardian
        guardianApprovals[_owner][msg.sender] = true;

        emit ReleaseTriggered(_owner, msg.sender, block.timestamp + v.vetoBuffer);
    }

    /**
     * @notice Other guardians must approve the release.
     * @param _owner The address of the vault.
     */
    function approveByGuardian(address _owner) external {
        vault_config storage v = vaults[_owner];
        require(v.status == ReleaseStatus.PENDING, "ERP: No pending release");

        bool isGuardian = false;
        for (uint256 i = 0; i < v.guardians.length; i++) {
            if (v.guardians[i] == msg.sender) isGuardian = true;
        }
        require(isGuardian, "ERP: Not an authorized guardian");
        require(!guardianApprovals[_owner][msg.sender], "ERP: Already approved");

        guardianApprovals[_owner][msg.sender] = true;
        emit GuardianApproved(_owner, msg.sender);
    }

    /**
     * @notice Finalize release after veto buffer and multi-sig consensus.
     * @param _owner The vault to finalize.
     */
    function finalizeRelease(address _owner) external nonReentrant {
        vault_config storage v = vaults[_owner];
        require(v.status == ReleaseStatus.PENDING, "ERP: Not pending");
        require(block.timestamp >= v.triggerTime + v.vetoBuffer, "ERP: Veto buffer active");

        // Count approvals
        uint256 approvedCount = 0;
        for (uint256 i = 0; i < v.guardians.length; i++) {
            if (guardianApprovals[_owner][v.guardians[i]]) approvedCount++;
        }
        require(approvedCount >= MIN_GUARDIANS, "ERP: Consensus not reached");

        v.status = ReleaseStatus.RELEASED;
        emit ReleaseFinalized(_owner, v.encryptedKey);
    }

    /**
     * @notice Owner cancels a pending release attempt (the "Veto").
     */
    function cancelRelease() external onlyVaultOwner {
        vault_config storage v = vaults[msg.sender];
        require(v.status == ReleaseStatus.PENDING, "ERP: No pending release to cancel");

        v.status = ReleaseStatus.CANCELLED;
        v.triggerTime = 0;

        // Reset all guardian approvals for security
        for (uint256 i = 0; i < v.guardians.length; i++) {
            guardianApprovals[msg.sender][v.guardians[i]] = false;
        }

        emit ReleaseCancelled(msg.sender, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    function getVaultStatus(address _owner) external view returns (
        ReleaseStatus status,
        uint256 timeRemaining,
        uint256 approvalCount
    ) {
        vault_config storage v = vaults[_owner];
        if (v.owner == address(0)) return (ReleaseStatus.NONE, 0, 0);

        uint256 remaining = 0;
        if (v.status == ReleaseStatus.PENDING) {
            uint256 releaseAt = v.triggerTime + v.vetoBuffer;
            remaining = block.timestamp < releaseAt ? releaseAt - block.timestamp : 0;
        }

        uint256 count = 0;
        for (uint256 i = 0; i < v.guardians.length; i++) {
            if (guardianApprovals[_owner][v.guardians[i]]) count++;
        }

        return (v.status, remaining, count);
    }
}
