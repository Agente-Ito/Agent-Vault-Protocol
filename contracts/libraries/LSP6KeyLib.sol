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
    ///         AllowedCalls enforcement requires CALL (bit 0x800) WITHOUT SUPER_CALL.
    bytes10 internal constant AP_ALLOWED_CALLS_PREFIX =
        bytes10(0x4b80742de2bf393a64c7);

    // ─── Agent permission mode enum ───────────────────────────────────────────

    /// @notice Predefined agent permission profiles. Passed as uint8 in DeployParams.
    /// @dev CUSTOM (4) uses the caller-supplied customAgentPermissions bitmask.
    enum AgentMode {
        STRICT_PAYMENTS,   // 0 — CALL (0x800) | TRANSFERVALUE (0x200) = 0xA00
        SUBSCRIPTIONS,     // 1 — 0xA00 | EXECUTE_RELAY_CALL (0x400000) = 0x400A00
        TREASURY_BALANCED, // 2 — CALL | TRANSFERVALUE | STATICCALL (0x2000) = 0x2A00
        OPS_ADMIN,         // 3 — SETDATA (0x40000) only
        CUSTOM             // 4 — caller-supplied bitmask (guarded by allowSuperPermissions)
    }

    // ─── Permission bitmaps ───────────────────────────────────────────────────

    /// @dev All permissions set — used for vault owner / super-controller.
    bytes32 internal constant SUPER_PERM = bytes32(type(uint256).max);

    /// @dev Legacy alias — kept for external callers; equals PERM_POWER_USER.
    ///      SUPER_CALL (0x400) | SUPER_TRANSFERVALUE (0x100) = 0x500.
    bytes32 internal constant AGENT_PERM = bytes32(uint256(0x500));

    // ─── Mode presets (LSP6 official bit values) ──────────────────────────────
    // CALL=0x800, TRANSFERVALUE=0x200, STATICCALL=0x2000, SETDATA=0x40000
    // EXECUTE_RELAY_CALL=0x400000

    /// @dev STRICT_PAYMENTS: CALL (0x800) | TRANSFERVALUE (0x200) = 0xA00
    ///      AllowedCalls enforced. Suitable for payments and allowances.
    bytes32 internal constant PERM_STRICT = bytes32(uint256(0x0A00));

    /// @dev SUBSCRIPTIONS: STRICT + EXECUTE_RELAY_CALL (0x400000) = 0x400A00
    ///      AllowedCalls enforced. Suitable for recurring/relayed payments.
    bytes32 internal constant PERM_SUBSCRIPTIONS = bytes32(uint256(0x400A00));

    /// @dev TREASURY_BALANCED: CALL | TRANSFERVALUE | STATICCALL (0x2000) = 0x2A00
    ///      AllowedCalls enforced. Suitable for DeFi integrations.
    bytes32 internal constant PERM_TREASURY = bytes32(uint256(0x2A00));

    /// @dev OPS_ADMIN: SETDATA (0x40000) only. No value transfer capability.
    bytes32 internal constant PERM_OPS = bytes32(uint256(0x40000));

    /// @dev POWER_USER: SUPER_CALL | SUPER_TRANSFERVALUE — bypasses AllowedCalls.
    ///      Only usable when allowSuperPermissions = true.
    bytes32 internal constant PERM_POWER_USER = bytes32(uint256(0x500));

    // ─── Super-bit mask ───────────────────────────────────────────────────────

    /// @dev Mask covering all SUPER_* permission bits:
    ///      SUPER_TRANSFERVALUE (0x100) | SUPER_CALL (0x400) |
    ///      SUPER_STATICCALL (0x1000) | SUPER_DELEGATECALL (0x4000) |
    ///      SUPER_SETDATA (0x20000) = 0x25500
    uint256 private constant SUPER_MASK = 0x25500;

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

    // ─── Permission validation helpers ───────────────────────────────────────

    /// @notice Returns true if `perms` contains any SUPER_* bit.
    /// @dev Checks the combined SUPER_MASK (0x25500):
    ///      SUPER_TRANSFERVALUE | SUPER_CALL | SUPER_STATICCALL | SUPER_DELEGATECALL | SUPER_SETDATA.
    function hasSuperBits(bytes32 perms) internal pure returns (bool) {
        return uint256(perms) & SUPER_MASK != 0;
    }

    /// @notice Returns true if `perms` contains the CALL bit (0x800).
    /// @dev CALL (0x800) is the enforcement-checked bit. SUPER_CALL (0x400) bypasses AllowedCalls.
    function hasCall(bytes32 perms) internal pure returns (bool) {
        return uint256(perms) & 0x800 != 0;
    }

    /// @notice Resolves an AgentMode to its corresponding permission bitmask preset.
    /// @dev For CUSTOM mode (4), returns bytes32(0) — caller must supply customAgentPermissions.
    function modeToPermissions(AgentMode mode) internal pure returns (bytes32) {
        if (mode == AgentMode.STRICT_PAYMENTS)   return PERM_STRICT;
        if (mode == AgentMode.SUBSCRIPTIONS)      return PERM_SUBSCRIPTIONS;
        if (mode == AgentMode.TREASURY_BALANCED)  return PERM_TREASURY;
        if (mode == AgentMode.OPS_ADMIN)          return PERM_OPS;
        return bytes32(0); // CUSTOM — caller fills in customAgentPermissions
    }
}
