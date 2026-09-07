// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgenticID, a minimal ERC-7857-style agent identity for 0G Galileo.
/// @notice Each token is one agent: who owns it, the hash of its (encrypted) metadata, and which executors it authorises.
///         Written for the 0G Taipei Hackathon so 豆豆's stamps can point at an on-chain identity a verifier can query.
///         Transfer/clone follow the ERC-7857 shape (sealedKey + proof) but this demo does not run an oracle: the owner's
///         signature is the authority. Never treat this as production custody.
contract AgenticID {
    string public constant name = "Agentic ID (demo)";
    string public constant symbol = "AGENT";

    struct Agent {
        address owner;
        address executor;      // the key that signs on behalf of the agent (豆豆's signing key)
        string encryptedURI;   // where the (encrypted) metadata lives; data: URI in the demo
        bytes32 metadataHash;  // keccak256 of the metadata JSON
        uint64 createdAt;
    }

    uint256 public totalSupply;
    mapping(uint256 => Agent) private _agents;
    mapping(uint256 => mapping(address => bytes)) public permissions;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(uint256 indexed tokenId, address indexed owner, address indexed executor, bytes32 metadataHash, string encryptedURI);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor, bytes permissions);
    event MetadataUpdated(uint256 indexed tokenId, bytes32 metadataHash, string encryptedURI);

    error NotOwner();
    error NoSuchToken();

    modifier onlyOwnerOf(uint256 tokenId) {
        if (_agents[tokenId].owner == address(0)) revert NoSuchToken();
        if (_agents[tokenId].owner != msg.sender) revert NotOwner();
        _;
    }

    /// @notice Mint a new agent identity. `executor` is the address whose signatures speak for this agent.
    function mint(address to, address executor, string calldata encryptedURI, bytes32 metadataHash) external returns (uint256 tokenId) {
        tokenId = ++totalSupply;
        _agents[tokenId] = Agent({ owner: to, executor: executor, encryptedURI: encryptedURI, metadataHash: metadataHash, createdAt: uint64(block.timestamp) });
        emit Transfer(address(0), to, tokenId);
        emit Minted(tokenId, to, executor, metadataHash, encryptedURI);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _agents[tokenId].owner;
        if (o == address(0)) revert NoSuchToken();
        return o;
    }

    function executorOf(uint256 tokenId) external view returns (address) {
        if (_agents[tokenId].owner == address(0)) revert NoSuchToken();
        return _agents[tokenId].executor;
    }

    function agentOf(uint256 tokenId) external view returns (Agent memory) {
        if (_agents[tokenId].owner == address(0)) revert NoSuchToken();
        return _agents[tokenId];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_agents[tokenId].owner == address(0)) revert NoSuchToken();
        return _agents[tokenId].encryptedURI;
    }

    /// @notice ERC-7857 authorizeUsage: let `executor` act for the agent under `perms`.
    function authorizeUsage(uint256 tokenId, address executor, bytes calldata perms) external onlyOwnerOf(tokenId) {
        _agents[tokenId].executor = executor;
        permissions[tokenId][executor] = perms;
        emit UsageAuthorized(tokenId, executor, perms);
    }

    function updateMetadata(uint256 tokenId, string calldata encryptedURI, bytes32 metadataHash) external onlyOwnerOf(tokenId) {
        _agents[tokenId].encryptedURI = encryptedURI;
        _agents[tokenId].metadataHash = metadataHash;
        emit MetadataUpdated(tokenId, metadataHash, encryptedURI);
    }

    /// @notice ERC-7857 transfer shape. `sealedKey`/`proof` are carried for interface parity; no oracle in the demo.
    function transfer(address from, address to, uint256 tokenId, bytes calldata, bytes calldata) external onlyOwnerOf(tokenId) {
        require(from == msg.sender, "from");
        _agents[tokenId].owner = to;
        emit Transfer(from, to, tokenId);
    }

    /// @notice ERC-7857 clone shape: a new token with the same metadata commitment, owned by `to`.
    function clone(address to, uint256 tokenId, bytes calldata, bytes calldata) external onlyOwnerOf(tokenId) returns (uint256 newTokenId) {
        Agent memory a = _agents[tokenId];
        newTokenId = ++totalSupply;
        _agents[newTokenId] = Agent({ owner: to, executor: a.executor, encryptedURI: a.encryptedURI, metadataHash: a.metadataHash, createdAt: uint64(block.timestamp) });
        emit Transfer(address(0), to, newTokenId);
        emit Minted(newTokenId, to, a.executor, a.metadataHash, a.encryptedURI);
    }
}
