// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LSP7DigitalAsset} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7DigitalAsset.sol";

contract LSP7DemoToken is LSP7DigitalAsset {
    // lsp4TokenType=0 (Token), isNonDivisible=false (18 decimals)
    constructor(address initialOwner)
        LSP7DigitalAsset("AgentVault Demo", "AVT", initialOwner, 0, false)
    {}

    // Public mint — no access control, testnet demo only
    function mint(address to, uint256 amount) external {
        _mint(to, amount, true, ""); // allowNonLSP1Recipient=true
    }
}
