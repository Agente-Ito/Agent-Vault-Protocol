// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LSP6KeyLib
 * @notice Pure Solidity helpers for deriving LSP2/LSP6 ERC725Y storage keys.
 *
 * Mirrors the TypeScript functions in scripts/lsp6Keys.ts exactly.
 * Import this library in contracts instead of duplicating key constants inline.
 *
 * Key types covered:
 *  - AddressPermissions[]                   (Array: length + element keys)
 *  - AddressPermissions:Permissions:<addr>  (MappingWithGrouping)
 *  - AddressPermissions:AllowedCalls:<addr> (MappingWithGrouping)
 *
 * Source constants: LSP6Constants.sol in the lukso/lsp6-contracts package.
 * Spec: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-6-KeyManager.md
 */
library LSP6KeyLib {

    // ─── Array key ────────────────────────────────────────────────────────────

    /// @dev Full keccak256("AddressPermissions[]") — stores the array length as uint128.
    bytes32 internal constant AP_ARRAY_KEY =
        0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3;

    /// @dev First 16 bytes of AP_ARRAY_KEY — prefix for per-element index keys.
    bytes16 internal constant AP_ARRAY_KEY_PREFIX =
        bytes16(0xdf30dba06db6a30e65354d9a64c60986);

    // ─── Permissions key ──────────────────────────────────────────────────────

    /// @dev bytes10 MappingWithGrouping prefix for AddressPermissions:Permissions:<addr>.
    ///      = first 10 bytes of keccak256("AddressPermissions:Permissions")
    ///      Matches _LSP6KEY_ADDRESSPERMISSIONS_PERMISSIONS_PREFIX in LSP6Constants.sol.
    bytes10 internal constant AP_PERMISSIONS_PREFIX =
        bytes10(0x4b80742de2bf82acb363);

    // ─── AllowedCalls key ─────────────────────────────────────────────────────

    /// @dev bytes10 MappingWithGrouping prefix for AddressPermissions:AllowedCalls:<addr>.
    ///      = first 10 bytes of keccak256("AddressPermissions:AllowedCalls")
    ///      Matches _LSP6KEY_ADDRESSPERMISSIONS_ALLOWEDCALLS_PREFIX in LSP6Constants.sol.
    ///
    ///      ⚠️  SUPER_CALL (bit 0x400) bypasses AllowedCalls entirely.
    ///         AllowedCalls enforcement requires CALL (bit 0x4) WITHOUT SUPER_CALL.
    ///         The current AGENT_PERM (0x500 = SUPER_CALL | SUPER_TRANSFERVALUE) bypasses this.
    bytes10 internal constant AP_ALLOWED_CALLS_PREFIX =
        bytes10(0x4b80742de2bf393a64c7);

    // ─── Permission bitmaps ───────────────────────────────────────────────────

    /// @dev All permissions set — used for vault owner / super-controller.
    bytes32 internal constant SUPER_PERM = bytes32(type(uint256).max);

    /// @dev SUPER_CALL (0x400) | SUPER_TRANSFERVALUE (0x100) = 0x500.
    ///      Both flags bypass their respective AllowedCalls / AllowedAddresses checks.
    bytes32 internal constant AGENT_PERM = bytes32(uint256(0x500));

    // ─── Key derivation ───────────────────────────────────────────────────────

    /**
     * @notice Returns the bytes32 element key for AddressPermissions[index].
     *
     * Format: AP_ARRAY_KEY_PREFIX (16 bytes) + uint128(index) as big-endian 16 bytes.
     * Matches abi.encodePacked(AP_ARRAY_KEY_PREFIX, bytes16(index)) in registry.
     *
     * @param index  Zero-based position in the AddressPermissions array
     */
    function apArrayElementKey(uint128 index) internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(AP_ARRAY_KEY_PREFIX, bytes16(index)));
    }

    /**
     * @notice Returns the bytes32 permissions key for AddressPermissions:Permissions:<controller>.
     *
     * Format: AP_PERMISSIONS_PREFIX (10 bytes) + bytes2(0) + controller (20 bytes).
     * Matches LSP2Utils.generateMappingWithGroupingKey(bytes10, bytes20).
     */
    function apPermissionsKey(address controller) internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(AP_PERMISSIONS_PREFIX, bytes2(0), bytes20(controller)));
    }

    /**
     * @notice Returns the bytes32 key for AddressPermissions:AllowedCalls:<controller>.
     *
     * Format: AP_ALLOWED_CALLS_PREFIX (10 bytes) + bytes2(0) + controller (20 bytes).
     *
     * ⚠️  Has no effect if the controller holds SUPER_CALL (0x400). See AP_ALLOWED_CALLS_PREFIX.
     */
    function apAllowedCallsKey(address controller) internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(AP_ALLOWED_CALLS_PREFIX, bytes2(0), bytes20(controller)));
    }
}
