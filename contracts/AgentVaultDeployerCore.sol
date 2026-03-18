// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AgentSafe} from "./AgentSafe.sol";
import {PolicyEngine} from "./PolicyEngine.sol";

/// @title AgentVaultDeployerCore
/// @notice Deploys AgentSafe and PolicyEngine. Isolated so that AgentVaultRegistry
///         embeds no creation bytecode and stays under EIP-170's 24,576-byte limit.
///         BudgetPolicy is deployed by AgentVaultDeployer.
///         LSP6KeyManager is deployed by AgentKMDeployer.
/// @dev All functions are unrestricted — the registry (msg.sender) is responsible
///      for passing correct parameters.
contract AgentVaultDeployerCore {

    function newSafe(address factory) external returns (address) {
        return address(new AgentSafe(factory));
    }

    function newPolicyEngine(address factory, address safe) external returns (address) {
        return address(new PolicyEngine(factory, safe));
    }
}
