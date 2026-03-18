// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LSP6KeyManager} from "@lukso/lsp6-contracts/contracts/LSP6KeyManager.sol";

/// @title AgentKMDeployer
/// @notice Deploys LSP6KeyManager instances. Isolated so that AgentVaultRegistry
///         embeds no creation bytecode and stays under EIP-170's 24,576-byte limit.
///         LSP6KeyManager alone is ~16KB, so it must live in its own deployer.
/// @dev Unrestricted — the registry is responsible for passing correct parameters.
contract AgentKMDeployer {

    function newKeyManager(address safe) external returns (address) {
        return address(new LSP6KeyManager(safe));
    }
}
