// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MerkleAnchor
 * @author LifeVault AI Team
 * @dev Gas-optimized document anchoring via Merkle roots.
 *
 * Instead of storing individual document hashes on-chain (expensive),
 * this contract batches multiple document hashes into a Merkle tree
 * and stores only the root — one transaction for N documents.
 *
 * Workflow:
 *   1. Backend collects document hashes off-chain
 *   2. Computes Merkle tree root off-chain
 *   3. Calls anchorBatch() with the root + count
 *   4. Users verify their document is included by providing a Merkle proof
 *
 * Gas savings: ~95% vs individual hash storage for batches of 100+
 */
contract MerkleAnchor is Ownable, ReentrancyGuard {

    // ── Structs ───────────────────────────────────────────────────────────────
    struct AnchorBatch {
        bytes32 merkleRoot;
        uint256 documentCount;
        uint256 timestamp;
        address anchoredBy;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    uint256 public batchCount;
    mapping(uint256 => AnchorBatch) public batches;
    mapping(bytes32 => bool) public anchoredRoots;

    // ── Events ────────────────────────────────────────────────────────────────
    event BatchAnchored(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 documentCount,
        address anchoredBy,
        uint256 timestamp
    );

    event DocumentVerified(
        bytes32 indexed documentHash,
        uint256 indexed batchId,
        bool isValid,
        uint256 timestamp
    );

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Anchor a Merkle root representing a batch of document hashes.
     * @param merkleRoot The Merkle tree root hash
     * @param documentCount Number of documents in this batch
     * @return batchId The ID of this anchor batch
     */
    function anchorBatch(
        bytes32 merkleRoot,
        uint256 documentCount
    ) external onlyOwner nonReentrant returns (uint256) {
        require(merkleRoot != bytes32(0), "MerkleAnchor: Empty root");
        require(documentCount > 0, "MerkleAnchor: Zero docs");
        require(!anchoredRoots[merkleRoot], "MerkleAnchor: Root already anchored");

        batchCount++;
        batches[batchCount] = AnchorBatch({
            merkleRoot: merkleRoot,
            documentCount: documentCount,
            timestamp: block.timestamp,
            anchoredBy: msg.sender
        });
        anchoredRoots[merkleRoot] = true;

        emit BatchAnchored(batchCount, merkleRoot, documentCount, msg.sender, block.timestamp);
        return batchCount;
    }

    /**
     * @notice Verify a document's inclusion in an anchored batch using a Merkle proof.
     * @param batchId The batch to verify against
     * @param documentHash The SHA-256 hash of the document
     * @param proof Array of sibling hashes forming the Merkle proof
     * @return isValid True if the document is in the batch
     */
    function verifyDocument(
        uint256 batchId,
        bytes32 documentHash,
        bytes32[] calldata proof
    ) external returns (bool) {
        AnchorBatch storage batch = batches[batchId];
        require(batch.merkleRoot != bytes32(0), "MerkleAnchor: Batch not found");

        bytes32 computedHash = documentHash;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        bool isValid = computedHash == batch.merkleRoot;

        emit DocumentVerified(documentHash, batchId, isValid, block.timestamp);
        return isValid;
    }

    /**
     * @notice Verify a document without emitting an event (view function).
     * @param batchId The batch to verify against
     * @param documentHash The SHA-256 hash of the document
     * @param proof Merkle proof array
     * @return isValid True if valid
     */
    function verifyDocumentView(
        uint256 batchId,
        bytes32 documentHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        AnchorBatch storage batch = batches[batchId];
        require(batch.merkleRoot != bytes32(0), "MerkleAnchor: Batch not found");

        bytes32 computedHash = documentHash;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == batch.merkleRoot;
    }

    /**
     * @notice Get batch details.
     */
    function getBatch(uint256 batchId) external view returns (
        bytes32 merkleRoot,
        uint256 documentCount,
        uint256 timestamp,
        address anchoredBy
    ) {
        AnchorBatch storage b = batches[batchId];
        return (b.merkleRoot, b.documentCount, b.timestamp, b.anchoredBy);
    }
}
