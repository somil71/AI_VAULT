// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IdentityNFT
 * @dev Non-transferable (Soulbound) NFT representing a user's digital identity.
 * Once minted, the token is permanently bound to the minting address.
 * This contract demonstrates on-chain identity without transferability.
 */
contract IdentityNFT {
    // ── State Variables ──────────────────────────────────────────────────────
    string public name = "LifeVault Identity";
    string public symbol = "LVID";
    uint256 private _tokenIdCounter;

    // Mapping: owner address → tokenId (one identity per address)
    mapping(address => uint256) public identityOf;
    // Mapping: tokenId → owner address
    mapping(uint256 => address) public ownerOf;
    // Mapping: tokenId → metadata URI (encrypted IPFS/local hash)
    mapping(uint256 => string) public tokenURI;
    // Mapping: tokenId → creation timestamp
    mapping(uint256 => uint256) public mintedAt;
    // Mapping: address → has identity
    mapping(address => bool) public hasIdentity;

    // ── Events ───────────────────────────────────────────────────────────────
    event IdentityMinted(address indexed owner, uint256 tokenId, uint256 timestamp);
    event MetadataUpdated(uint256 indexed tokenId, string newURI, uint256 timestamp);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier noExistingIdentity() {
        require(!hasIdentity[msg.sender], "IdentityNFT: You already have an identity token");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf[tokenId] == msg.sender, "IdentityNFT: Not token owner");
        _;
    }

    // ── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Mint a soulbound identity NFT for the caller.
     * @param metadataURI The encrypted metadata URI (IPFS hash or local reference).
     * @return tokenId The newly minted token ID.
     */
    function mintIdentity(string calldata metadataURI) external noExistingIdentity returns (uint256) {
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        ownerOf[newTokenId] = msg.sender;
        identityOf[msg.sender] = newTokenId;
        tokenURI[newTokenId] = metadataURI;
        mintedAt[newTokenId] = block.timestamp;
        hasIdentity[msg.sender] = true;

        emit IdentityMinted(msg.sender, newTokenId, block.timestamp);
        return newTokenId;
    }

    /**
     * @notice Update the metadata URI of an existing identity token.
     * @param tokenId The token to update.
     * @param newURI The new encrypted metadata URI.
     */
    function updateMetadata(uint256 tokenId, string calldata newURI) external onlyTokenOwner(tokenId) {
        tokenURI[tokenId] = newURI;
        emit MetadataUpdated(tokenId, newURI, block.timestamp);
    }

    /**
     * @notice Get identity info for a given address.
     */
    function getIdentityInfo(address user) external view returns (
        uint256 tokenId,
        string memory uri,
        uint256 createdAt,
        bool exists
    ) {
        exists = hasIdentity[user];
        if (exists) {
            tokenId = identityOf[user];
            uri = tokenURI[tokenId];
            createdAt = mintedAt[tokenId];
        }
    }

    /**
     * @dev Block all transfer functions to enforce soulbound property.
     */
    function transferFrom(address, address, uint256) external pure {
        revert("IdentityNFT: Soulbound tokens cannot be transferred");
    }

    function approve(address, uint256) external pure {
        revert("IdentityNFT: Soulbound tokens cannot be approved for transfer");
    }

    // ── View Helpers ─────────────────────────────────────────────────────────
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
