// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VaultRegistry
 * @dev Stores encrypted document hashes on-chain.
 * Each user can manage their own vault of document records.
 * Documents are encrypted client-side; only the hash is stored here.
 */
contract VaultRegistry {
    // ── Structs ───────────────────────────────────────────────────────────────
    struct VaultDocument {
        bytes32 encryptedHash;   // Hash of the encrypted file content
        string  fileName;         // Original file name (for display)
        string  fileType;         // MIME type
        uint256 uploadedAt;       // Block timestamp of upload
        bool    isActive;         // Soft-delete flag
        string  encryptionKey;    // Encrypted AES key (encrypted with user's pubkey - simulated)
    }

    // ── State Variables ───────────────────────────────────────────────────────
    // owner → list of document IDs
    mapping(address => uint256[]) private _userDocIds;
    // documentId → document data
    mapping(uint256 => VaultDocument) private _documents;
    // global document counter
    uint256 private _docCounter;

    // ── Events ────────────────────────────────────────────────────────────────
    event DocumentStored(
        address indexed owner,
        uint256 indexed docId,
        bytes32 encryptedHash,
        string fileName,
        uint256 timestamp
    );
    event DocumentRevoked(address indexed owner, uint256 indexed docId, uint256 timestamp);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier validDocId(uint256 docId) {
        require(docId > 0 && docId <= _docCounter, "VaultRegistry: Invalid document ID");
        _;
    }

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @notice Store a new encrypted document hash in the vault.
     * @param encryptedHash keccak256 hash of the encrypted file bytes
     * @param fileName Human-readable file name
     * @param fileType MIME type string
     * @param encryptionKey Encrypted AES key (simulated)
     * @return docId The new document's ID
     */
    function storeDocument(
        bytes32 encryptedHash,
        string calldata fileName,
        string calldata fileType,
        string calldata encryptionKey
    ) external returns (uint256) {
        _docCounter++;
        uint256 docId = _docCounter;

        _documents[docId] = VaultDocument({
            encryptedHash:  encryptedHash,
            fileName:       fileName,
            fileType:       fileType,
            uploadedAt:     block.timestamp,
            isActive:       true,
            encryptionKey:  encryptionKey
        });

        _userDocIds[msg.sender].push(docId);

        emit DocumentStored(msg.sender, docId, encryptedHash, fileName, block.timestamp);
        return docId;
    }

    /**
     * @notice Soft-delete (revoke) a document from the vault.
     * Only the document owner can revoke.
     */
    function revokeDocument(uint256 docId) external validDocId(docId) {
        // Verify caller owns this document
        bool owns = false;
        uint256[] memory ids = _userDocIds[msg.sender];
        for (uint i = 0; i < ids.length; i++) {
            if (ids[i] == docId) { owns = true; break; }
        }
        require(owns, "VaultRegistry: Not document owner");

        _documents[docId].isActive = false;
        emit DocumentRevoked(msg.sender, docId, block.timestamp);
    }

    /**
     * @notice Get all document IDs for the caller.
     */
    function getMyDocumentIds() external view returns (uint256[] memory) {
        return _userDocIds[msg.sender];
    }

    /**
     * @notice Get document details by ID (only owner can view).
     */
    function getDocument(uint256 docId) external view validDocId(docId) returns (
        bytes32 encryptedHash,
        string memory fileName,
        string memory fileType,
        uint256 uploadedAt,
        bool isActive,
        string memory encryptionKey
    ) {
        // Verify caller owns this doc
        bool owns = false;
        uint256[] memory ids = _userDocIds[msg.sender];
        for (uint i = 0; i < ids.length; i++) {
            if (ids[i] == docId) { owns = true; break; }
        }
        require(owns, "VaultRegistry: Access denied");

        VaultDocument storage doc = _documents[docId];
        return (
            doc.encryptedHash,
            doc.fileName,
            doc.fileType,
            doc.uploadedAt,
            doc.isActive,
            doc.encryptionKey
        );
    }

    function totalDocuments() external view returns (uint256) {
        return _docCounter;
    }
}
