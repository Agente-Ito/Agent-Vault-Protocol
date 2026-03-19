/**
 * lsp6Keys.unit.test.ts — Fixed-vector unit tests for LSP2/LSP6 key derivation.
 *
 * Each test uses a known input → expected output pair derived from the LSP6 spec
 * and LSP6Constants.sol in @lukso/lsp6-contracts.
 *
 * If any test fails, the key derivation library is wrong — do NOT "fix" tests
 * to match new output; fix the library to match the spec.
 */

import { expect } from "chai";
import {
  AP_ARRAY_KEY,
  AP_ALLOWED_CALLS_PREFIX,
  apArrayElementKey,
  apPermissionsKey,
  apAllowedCallsKey,
  encodeAllowedCall,
  encodeAllowedCallsValue,
  encodeAllowedCalls,
  decodeArrayLength,
  decodePermissions,
  decodeControllerAddress,
  SUPER_PERM,
  AGENT_PERM,
  PERM_STRICT_PAYMENTS,
  PERM_SUBSCRIPTIONS,
  PERM_TREASURY_BALANCED,
  PERM_OPS_ADMIN,
  PERM_POWER_USER,
  SUPER_MASK,
  AgentMode,
  hasSuperBits,
  hasCall,
  ALLOWED_CALL_TYPES,
  ANY_STANDARD_ID,
  ANY_FUNCTION_SIG,
} from "../scripts/lsp6Keys";

// All lowercase, no "0x" prefix for easy visual comparison
const strip = (s: string) => s.toLowerCase().replace(/^0x/, "");

// Known addresses for fixed-vector tests (exactly 20 bytes = 40 hex chars after 0x)
const ADDR_A = "0xaabbccddeeff00112233445566778899aabbccdd"; // 20 bytes, 40 hex chars
const ADDR_B = "0x1234567890123456789012345678901234567890";

describe("lsp6Keys — fixed-vector key derivation unit tests", function () {

  // ─── Constants ─────────────────────────────────────────────────────────────

  it("AP_ARRAY_KEY matches LSP6 spec (keccak256('AddressPermissions[]'))", function () {
    expect(AP_ARRAY_KEY.toLowerCase()).to.equal(
      "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3"
    );
  });

  it("AP_ALLOWED_CALLS_PREFIX matches LSP6Constants.sol", function () {
    // Verified against _LSP6KEY_ADDRESSPERMISSIONS_ALLOWEDCALLS_PREFIX = 0x4b80742de2bf393a64c7
    expect(AP_ALLOWED_CALLS_PREFIX).to.equal("4b80742de2bf393a64c7");
  });

  it("SUPER_PERM = 0xff...ff (32 bytes all set)", function () {
    expect(SUPER_PERM.toLowerCase()).to.equal(
      "0x" + "ff".repeat(32)
    );
  });

  it("AGENT_PERM = 0x...0500 (SUPER_CALL | SUPER_TRANSFERVALUE)", function () {
    expect(AGENT_PERM.toLowerCase()).to.equal(
      "0x" + "00".repeat(30) + "0500"
    );
  });

  // ─── apArrayElementKey ─────────────────────────────────────────────────────

  it("apArrayElementKey(0) = ArrayPrefix + 32 zero hex chars", function () {
    const result = apArrayElementKey(0);
    expect(result.toLowerCase()).to.equal(
      "0xdf30dba06db6a30e65354d9a64c6098600000000000000000000000000000000"
    );
  });

  it("apArrayElementKey(1) = ArrayPrefix + ...0001", function () {
    const result = apArrayElementKey(1);
    expect(result.toLowerCase()).to.equal(
      "0xdf30dba06db6a30e65354d9a64c6098600000000000000000000000000000001"
    );
  });

  it("apArrayElementKey(255) = ArrayPrefix + ...00ff", function () {
    const result = apArrayElementKey(255);
    expect(strip(result)).to.equal(
      "df30dba06db6a30e65354d9a64c60986" + "000000000000000000000000000000ff"
    );
  });

  it("apArrayElementKey(BigInt) works the same as Number", function () {
    expect(apArrayElementKey(5n)).to.equal(apArrayElementKey(5));
  });

  // ─── apPermissionsKey ──────────────────────────────────────────────────────

  it("apPermissionsKey(ADDR_A) = Permissions prefix + 0000 + addr", function () {
    // prefix = "4b80742de2bf82acb363" (10 bytes), then 0000 (2 bytes), then address (20 bytes)
    const result = apPermissionsKey(ADDR_A);
    expect(strip(result)).to.equal(
      "4b80742de2bf82acb3630000" + ADDR_A.slice(2).toLowerCase()
    );
  });

  it("apPermissionsKey is case-insensitive on input address hex chars", function () {
    // The function accepts lowercase hex address bytes (case of 0x prefix must be lowercase)
    const lower = apPermissionsKey(ADDR_A.toLowerCase());
    // Mixed-case hex bytes (same address as ADDR_B but with alternating case)
    const mixed = apPermissionsKey("0x" + ADDR_A.slice(2).toUpperCase());
    expect(lower.toLowerCase()).to.equal(mixed.toLowerCase());
  });

  it("apPermissionsKey throws on invalid address length", function () {
    expect(() => apPermissionsKey("0xdeadbeef")).to.throw(/invalid address/);
  });

  it("apPermissionsKey(ADDR_B) matches expected fixed vector", function () {
    const result = apPermissionsKey(ADDR_B);
    expect(strip(result)).to.equal(
      "4b80742de2bf82acb3630000" + "1234567890123456789012345678901234567890"
    );
  });

  // ─── apAllowedCallsKey ─────────────────────────────────────────────────────

  it("apAllowedCallsKey(ADDR_A) = AllowedCalls prefix + 0000 + addr", function () {
    const result = apAllowedCallsKey(ADDR_A);
    // prefix = "4b80742de2bf393a64c7" (10 bytes), then 0000 (2 bytes), then address (20 bytes)
    expect(strip(result)).to.equal(
      "4b80742de2bf393a64c70000" + ADDR_A.slice(2).toLowerCase()
    );
  });

  it("apAllowedCallsKey prefix differs from apPermissionsKey prefix", function () {
    const perm = apPermissionsKey(ADDR_A);
    const allowed = apAllowedCallsKey(ADDR_A);
    // First 20 chars after "0x" are the prefix (10 bytes = 20 hex)
    expect(perm.slice(2, 22)).to.not.equal(allowed.slice(2, 22));
  });

  it("apAllowedCallsKey throws on invalid address", function () {
    expect(() => apAllowedCallsKey("0xshort")).to.throw(/invalid address/);
  });

  it("apAllowedCallsKey(ADDR_B) matches expected fixed vector", function () {
    const result = apAllowedCallsKey(ADDR_B);
    expect(strip(result)).to.equal(
      "4b80742de2bf393a64c70000" + "1234567890123456789012345678901234567890"
    );
  });

  // ─── encodeAllowedCall ─────────────────────────────────────────────────────

  it("encodeAllowedCall produces 68 hex chars (34 bytes) per entry", function () {
    const entry = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_A);
    expect(entry.length).to.equal(68, "Each CompactBytesArray entry is 34 bytes = 68 hex chars");
  });

  it("encodeAllowedCall starts with 0020 (length prefix = 32 bytes of data)", function () {
    const entry = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_A);
    expect(entry.slice(0, 4)).to.equal("0020");
  });

  it("encodeAllowedCall embeds call type, address, standardId, fnSelector correctly", function () {
    const entry = encodeAllowedCall(
      ALLOWED_CALL_TYPES.CALL,   // 0x00000002
      ADDR_A,
      ANY_STANDARD_ID,           // "ffffffff"
      ANY_FUNCTION_SIG,          // "ffffffff"
    );
    // Structure: 0020 | 00000002 | addr body (40 hex chars = 20 bytes) | ffffffff | ffffffff
    expect(entry).to.equal(
      "0020" + "00000002" +
      ADDR_A.slice(2).toLowerCase() +
      "ffffffff" + "ffffffff"
    );
  });

  it("encodeAllowedCall TRANSFERVALUE | CALL = 0x00000003", function () {
    const ct = ALLOWED_CALL_TYPES.TRANSFERVALUE | ALLOWED_CALL_TYPES.CALL; // 3
    const entry = encodeAllowedCall(ct, ADDR_A);
    // bytes 4-11 after "0020" = call type = "00000003"
    expect(entry.slice(4, 12)).to.equal("00000003");
  });

  it("encodeAllowedCall with specific function selector", function () {
    const fnSel = "760d9bba"; // LSP7 transfer selector
    const entry = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_A, ANY_STANDARD_ID, fnSel);
    expect(entry.slice(-8)).to.equal("760d9bba");
  });

  // ─── encodeAllowedCallsValue ───────────────────────────────────────────────

  it("encodeAllowedCallsValue wraps single entry with 0x prefix", function () {
    const entry = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_A);
    const value = encodeAllowedCallsValue(entry);
    expect(value).to.equal("0x" + entry);
    expect(value.startsWith("0x")).to.be.true;
  });

  it("encodeAllowedCallsValue concatenates two entries = 136 hex chars after 0x", function () {
    const e1 = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_A);
    const e2 = encodeAllowedCall(ALLOWED_CALL_TYPES.CALL, ADDR_B);
    const value = encodeAllowedCallsValue(e1, e2);
    expect(value.length).to.equal(2 + 68 + 68); // "0x" + 2 entries × 34 bytes × 2 hex/byte
  });

  // ─── Decoding helpers ─────────────────────────────────────────────────────

  it("decodeArrayLength('0x') = 0", function () {
    expect(decodeArrayLength("0x")).to.equal(0);
  });

  it("decodeArrayLength(uint128(1) as 16 bytes) = 1", function () {
    const raw = "0x" + "00".repeat(15) + "01"; // uint128(1) in 16 bytes
    expect(decodeArrayLength(raw)).to.equal(1);
  });

  it("decodeArrayLength(uint128(5) as 16 bytes) = 5", function () {
    const raw = "0x" + "00".repeat(15) + "05";
    expect(decodeArrayLength(raw)).to.equal(5);
  });

  it("decodePermissions('0x') = 0n", function () {
    expect(decodePermissions("0x")).to.equal(0n);
  });

  it("decodePermissions(SUPER_PERM) = (2^256 - 1)", function () {
    const allBits = (1n << 256n) - 1n;
    expect(decodePermissions(SUPER_PERM)).to.equal(allBits);
  });

  it("decodePermissions(AGENT_PERM) = 0x500n", function () {
    expect(decodePermissions(AGENT_PERM)).to.equal(0x500n);
  });

  it("decodeControllerAddress('0x') = zero address", function () {
    expect(decodeControllerAddress("0x")).to.equal("0x" + "0".repeat(40));
  });

  it("decodeControllerAddress(20-byte packed address) returns normalised address", function () {
    const packed = "0x" + "abcd1234".repeat(5); // 20 bytes
    const result = decodeControllerAddress(packed);
    expect(result.toLowerCase()).to.equal("0x" + "abcd1234".repeat(5));
  });

  // ─── Round-trip: key → encode → decode ───────────────────────────────────

  it("apPermissionsKey address round-trip (encode then check trailing 40 chars)", function () {
    const key = apPermissionsKey(ADDR_B);
    // Last 40 hex chars of the key (after "0x") should be the stripped address
    const trailing = key.slice(-40).toLowerCase();
    expect(trailing).to.equal(ADDR_B.slice(2).toLowerCase());
  });

  it("apArrayElementKey index round-trip (last 32 chars = index as uint128)", function () {
    const key = apArrayElementKey(42);
    const trailing = key.slice(-32).toLowerCase();
    // uint128(42) big-endian in 16 bytes = 30 zero hex chars + "2a" = 32 chars total
    expect(trailing).to.equal("000000000000000000000000000000" + "2a");
  });

  // ─── Permission preset constants (tiered security profiles) ─────────────────────

  it("PERM_STRICT_PAYMENTS = 0x...0A00 (CALL | TRANSFERVALUE)", function () {
    expect(PERM_STRICT_PAYMENTS.toLowerCase()).to.equal(
      "0x" + "00".repeat(30) + "0a00"
    );
  });

  it("PERM_SUBSCRIPTIONS = 0x...400A00 (STRICT + EXECUTE_RELAY_CALL)", function () {
    expect(PERM_SUBSCRIPTIONS.toLowerCase()).to.equal(
      "0x" + "00".repeat(29) + "400a00"
    );
  });

  it("PERM_TREASURY_BALANCED = 0x...2A00 (CALL | TRANSFERVALUE | STATICCALL)", function () {
    expect(PERM_TREASURY_BALANCED.toLowerCase()).to.equal(
      "0x" + "00".repeat(30) + "2a00"
    );
  });

  it("PERM_OPS_ADMIN = 0x...40000 (SETDATA only)", function () {
    expect(PERM_OPS_ADMIN.toLowerCase()).to.equal(
      "0x" + "00".repeat(29) + "040000"
    );
  });

  it("PERM_POWER_USER = AGENT_PERM = 0x...0500 (SUPER_CALL | SUPER_TRANSFERVALUE)", function () {
    expect(PERM_POWER_USER.toLowerCase()).to.equal(AGENT_PERM.toLowerCase());
    expect(PERM_POWER_USER.toLowerCase()).to.equal(
      "0x" + "00".repeat(30) + "0500"
    );
  });

  it("SUPER_MASK = 0x25500 (all SUPER_* bits)", function () {
    expect(SUPER_MASK).to.equal(0x25500n);
  });

  // ─── AgentMode enum values ────────────────────────────────────────────────

  it("AgentMode.STRICT_PAYMENTS = 0", function () { expect(AgentMode.STRICT_PAYMENTS).to.equal(0); });
  it("AgentMode.SUBSCRIPTIONS = 1",   function () { expect(AgentMode.SUBSCRIPTIONS).to.equal(1); });
  it("AgentMode.TREASURY_BALANCED = 2", function () { expect(AgentMode.TREASURY_BALANCED).to.equal(2); });
  it("AgentMode.OPS_ADMIN = 3",        function () { expect(AgentMode.OPS_ADMIN).to.equal(3); });
  it("AgentMode.CUSTOM = 4",           function () { expect(AgentMode.CUSTOM).to.equal(4); });

  // ─── hasSuperBits ─────────────────────────────────────────────────────────

  it("hasSuperBits(0x500n) = true (SUPER_CALL | SUPER_TRANSFERVALUE)", function () {
    expect(hasSuperBits(0x500n)).to.be.true;
  });
  it("hasSuperBits(0x100n) = true (SUPER_TRANSFERVALUE only)", function () {
    expect(hasSuperBits(0x100n)).to.be.true;
  });
  it("hasSuperBits(0x400n) = true (SUPER_CALL only)", function () {
    expect(hasSuperBits(0x400n)).to.be.true;
  });
  it("hasSuperBits(0x20000n) = true (SUPER_SETDATA)", function () {
    expect(hasSuperBits(0x20000n)).to.be.true;
  });
  it("hasSuperBits(0xA00n) = false (STRICT_PAYMENTS mode)", function () {
    expect(hasSuperBits(0xA00n)).to.be.false;
  });
  it("hasSuperBits(0x2A00n) = false (TREASURY_BALANCED mode)", function () {
    expect(hasSuperBits(0x2A00n)).to.be.false;
  });
  it("hasSuperBits(0n) = false (no bits set)", function () {
    expect(hasSuperBits(0n)).to.be.false;
  });

  // ─── hasCall ───────────────────────────────────────────────────────────────

  it("hasCall(0x800n) = true (CALL bit set)", function () {
    expect(hasCall(0x800n)).to.be.true;
  });
  it("hasCall(0xA00n) = true (STRICT_PAYMENTS = CALL | TRANSFERVALUE)", function () {
    expect(hasCall(0xA00n)).to.be.true;
  });
  it("hasCall(0x200n) = false (TRANSFERVALUE only, no CALL)", function () {
    expect(hasCall(0x200n)).to.be.false;
  });
  it("hasCall(0x40000n) = false (SETDATA only)", function () {
    expect(hasCall(0x40000n)).to.be.false;
  });
  it("hasCall(0n) = false", function () {
    expect(hasCall(0n)).to.be.false;
  });

  // ─── encodeAllowedCalls convenience helper ──────────────────────────────────

  it("encodeAllowedCalls([]) = '0x'", function () {
    expect(encodeAllowedCalls([])).to.equal("0x");
  });

  it("encodeAllowedCalls([addr]) matches manual encodeAllowedCallsValue (default callType=3)", function () {
    const manual = encodeAllowedCallsValue(
      encodeAllowedCall(
        ALLOWED_CALL_TYPES.CALL | ALLOWED_CALL_TYPES.TRANSFERVALUE,
        ADDR_A,
        ANY_STANDARD_ID,
        ANY_FUNCTION_SIG,
      )
    );
    expect(encodeAllowedCalls([ADDR_A])).to.equal(manual);
  });

  it("encodeAllowedCalls([addr1, addr2]) produces 2-entry CompactBytesArray", function () {
    const result = encodeAllowedCalls([ADDR_A, ADDR_B]);
    // 2 entries × 34 bytes each = 68 bytes; "0x" prefix + 68 × 2 = 138 chars
    expect(result.length).to.equal(2 + 68 + 68);
  });

  it("encodeAllowedCalls with explicit callType=STATICCALL uses 0x4", function () {
    const result = encodeAllowedCalls([ADDR_A], ALLOWED_CALL_TYPES.STATICCALL);
    // entry bytes 4-11 (after the 0020 length prefix) = call type = "00000004"
    const entryPart = result.slice(2); // strip "0x"
    expect(entryPart.slice(4, 12)).to.equal("00000004");
  });
});
