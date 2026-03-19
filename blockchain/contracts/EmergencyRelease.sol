// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmergencyRelease
 * @author LifeVault AI Team
 * @dev Digital dead man's switch with OpenZeppelin security guards.
 *
 * If a vault owner doesn't "check in" (recordActivity) within their configured
 * inactivity period, the trusted beneficiary can trigger emergency release,
 * which reveals the encrypted vault key on-chain via events.
 *
 * Security features:
 *   - ReentrancyGuard on ALL state-changing functions
 *   - Pausable: contract owner can pause triggers in emergencies
 *   - Ownable: contract-level admin controls (pause, unpause)
 *   - configId mapping: each user can have multiple emergency configs
 *   - Minimum inactivity period: 7 days (prevents accidental triggers)
 *
 * Inactivity is measured using block.timestamp.
 */
contract EmergencyRelease is ReentrancyGuard, Pausable, Ownable {

    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant MIN_INACTIVITY_PERIOD = 7 days;

    // ── Structs ───────────────────────────────────────────────────────────────
    struct EmergencyConfig {
        address owner;              // Vault owner
        address trustedAddress;     // Beneficiary who can trigger release
        uint256 inactivityPeriod;   // Seconds of inactivity before release
        uint256 lastActivity;       // Timestamp of last owner interaction
        bool    isActive;           // Whether emergency config exists
        bool    hasBeenReleased;    // Whether vault has been released
        string  encryptedVaultKey;  // The encrypted key revealed on release
    }

    // ── State Variables ───────────────────────────────────────────────────────
    mapping(bytes32 => EmergencyConfig) private _configs;
    mapping(address => bytes32[]) private _userConfigIds;
    uint256 private _configNonce;

    // ── Events ────────────────────────────────────────────────────────────────
    event ConfigCreated(
        address indexed owner,
        bytes32 indexed configId,
        address trustedAddress,
        uint256 inactivityPeriod,
        uint256 timestamp
    );
    event ActivityRecorded(
        address indexed owner,
        bytes32 indexed configId,
        uint256 timestamp
    );
    event ReleaseTriggered(
        address indexed triggeredBy,
        bytes32 indexed configId,
        address indexed owner,
        string encryptedVaultKey,
        uint256 timestamp
    );
    event ConfigRevoked(
        address indexed owner,
        bytes32 indexed configId,
        uint256 timestamp
    );
    event ConfigUpdated(
        address indexed owner,
        bytes32 indexed configId,
        string field,
        uint256 timestamp
    );

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Set up a new emergency release configuration.
     * @param trustedAddress The beneficiary wallet address.
     * @param inactivityPeriod Seconds of inactivity before release (min 7 days).
     * @param encryptedVaultKey The encrypted key stored for emergency use.
     * @return configId The unique identifier for this configuration.
     */
    function setupEmergencyRelease(
        address trustedAddress,
        uint256 inactivityPeriod,
        string calldata encryptedVaultKey
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(trustedAddress != address(0), "EmergencyRelease: Zero address");
        require(trustedAddress != msg.sender, "EmergencyRelease: Self-trust not allowed");
        require(inactivityPeriod >= MIN_INACTIVITY_PERIOD, "EmergencyRelease: Below 7-day minimum");
        require(bytes(encryptedVaultKey).length > 0, "EmergencyRelease: Empty vault key");

        _configNonce++;
        bytes32 configId = keccak256(
            abi.encodePacked(msg.sender, _configNonce, block.timestamp)
        );

        _configs[configId] = EmergencyConfig({
            owner:              msg.sender,
            trustedAddress:     trustedAddress,
            inactivityPeriod:   inactivityPeriod,
            lastActivity:       block.timestamp,
            isActive:           true,
            hasBeenReleased:    false,
            encryptedVaultKey:  encryptedVaultKey
        });

        _userConfigIds[msg.sender].push(configId);

        emit ConfigCreated(msg.sender, configId, trustedAddress, inactivityPeriod, block.timestamp);
        return configId;
    }

    /**
     * @notice Owner records activity for a specific config (resets inactivity clock).
     * @param configId The config to record activity for.
     */
    function recordActivity(bytes32 configId) external nonReentrant {
        EmergencyConfig storage config = _configs[configId];
        require(config.isActive, "EmergencyRelease: Config not found");
        require(msg.sender == config.owner, "EmergencyRelease: Not owner");
        require(!config.hasBeenReleased, "EmergencyRelease: Already released");

        config.lastActivity = block.timestamp;
        emit ActivityRecorded(msg.sender, configId, block.timestamp);
    }

    /**
     * @notice Record activity for ALL active configs of msg.sender (batch heartbeat).
     */
    function recordActivityAll() external nonReentrant {
        bytes32[] storage ids = _userConfigIds[msg.sender];
        require(ids.length > 0, "EmergencyRelease: No configs");

        for (uint256 i = 0; i < ids.length; i++) {
            EmergencyConfig storage config = _configs[ids[i]];
            if (config.isActive && !config.hasBeenReleased) {
                config.lastActivity = block.timestamp;
                emit ActivityRecorded(msg.sender, ids[i], block.timestamp);
            }
        }
    }

    /**
     * @notice Trusted address triggers emergency release after inactivity.
     * @param configId The config to trigger release for.
     */
    function triggerEmergencyRelease(bytes32 configId) external nonReentrant whenNotPaused {
        EmergencyConfig storage config = _configs[configId];

        require(config.isActive, "EmergencyRelease: Config not found");
        require(!config.hasBeenReleased, "EmergencyRelease: Already released");
        require(msg.sender == config.trustedAddress, "EmergencyRelease: Not trusted address");

        uint256 inactiveDuration = block.timestamp - config.lastActivity;
        require(
            inactiveDuration >= config.inactivityPeriod,
            "EmergencyRelease: Owner still active"
        );

        config.hasBeenReleased = true;

        emit ReleaseTriggered(
            msg.sender,
            configId,
            config.owner,
            config.encryptedVaultKey,
            block.timestamp
        );
    }

    /**
     * @notice Update the trusted address for a config (owner only).
     * @param configId The config to update.
     * @param newTrusted The new beneficiary address.
     */
    function updateTrustedAddress(bytes32 configId, address newTrusted) external nonReentrant {
        EmergencyConfig storage config = _configs[configId];
        require(config.isActive, "EmergencyRelease: Config not found");
        require(msg.sender == config.owner, "EmergencyRelease: Not owner");
        require(newTrusted != address(0) && newTrusted != msg.sender, "EmergencyRelease: Invalid address");

        config.trustedAddress = newTrusted;
        emit ConfigUpdated(msg.sender, configId, "trustedAddress", block.timestamp);
    }

    /**
     * @notice Update the inactivity period for a config (owner only).
     * @param configId The config to update.
     * @param newPeriod New inactivity period in seconds (min 7 days).
     */
    function updateInactivityPeriod(bytes32 configId, uint256 newPeriod) external nonReentrant {
        EmergencyConfig storage config = _configs[configId];
        require(config.isActive, "EmergencyRelease: Config not found");
        require(msg.sender == config.owner, "EmergencyRelease: Not owner");
        require(newPeriod >= MIN_INACTIVITY_PERIOD, "EmergencyRelease: Below 7-day minimum");

        config.inactivityPeriod = newPeriod;
        emit ConfigUpdated(msg.sender, configId, "inactivityPeriod", block.timestamp);
    }

    /**
     * @notice Update the encrypted vault key (owner only, only if not yet released).
     * @param configId The config to update.
     * @param newKey The new encrypted decryption key.
     */
    function updateEncryptedVaultKey(bytes32 configId, string calldata newKey) external nonReentrant {
        EmergencyConfig storage config = _configs[configId];
        require(config.isActive, "EmergencyRelease: Config not found");
        require(msg.sender == config.owner, "EmergencyRelease: Not owner");
        require(!config.hasBeenReleased, "EmergencyRelease: Already released");
        require(bytes(newKey).length > 0, "EmergencyRelease: Empty key");

        config.encryptedVaultKey = newKey;
        emit ConfigUpdated(msg.sender, configId, "encryptedVaultKey", block.timestamp);
    }

    /**
     * @notice Revoke an emergency config permanently (owner only).
     * @param configId The config to revoke.
     */
    function revokeConfig(bytes32 configId) external nonReentrant {
        EmergencyConfig storage config = _configs[configId];
        require(config.isActive, "EmergencyRelease: Config not found");
        require(msg.sender == config.owner, "EmergencyRelease: Not owner");

        config.isActive = false;
        emit ConfigRevoked(msg.sender, configId, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Validates a config and returns time until release.
     * @param configId The config to verify.
     * @return isValid Whether the config is active and unreleased.
     * @return timeUntilRelease Seconds until release can be triggered (0 = triggerable).
     */
    function verifyConfig(bytes32 configId) external view returns (bool isValid, uint256 timeUntilRelease) {
        EmergencyConfig storage config = _configs[configId];
        if (!config.isActive || config.hasBeenReleased) {
            return (false, type(uint256).max);
        }

        uint256 elapsed = block.timestamp - config.lastActivity;
        if (elapsed >= config.inactivityPeriod) {
            return (true, 0);
        }
        return (true, config.inactivityPeriod - elapsed);
    }

    /**
     * @notice Get detailed config information.
     * @param configId The config to query.
     */
    function getConfig(bytes32 configId) external view returns (
        address configOwner,
        address trustedAddress,
        uint256 inactivityPeriod,
        uint256 lastActivity,
        bool isActive,
        bool hasBeenReleased
    ) {
        EmergencyConfig storage c = _configs[configId];
        return (c.owner, c.trustedAddress, c.inactivityPeriod, c.lastActivity, c.isActive, c.hasBeenReleased);
    }

    /**
     * @notice Get all config IDs for an owner.
     * @param ownerAddress The owner to query.
     * @return Array of configId bytes32 values.
     */
    function getConfigIds(address ownerAddress) external view returns (bytes32[] memory) {
        return _userConfigIds[ownerAddress];
    }

    // ── Admin Functions ───────────────────────────────────────────────────────

    /**
     * @notice Pause all release triggers (contract owner / admin only).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause release triggers.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
