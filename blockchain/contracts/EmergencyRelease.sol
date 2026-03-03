// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EmergencyRelease
 * @dev Digital dead man's switch. If the owner doesn't "check in" within
 * the defined inactivity period, the trusted beneficiary can trigger
 * emergency release which reveals the encrypted vault key.
 *
 * This simulates real-world estate planning with smart contracts.
 * Inactivity is measured using block.timestamp.
 */
contract EmergencyRelease {
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
    mapping(address => EmergencyConfig) public configs;

    // ── Events ────────────────────────────────────────────────────────────────
    event EmergencyConfigSet(
        address indexed owner,
        address indexed trustedAddress,
        uint256 inactivityPeriod,
        uint256 timestamp
    );
    event ActivityRecorded(address indexed owner, uint256 timestamp);
    event EmergencyTriggered(
        address indexed owner,
        address indexed triggeredBy,
        string encryptedVaultKey,
        uint256 timestamp
    );
    event ConfigUpdated(address indexed owner, uint256 timestamp);

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Set up emergency release configuration.
     * @param trustedAddress The beneficiary wallet address.
     * @param inactivityPeriod Seconds of inactivity before release can be triggered.
     * @param encryptedVaultKey The encrypted decryption key stored for emergency use.
     */
    function setupEmergencyRelease(
        address trustedAddress,
        uint256 inactivityPeriod,
        string calldata encryptedVaultKey
    ) external {
        require(trustedAddress != address(0), "EmergencyRelease: Invalid trusted address");
        require(trustedAddress != msg.sender, "EmergencyRelease: Cannot set yourself as trusted");
        require(inactivityPeriod >= 60, "EmergencyRelease: Minimum inactivity is 60 seconds");

        configs[msg.sender] = EmergencyConfig({
            owner:              msg.sender,
            trustedAddress:     trustedAddress,
            inactivityPeriod:   inactivityPeriod,
            lastActivity:       block.timestamp,
            isActive:           true,
            hasBeenReleased:    false,
            encryptedVaultKey:  encryptedVaultKey
        });

        emit EmergencyConfigSet(msg.sender, trustedAddress, inactivityPeriod, block.timestamp);
    }

    /**
     * @notice Owner records activity (resets the inactivity clock).
     * Call this periodically to prevent emergency release.
     */
    function recordActivity() external {
        require(configs[msg.sender].isActive, "EmergencyRelease: No config found");
        require(!configs[msg.sender].hasBeenReleased, "EmergencyRelease: Already released");

        configs[msg.sender].lastActivity = block.timestamp;
        emit ActivityRecorded(msg.sender, block.timestamp);
    }

    /**
     * @notice Trusted address triggers emergency release after inactivity.
     * @param ownerAddress The vault owner whose vault to release.
     */
    function triggerEmergencyRelease(address ownerAddress) external {
        EmergencyConfig storage config = configs[ownerAddress];

        require(config.isActive, "EmergencyRelease: No config for this owner");
        require(!config.hasBeenReleased, "EmergencyRelease: Already released");
        require(msg.sender == config.trustedAddress, "EmergencyRelease: Not the trusted address");

        uint256 inactiveDuration = block.timestamp - config.lastActivity;
        require(
            inactiveDuration >= config.inactivityPeriod,
            "EmergencyRelease: Owner is still active"
        );

        config.hasBeenReleased = true;

        emit EmergencyTriggered(
            ownerAddress,
            msg.sender,
            config.encryptedVaultKey,
            block.timestamp
        );
    }

    /**
     * @notice Update the trusted address (owner only).
     */
    function updateTrustedAddress(address newTrusted) external {
        require(configs[msg.sender].isActive, "EmergencyRelease: No config found");
        require(newTrusted != address(0) && newTrusted != msg.sender, "EmergencyRelease: Invalid address");

        configs[msg.sender].trustedAddress = newTrusted;
        emit ConfigUpdated(msg.sender, block.timestamp);
    }

    /**
     * @notice Check how many seconds until release can be triggered.
     * Returns 0 if already triggerable.
     */
    function timeUntilRelease(address ownerAddress) external view returns (uint256) {
        EmergencyConfig storage config = configs[ownerAddress];
        if (!config.isActive) return type(uint256).max;

        uint256 elapsed = block.timestamp - config.lastActivity;
        if (elapsed >= config.inactivityPeriod) return 0;
        return config.inactivityPeriod - elapsed;
    }

    /**
     * @notice Get config details for an owner.
     */
    function getConfig(address ownerAddress) external view returns (
        address trustedAddress,
        uint256 inactivityPeriod,
        uint256 lastActivity,
        bool isActive,
        bool hasBeenReleased
    ) {
        EmergencyConfig storage c = configs[ownerAddress];
        return (c.trustedAddress, c.inactivityPeriod, c.lastActivity, c.isActive, c.hasBeenReleased);
    }
}
