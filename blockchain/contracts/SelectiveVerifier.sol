// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SelectiveVerifier
 * @dev Simulates Zero-Knowledge Selective Disclosure.
 *
 * Instead of revealing actual data, the user:
 * 1. Hashes their data off-chain (e.g., keccak256(age || salt))
 * 2. Signs the hash with their private key
 * 3. Submits the signature + claim for on-chain verification
 *
 * The contract verifies the signature matches the claimed identity,
 * without knowing the actual data value.
 *
 * This demonstrates the ZK concept in a simplified, educational way.
 */
contract SelectiveVerifier {
    // ── Enums ─────────────────────────────────────────────────────────────────
    enum ClaimType { AGE_ABOVE_18, INCOME_ABOVE_X, DEGREE_VERIFIED }

    // ── Structs ───────────────────────────────────────────────────────────────
    struct Proof {
        bytes32    dataHash;     // keccak256 hash of the actual data
        bytes      signature;    // ECDSA signature of dataHash by owner
        ClaimType  claimType;    // What is being proven
        uint256    timestamp;    // When this proof was generated
        bool       isVerified;   // Whether contract confirmed valid
    }

    // ── State Variables ───────────────────────────────────────────────────────
    // owner → claimType → Proof
    mapping(address => mapping(uint8 => Proof)) public proofs;
    // List of all verified addresses (for demo purposes)
    address[] public verifiedAddresses;

    // ── Events ────────────────────────────────────────────────────────────────
    event ProofSubmitted(
        address indexed user,
        ClaimType claimType,
        bytes32 dataHash,
        uint256 timestamp
    );
    event ProofVerified(
        address indexed user,
        ClaimType claimType,
        bool success,
        uint256 timestamp
    );

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Submit a proof for a specific claim.
     * @param dataHash keccak256(actualData + salt) — never reveals actual value
     * @param signature ECDSA signature of dataHash using caller's private key
     * @param claimType The type of claim being made (AGE_ABOVE_18, etc.)
     */
    function submitProof(
        bytes32 dataHash,
        bytes calldata signature,
        ClaimType claimType
    ) external {
        proofs[msg.sender][uint8(claimType)] = Proof({
            dataHash:   dataHash,
            signature:  signature,
            claimType:  claimType,
            timestamp:  block.timestamp,
            isVerified: false
        });

        emit ProofSubmitted(msg.sender, claimType, dataHash, block.timestamp);
    }

    /**
     * @notice Verify a previously submitted proof.
     * Recovers signer from signature and confirms it matches msg.sender.
     * @param claimType Which claim to verify.
     * @return success Whether the proof is valid.
     */
    function verifyProof(ClaimType claimType) external returns (bool success) {
        Proof storage p = proofs[msg.sender][uint8(claimType)];
        require(p.timestamp > 0, "SelectiveVerifier: No proof submitted");

        // Recover the signer from the signature
        address recoveredSigner = _recoverSigner(p.dataHash, p.signature);

        // The proof is valid if the signature was made by the caller
        success = (recoveredSigner == msg.sender);
        p.isVerified = success;

        if (success) {
            verifiedAddresses.push(msg.sender);
        }

        emit ProofVerified(msg.sender, claimType, success, block.timestamp);
    }

    /**
     * @notice Check if an address has a verified claim.
     */
    function isVerified(address user, ClaimType claimType) external view returns (bool) {
        return proofs[user][uint8(claimType)].isVerified;
    }

    /**
     * @notice Get proof details for a user.
     */
    function getProof(address user, ClaimType claimType) external view returns (
        bytes32 dataHash,
        uint256 timestamp,
        bool verified
    ) {
        Proof storage p = proofs[user][uint8(claimType)];
        return (p.dataHash, p.timestamp, p.isVerified);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    /**
     * @dev Recover ECDSA signer from a hash and its signature.
     * Uses Ethereum's personal_sign prefix.
     */
    function _recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        require(signature.length == 65, "SelectiveVerifier: Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8   v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "SelectiveVerifier: Invalid signature v value");

        return ecrecover(ethSignedHash, v, r, s);
    }
}
