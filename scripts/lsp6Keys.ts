/**
 * Centralized LSP2 / LSP6 key-derivation helpers for TypeScript.
 *
 * Mirrors exactly the constants used in:
 *   - LSP6Constants.sol  (_LSP6KEY_ADDRESSPERMISSIONS_*)
 *   - LSP6Utils.sol      (generateNewPermissionsKeys)
 *   - AgentVaultRegistry.sol (LSP6_PERMISSIONS_PREFIX, AP_ARRAY_KEY*)
 *
 * Single source of truth for scripts and tests — never duplicate these
 * derivations inline; import from here instead.
 *
 * Spec: https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-6-KeyManager.md
 */

// ─── Canonical key constants (matches LSP6Constants.sol exactly) ──────────────

/**
 * Full keccak256("AddressPermissions[]").
 * This is where the array LENGTH is stored (as abi.encodePacked(uint128)).
 *
 *   ⚠️  Do NOT use the zero-padded prefix "0xdf30...986 + 0x0000...0000" here —
 *       that key is AddressPermissions[0] (the FIRST ELEMENT), not the length.
 */
export const AP_ARRAY_KEY =
  "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3";

/** First 16 bytes of AP_ARRAY_KEY, used to derive per-element keys (without 0x). */
const AP_ARRAY_PREFIX = "df30dba06db6a30e65354d9a64c60986";

/** bytes10 MappingWithGrouping prefix for AddressPermissions:Permissions:<addr> (without 0x). */
const AP_PERMISSIONS_PREFIX = "4b80742de2bf82acb363";

// ─── Known LSP6 permission bitmaps ────────────────────────────────────────────

/** All permissions set (used for vault owner / super-controller). */
export const SUPER_PERM =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/** SUPER_CALL (0x400) | SUPER_TRANSFERVALUE (0x100) — used for agent controllers. */
export const AGENT_PERM =
  "0x0000000000000000000000000000000000000000000000000000000000000500";

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Returns the bytes32 element key for AddressPermissions[index].
 *
 * Format: AP_ARRAY_PREFIX (16 bytes) + uint128(index) as 16 big-endian bytes
 *
 * @example
 *   apArrayElementKey(0)
 *   → "0xdf30dba06db6a30e65354d9a64c6098600000000000000000000000000000000"
 *   apArrayElementKey(1)
 *   → "0xdf30dba06db6a30e65354d9a64c6098600000000000000000000000000000001"
 */
export function apArrayElementKey(index: number | bigint): string {
  const idx = BigInt(index).toString(16).padStart(32, "0"); // uint128 → 16 bytes → 32 hex chars
  return "0x" + AP_ARRAY_PREFIX + idx;
}

/**
 * Returns the bytes32 permissions key for AddressPermissions:Permissions:<controller>.
 *
 * Format: AP_PERMISSIONS_PREFIX (10 bytes) + 0x0000 (2 bytes) + controller (20 bytes)
 * Matches LSP2Utils.generateMappingWithGroupingKey(bytes10, bytes20).
 *
 * @example
 *   apPermissionsKey("0xAbCd...1234")
 *   → "0x4b80742de2bf82acb3630000abcd...1234"
 */
export function apPermissionsKey(controller: string): string {
  const addr = controller.toLowerCase().replace(/^0x/, "");
  if (addr.length !== 40) throw new Error(`apPermissionsKey: invalid address "${controller}"`);
  return "0x" + AP_PERMISSIONS_PREFIX + "0000" + addr;
}

// ─── Storage decoding ─────────────────────────────────────────────────────────

/**
 * Decodes the bytes returned by getData(AP_ARRAY_KEY) into a JS number.
 *
 * The LSP6 standard stores the array length as abi.encodePacked(uint128),
 * i.e. 16 big-endian bytes (confirmed in LSP6Utils.sol line 248):
 *   `values[0] = abi.encodePacked(newArrayLength)` where newArrayLength is uint128.
 *
 * @param rawBytes  Hex string returned directly by ERC725Y.getData()
 *                  (already decoded by ethers — NOT the full ABI-wrapped response).
 */
export function decodeArrayLength(rawBytes: string): number {
  if (!rawBytes || rawBytes === "0x") return 0;
  const hex = rawBytes.startsWith("0x") ? rawBytes.slice(2) : rawBytes;
  if (hex.length === 0) return 0;
  return Number(BigInt("0x" + hex));
}

/**
 * Decodes the bytes returned by getData(apPermissionsKey(addr)) into a bigint bitmap.
 * Stored as abi.encodePacked(bytes32) = 32 bytes.
 */
export function decodePermissions(rawBytes: string): bigint {
  if (!rawBytes || rawBytes === "0x") return 0n;
  const hex = rawBytes.startsWith("0x") ? rawBytes.slice(2) : rawBytes;
  if (hex.length === 0) return 0n;
  return BigInt("0x" + hex.padStart(64, "0"));
}

/**
 * Normalises the controller address stored at an array element key.
 * Stored as abi.encodePacked(bytes20(address)) = 20 bytes.
 *
 * @param rawBytes  e.g. "0xAbCd...1234" (20-byte hex, 40 chars after 0x)
 */
export function decodeControllerAddress(rawBytes: string): string {
  if (!rawBytes || rawBytes === "0x") return "0x" + "0".repeat(40);
  const hex = (rawBytes.startsWith("0x") ? rawBytes.slice(2) : rawBytes).toLowerCase();
  return "0x" + hex.padStart(40, "0");
}

// ─── AllowedCalls key derivation ──────────────────────────────────────────────

/**
 * bytes10 MappingWithGrouping prefix for AddressPermissions:AllowedCalls:<addr>.
 * = first 10 bytes of keccak256("AddressPermissions:AllowedCalls")
 * Source: _LSP6KEY_ADDRESSPERMISSIONS_ALLOWEDCALLS_PREFIX in LSP6Constants.sol
 *
 * ⚠️  SUPER_CALL (bit 0x400) bypasses AllowedCalls entirely.
 *     To enforce AllowedCalls, controllers must hold CALL (0x4) WITHOUT SUPER_CALL.
 *     Current AGENT_PERM (0x500 = SUPER_CALL | SUPER_TRANSFERVALUE) bypasses this list.
 */
export const AP_ALLOWED_CALLS_PREFIX = "4b80742de2bf393a64c7";

/** LSP6 AllowedCalls call-type bit flags (from LSP6Constants.sol). */
export const ALLOWED_CALL_TYPES = {
  TRANSFERVALUE: 0x00000001,
  CALL:          0x00000002,
  STATICCALL:    0x00000004,
  DELEGATECALL:  0x00000008,
} as const;

/** Wildcard — matches any LSP standard ID or any function selector. */
export const ANY_STANDARD_ID  = "ffffffff";
export const ANY_FUNCTION_SIG = "ffffffff";

/**
 * Returns the bytes32 key for AddressPermissions:AllowedCalls:<controller>.
 *
 * Format: AP_ALLOWED_CALLS_PREFIX (10 bytes) + 0x0000 (2 bytes) + controller (20 bytes)
 * Matches LSP2Utils.generateMappingWithGroupingKey(bytes10, bytes20).
 *
 * ⚠️  Has no effect when the controller holds SUPER_CALL (0x400).
 *
 * @example
 *   apAllowedCallsKey("0xAbCd...1234")
 *   → "0x4b80742de2bf393a64c70000abcd...1234"
 */
export function apAllowedCallsKey(controller: string): string {
  const addr = controller.toLowerCase().replace(/^0x/, "");
  if (addr.length !== 40) throw new Error(`apAllowedCallsKey: invalid address "${controller}"`);
  return "0x" + AP_ALLOWED_CALLS_PREFIX + "0000" + addr;
}

/**
 * Encodes a single AllowedCalls entry as a 34-byte CompactBytesArray element.
 *
 * Internal format (per LSP6ExecuteModule.sol, `ii += 34` loop):
 *   bytes2(0x0020) + bytes4(callType) + bytes20(addr) + bytes4(standardId) + bytes4(fnSelector)
 *   = 2 + 4 + 20 + 4 + 4 = 34 bytes
 *
 * @param callType   Bit flags from ALLOWED_CALL_TYPES (e.g. CALL | TRANSFERVALUE = 3)
 * @param addr       Allowed target address
 * @param standardId LSP interface ID, or ANY_STANDARD_ID ("ffffffff") for any
 * @param fnSelector 4-byte function selector, or ANY_FUNCTION_SIG ("ffffffff") for any
 * @returns          Hex string (without 0x) of the 34-byte encoded entry
 */
export function encodeAllowedCall(
  callType: number,
  addr: string,
  standardId: string = ANY_STANDARD_ID,
  fnSelector: string = ANY_FUNCTION_SIG,
): string {
  const ct = callType.toString(16).padStart(8, "0");                   // 4 bytes
  const a  = addr.toLowerCase().replace(/^0x/, "").padStart(40, "0"); // 20 bytes
  const si = standardId.replace(/^0x/, "").padStart(8, "0");           // 4 bytes
  const fs = fnSelector.replace(/^0x/, "").padStart(8, "0");           // 4 bytes
  return "0020" + ct + a + si + fs;                                    // 2 + 4 + 20 + 4 + 4 = 34 bytes
}

/**
 * Encodes one or more AllowedCalls entries into the full value for setData().
 *
 * @param entries  One or more entries produced by encodeAllowedCall()
 * @returns        "0x"-prefixed concatenation, ready for setData(apAllowedCallsKey(addr), value)
 */
export function encodeAllowedCallsValue(...entries: string[]): string {
  return "0x" + entries.join("");
}

// ─── Post-write verification ──────────────────────────────────────────────────

/** Minimal duck-typed interface: any ethers ERC725Y contract from getContractAt(). */
interface ERC725YLike {
  getData(key: string): Promise<string>;
}

/**
 * Reads back a key from an ERC725Y contract and asserts the value matches expectation.
 *
 * Call this immediately after every setData / setDataBatch to catch silent write failures
 * (e.g. key mismatch, bad encoding). Throws a descriptive error on mismatch.
 *
 * @param erc725    Any ERC725Y contract instance (from ethers.getContractAt)
 * @param key       The bytes32 data key as a hex string
 * @param expected  The exact bytes value that was written (hex string)
 * @param label     Human-readable label for error messages (e.g. "owner permissions")
 */
export async function verifyWrite(
  erc725: ERC725YLike,
  key: string,
  expected: string,
  label: string,
): Promise<void> {
  const observed = await erc725.getData(key);
  const norm = (s: string) => s.toLowerCase().replace(/^0x/, "");
  if (norm(observed) !== norm(expected)) {
    throw new Error(
      `WriteVerificationFailed [${label}]:\n` +
      `  key:      ${key}\n` +
      `  expected: ${expected}\n` +
      `  observed: ${observed}\n`,
    );
  }
}

// ─── Script error decoding ────────────────────────────────────────────────────

/**
 * Known 4-byte custom error selectors from LUKSO LSP6 and AVP contracts.
 * Extend this table as new revert reasons are identified.
 */
const KNOWN_SELECTORS: Record<string, string> = {
  "0x82507c0e": "NotAuthorised(address controller, string permission)",
  "0x3621bbcc": "NoPermissionsSet(address)",
  "0x59bbd7a8": "NotAllowedCall(address, address, bytes4)",
  "0xa84f2360": "NoCallsAllowed(address)",
  "0x6f855b54": "InvalidEncodedAllowedCalls(bytes)",
  "0x5c4e99d6": "InvalidWhitelistedCall(address)",
  "0x8e7cc7e8": "CallingKeyManagerNotAllowed()",
  "0x06d5b17d": "NoExtensionFoundForFunctionSelector(bytes4)",
  "0x4b6d3d25": "UnknownTemplate(bytes32 templateId)",
};

/**
 * Decodes a Hardhat/ethers execution error into a human-readable string.
 *
 * Handles custom errors (4-byte selector lookup), require() string reasons,
 * panic codes, and generic Error objects.
 *
 * @param err  Any thrown value caught from a tx or contract call
 */
export function decodeHardhatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  // ethers v6: revert reason string
  const reason = (err as any).reason;
  if (typeof reason === "string" && reason.length > 0) {
    return `Reverted: ${reason}`;
  }

  // ethers v6: custom error data
  const data: string | undefined = (err as any).data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    const selector = data.slice(0, 10).toLowerCase();
    const known = KNOWN_SELECTORS[selector];
    if (known) return `CustomError: ${known}`;
    return `CustomError: selector ${selector} (unknown — add to KNOWN_SELECTORS in lsp6Keys.ts)`;
  }

  // Hardhat string-embedded reason
  const msg = err.message ?? "";
  const revertMatch = msg.match(/reverted with reason string '([^']+)'/);
  if (revertMatch) return `Reverted: ${revertMatch[1]}`;

  const panicMatch = msg.match(/reverted with panic code (\w+)/);
  if (panicMatch) return `Panic: ${panicMatch[1]}`;

  return `Error: ${msg.slice(0, 300)}`;
}
