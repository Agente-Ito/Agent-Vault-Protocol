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
  decodeArrayLength,
  decodePermissions,
  decodeControllerAddress,
  SUPER_PERM,
  AGENT_PERM,
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
});
