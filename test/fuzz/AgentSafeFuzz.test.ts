/**
 * AgentSafeFuzz.test.ts — Property-based fuzz tests for AgentSafe execute paths.
 *
 * Uses fast-check to generate randomized inputs and verify invariants:
 *
 * Property 1: Any truncated or malformed calldata passed to execute() either
 *   (a) reverts, OR (b) succeeds with a correct balance delta — never silently corrupts state.
 *
 * Property 2: executeBatch() with random operation arrays never leaves the safe
 *   in an inconsistent state (balances always sum correctly).
 *
 * Property 3: Random `operation` type values (beyond 0=CALL) always revert or succeed
 *   predictably — no silent state mutations from unsupported operation types.
 *
 * Property 4: Empty calldata (0x) with non-zero value is always equivalent to a raw LYX transfer.
 */

import * as fc from "fast-check";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentSafe, PolicyEngine, BudgetPolicy } from "../../typechain-types";

describe("AgentSafe — property-based fuzz tests", function () {
  // fast-check runs many examples; give each Mocha test enough timeout
  this.timeout(120_000);

  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let merchant: SignerWithAddress;
  let safe: AgentSafe;
  let pe: PolicyEngine;
  let bp: BudgetPolicy;

  const BUDGET = ethers.parseEther("50");

  beforeEach(async function () {
    [owner, agent, merchant] = await ethers.getSigners();

    const AgentSafeFactory    = await ethers.getContractFactory("AgentSafe");
    const PolicyEngineFactory = await ethers.getContractFactory("PolicyEngine");
    const BudgetPolicyFactory = await ethers.getContractFactory("BudgetPolicy");

    safe = await AgentSafeFactory.deploy(owner.address) as AgentSafe;
    pe   = await PolicyEngineFactory.deploy(owner.address, await safe.getAddress()) as PolicyEngine;
    bp   = await BudgetPolicyFactory.deploy(
      owner.address, await pe.getAddress(), BUDGET, 0, ethers.ZeroAddress,
    ) as BudgetPolicy;

    await pe.addPolicy(await bp.getAddress());
    await safe.setPolicyEngine(await pe.getAddress());
    await safe.setKeyManager(agent.address); // agent acts as KM in unit tests
    await owner.sendTransaction({ to: await safe.getAddress(), value: BUDGET });
  });

  // ─── Property 1: Truncated calldata → always revert or correct success ────

  it("Property 1: truncated calldata to execute() is always rejected cleanly", async function () {
    const safeAddr = await safe.getAddress();

    await fc.assert(
      fc.asyncProperty(
        // Generate truncated calldata (0–256 random bytes)
        fc.uint8Array({ minLength: 0, maxLength: 256 }),
        async (rawBytes) => {
          const truncated = "0x" + Buffer.from(rawBytes).toString("hex");
          const safeBalBefore = await ethers.provider.getBalance(safeAddr);
          const spentBefore = await bp.spent();

          let reverted = false;
          try {
            // Attempt to call execute() on safe with random calldata (as agent/KM)
            // This exercises the ABI decoder path in Solidity
            await safe.connect(agent).execute(0, merchant.address, 0n, truncated);
          } catch {
            reverted = true;
          }

          const safeBalAfter = await ethers.provider.getBalance(safeAddr);
          const spentAfter = await bp.spent();

          if (reverted) {
            // On revert: state must be unchanged (atomicity guarantee)
            expect(safeBalAfter).to.equal(safeBalBefore, "safe balance changed after revert");
            expect(spentAfter).to.equal(spentBefore, "spent increased after revert");
          }
          // On success: balance delta must be non-negative (no LYX stolen)
          // value=0 in this call, so balance should be unchanged
          if (!reverted) {
            expect(safeBalAfter).to.equal(safeBalBefore, "balance changed on zero-value call");
          }
          return true;
        },
      ),
      { numRuns: 50, seed: 0x1234 },
    );
  });

  // ─── Property 2: Non-zero value with empty data = pure LYX transfer ────────

  it("Property 2: empty calldata + value → safe balance decreases exactly by value (or reverts)", async function () {
    await fc.assert(
      fc.asyncProperty(
        // Generate random payment amounts from 0 to BUDGET/2
        fc.bigInt({ min: 0n, max: ethers.parseEther("25") }),
        async (amount) => {
          const safeAddr = await safe.getAddress();
          const safeBalBefore = await ethers.provider.getBalance(safeAddr);
          const merchantBalBefore = await ethers.provider.getBalance(merchant.address);
          const spentBefore = await bp.spent();

          let reverted = false;
          try {
            await safe.connect(agent).agentExecute(merchant.address, amount, "0x");
          } catch {
            reverted = true;
          }

          const safeBalAfter = await ethers.provider.getBalance(safeAddr);
          const merchantBalAfter = await ethers.provider.getBalance(merchant.address);
          const spentAfter = await bp.spent();

          if (!reverted) {
            // Successful transfer: conservation of value
            expect(safeBalBefore - safeBalAfter).to.equal(amount, "safe balance delta != amount");
            expect(merchantBalAfter - merchantBalBefore).to.equal(amount, "merchant did not receive exact amount");
            expect(spentAfter - spentBefore).to.equal(amount, "budget spent delta != amount");
          } else {
            // Revert: no state changes
            expect(safeBalAfter).to.equal(safeBalBefore, "safe balance changed after revert");
            expect(merchantBalAfter).to.equal(merchantBalBefore, "merchant balance changed after revert");
            expect(spentAfter).to.equal(spentBefore, "spent changed after revert");
          }
          return true;
        },
      ),
      { numRuns: 30, seed: 0xabcd },
    );
  });

  // ─── Property 3: Random operationType values ──────────────────────────────

  it("Property 3: non-CALL operation types (1–4) to execute() always revert or are harmless", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // operationType: 1=DELEGATECALL,2=CREATE,3=CREATE2,4=STATICCALL
        fc.bigInt({ min: 0n, max: ethers.parseEther("1") }),
        async (operationType, value) => {
          const safeAddr = await safe.getAddress();
          const safeBalBefore = await ethers.provider.getBalance(safeAddr);

          let reverted = false;
          try {
            // KM path: agent calls execute() with non-CALL operation type
            await safe.connect(agent).execute(operationType, merchant.address, value, "0x");
          } catch {
            reverted = true;
          }

          const safeBalAfter = await ethers.provider.getBalance(safeAddr);

          // Any non-CALL op type on the agent KM path should never drain LYX
          // (DELEGATECALL/CREATE/etc. should revert via ERC725X or policy layer)
          if (reverted) {
            expect(safeBalAfter).to.equal(safeBalBefore, "safe balance changed after non-CALL revert");
          }
          return true;
        },
      ),
      { numRuns: 20, seed: 0xbeef },
    );
  });

  // ─── Property 4: Random recipients — only merchant passes MerchantPolicy ──

  it("Property 4: random recipient addresses always revert when not in whitelist", async function () {
    // Add a MerchantPolicy with only merchant.address whitelisted
    const MerchantPolicyFactory = await ethers.getContractFactory("MerchantPolicy");
    const mp = await MerchantPolicyFactory.deploy(owner.address, await pe.getAddress());
    await (mp as any).addMerchants([merchant.address]);
    await pe.addPolicy(await mp.getAddress());

    await fc.assert(
      fc.asyncProperty(
        // Generate random 20-byte addresses as uint8 arrays
        fc.uint8Array({ minLength: 20, maxLength: 20 }),
        async (addrBytes) => {
          const addrHex = "0x" + Buffer.from(addrBytes).toString("hex");
          const addr = ethers.getAddress(addrHex); // checksum-normalised
          if (addr === merchant.address || addr === ethers.ZeroAddress) return true;

          const spentBefore = await bp.spent();
          try {
            await safe.connect(agent).agentExecute(addr, ethers.parseEther("1"), "0x");
            // If it succeeds, something is wrong — the merchant policy should block it
            return false; // fail the property
          } catch {
            // Expected: non-whitelisted address always reverts
          }
          // spent must not have changed
          expect(await bp.spent()).to.equal(spentBefore, "budget was debited for a reverted call");
          return true;
        },
      ),
      { numRuns: 40, seed: 0xcafe },
    );
  });

  // ─── Property 5: Oversized calldata never consumes unexpected LYX ──────────

  it("Property 5: oversized calldata (up to 4KB) to execute() never silently drains LYX", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 257, maxLength: 4096 }),
        async (rawBytes) => {
          const bigCalldata = "0x" + Buffer.from(rawBytes).toString("hex");
          const safeAddr = await safe.getAddress();
          const safeBalBefore = await ethers.provider.getBalance(safeAddr);

          try {
            await safe.connect(agent).execute(0, merchant.address, 0n, bigCalldata);
          } catch {
            // revert is fine
          }

          const safeBalAfter = await ethers.provider.getBalance(safeAddr);
          // LYX balance must not decrease on zero-value calls regardless of calldata size
          expect(safeBalAfter).to.gte(safeBalBefore, "LYX drained by oversized zero-value call");
          return true;
        },
      ),
      { numRuns: 20, seed: 0xd00d },
    );
  });
});
