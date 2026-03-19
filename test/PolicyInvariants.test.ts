/**
 * PolicyInvariants.test.ts — Invariant tests for the policy enforcement layer.
 *
 * Three invariants tested:
 *
 * 1. "No bypass" — all outbound payments go through PolicyEngine.validate().
 *    No code path in AgentSafe allows value to leave without policy approval.
 *
 * 2. "Budget monotónico" — BudgetPolicy.spent() only increases during a period.
 *    It cannot decrease unless a valid period reset occurs (block.timestamp crosses period end).
 *
 * 3. "Whitelist estricta" — with MerchantPolicy, any non-whitelisted recipient
 *    always reverts. Conversely, listed recipients always succeed (modulo budget).
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentSafe, PolicyEngine, BudgetPolicy, MerchantPolicy } from "../typechain-types";

describe("Policy Invariants", function () {
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let merchant: SignerWithAddress;
  let stranger: SignerWithAddress;

  const BUDGET = ethers.parseEther("100");

  // ─── Factory helper ────────────────────────────────────────────────────────

  async function deployStack(withMerchantPolicy: boolean = false) {
    const [_owner, _agent, _merchant, _stranger] = await ethers.getSigners();
    owner    = _owner;
    agent    = _agent;
    merchant = _merchant;
    stranger = _stranger;

    const AgentSafeFactory    = await ethers.getContractFactory("AgentSafe");
    const PolicyEngineFactory = await ethers.getContractFactory("PolicyEngine");
    const BudgetPolicyFactory = await ethers.getContractFactory("BudgetPolicy");

    const safe = await AgentSafeFactory.deploy(owner.address) as AgentSafe;
    const pe   = await PolicyEngineFactory.deploy(owner.address, await safe.getAddress()) as PolicyEngine;
    const bp   = await BudgetPolicyFactory.deploy(
      owner.address, await pe.getAddress(), BUDGET, 0, ethers.ZeroAddress, // DAILY
    ) as BudgetPolicy;

    await pe.addPolicy(await bp.getAddress());

    let mp: MerchantPolicy | undefined;
    if (withMerchantPolicy) {
      const MerchantPolicyFactory = await ethers.getContractFactory("MerchantPolicy");
      mp = await MerchantPolicyFactory.deploy(owner.address, await pe.getAddress()) as MerchantPolicy;
      await (mp as any).addMerchants([merchant.address]);
      await pe.addPolicy(await mp.getAddress());
    }

    await safe.setPolicyEngine(await pe.getAddress());
    await safe.setKeyManager(agent.address); // agent acts as KeyManager in unit tests
    await owner.sendTransaction({ to: await safe.getAddress(), value: BUDGET });

    return { safe, pe, bp, mp };
  }

  // ─── Invariant 1: No bypass ────────────────────────────────────────────────

  describe("Invariant 1: No bypass — all value exits go through PolicyEngine", function () {
    // Initialize signers once for this describe block. Tests that don't call
    // deployStack() need owner/agent/merchant to be defined.
    before(async function () {
      [owner, agent, merchant, stranger] = await ethers.getSigners();
    });

    it("agentExecute with no PolicyEngine reverts", async function () {
      const AgentSafeFactory = await ethers.getContractFactory("AgentSafe");
      const noPeSafe = await AgentSafeFactory.deploy(owner.address) as AgentSafe;
      await noPeSafe.setKeyManager(agent.address);
      await owner.sendTransaction({ to: await noPeSafe.getAddress(), value: ethers.parseEther("10") });

      await expect(
        noPeSafe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x")
      ).to.be.reverted; // policyEngine = address(0) → low-level revert, no reason string
    });

    it("execute() via KM path with no PolicyEngine reverts", async function () {
      const AgentSafeFactory = await ethers.getContractFactory("AgentSafe");
      const noPeSafe = await AgentSafeFactory.deploy(owner.address) as AgentSafe;
      await noPeSafe.setKeyManager(agent.address);
      await owner.sendTransaction({ to: await noPeSafe.getAddress(), value: ethers.parseEther("10") });

      const calldata = noPeSafe.interface.encodeFunctionData("execute", [
        0, merchant.address, ethers.parseEther("1"), "0x",
      ]);
      // agent is also the KM in tests, so calling execute directly mimics the KM path
      await expect(
        noPeSafe.connect(agent).execute(0, merchant.address, ethers.parseEther("1"), "0x")
      ).to.be.revertedWith("AS: PE not set"); // execute() path has an explicit require check
    });

    it("direct agentExecute with budget-exceeding amount reverts (policy enforced)", async function () {
      const { safe } = await deployStack();
      const overBudget = BUDGET + ethers.parseEther("1");

      await expect(
        safe.connect(agent).agentExecute(merchant.address, overBudget, "0x")
      ).to.be.reverted; // BP: budget exceeded or AS: insufficient LYX balance
    });

    it("PolicyEngine.spent() > 0 after every successful payment (validate() was called)", async function () {
      const { safe, bp } = await deployStack();
      const spentBefore = await bp.spent();
      await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x");
      expect(await bp.spent()).to.be.greaterThan(spentBefore);
    });
  });

  // ─── Invariant 2: Budget monotónico ───────────────────────────────────────

  describe("Invariant 2: Budget monotónico — spent only increases during a period", function () {
    it("spent is strictly non-decreasing across 5 sequential payments", async function () {
      const { safe, bp } = await deployStack();
      let prevSpent = await bp.spent();

      for (let i = 0; i < 5; i++) {
        await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("5"), "0x");
        const currentSpent = await bp.spent();
        expect(currentSpent).to.be.greaterThan(prevSpent, `spent must increase after payment ${i + 1}`);
        prevSpent = currentSpent;
      }
    });

    it("spent equals total of all payments (no leakage)", async function () {
      const { safe, bp } = await deployStack();
      const payment = ethers.parseEther("7");
      const count = 5;

      for (let i = 0; i < count; i++) {
        await safe.connect(agent).agentExecute(merchant.address, payment, "0x");
      }
      expect(await bp.spent()).to.equal(payment * BigInt(count));
    });

    it("spent cannot be reset by an unauthorized caller", async function () {
      const { safe, bp } = await deployStack();
      await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x");
      // BudgetPolicy does not expose a public resetSpent — any attempt must fail
      // Verify via ABI: only owner-controlled period reset logic exists
      const bpAny = bp as any;
      if (typeof bpAny.resetSpent === "function") {
        await expect(bpAny.connect(stranger).resetSpent()).to.be.reverted;
      }
      // spent remains unchanged
      expect(await bp.spent()).to.equal(ethers.parseEther("1"));
    });

    it("spent resets to 0 after a valid DAILY period boundary (legitimate reset)", async function () {
      const { safe, bp } = await deployStack();
      await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("10"), "0x");
      expect(await bp.spent()).to.equal(ethers.parseEther("10"));

      // Fast-forward past the DAILY period (86400 seconds)
      await time.increase(86401);

      // Now another payment resets the period — spent should reflect only the new payment
      const newPayment = ethers.parseEther("5");
      await safe.connect(agent).agentExecute(merchant.address, newPayment, "0x");
      expect(await bp.spent()).to.equal(newPayment);
    });

    it("budget ceiling is enforced: cumulative payments cannot exceed budget", async function () {
      const { safe } = await deployStack();
      const maxParts = 10; // 10 × 10 ETH = 100 ETH = BUDGET
      const partPayment = ethers.parseEther("10");

      for (let i = 0; i < maxParts; i++) {
        await safe.connect(agent).agentExecute(merchant.address, partPayment, "0x");
      }
      // 11th payment must fail (budget exhausted)
      await expect(
        safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x")
      ).to.be.reverted;
    });
  });

  // ─── Invariant 3: Whitelist estricta ──────────────────────────────────────

  describe("Invariant 3: Whitelist estricta — deny-by-default for non-listed merchants", function () {
    it("non-whitelisted recipient always reverts", async function () {
      const { safe } = await deployStack(true); // withMerchantPolicy = true
      await expect(
        safe.connect(agent).agentExecute(stranger.address, ethers.parseEther("1"), "0x")
      ).to.be.revertedWith("MP: merchant not whitelisted");
    });

    it("whitelisted merchant always succeeds (within budget)", async function () {
      const { safe } = await deployStack(true);
      await expect(
        safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x")
      ).to.not.be.reverted;
    });

    it("adding a merchant allows payments to them thereafter", async function () {
      const { safe, mp } = await deployStack(true);
      // stranger initially denied
      await expect(
        safe.connect(agent).agentExecute(stranger.address, ethers.parseEther("1"), "0x")
      ).to.be.revertedWith("MP: merchant not whitelisted"); // was: "MP: merchant not allowed"
      await (mp as any).addMerchants([stranger.address]);

      // now succeeds
      await expect(
        safe.connect(agent).agentExecute(stranger.address, ethers.parseEther("1"), "0x")
      ).to.not.be.reverted;
    });

    it("removing a merchant blocks payments to them", async function () {
      const { safe, mp } = await deployStack(true);
      // merchant is listed → payment works
      await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x");

      // remove merchant
      const mpAny = mp as any;
      if (typeof mpAny.removeMerchant === "function") {
        await mpAny.removeMerchant(merchant.address);
        // now blocked
        await expect(
          safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("1"), "0x")
        ).to.be.revertedWith("MP: merchant not whitelisted");
      } else {
        // if removeMerchant doesn't exist, skip (document the gap)
        this.skip();
      }
    });

    it("zero-value call to unlisted address still reverts (whitelist applies to any call)", async function () {
      const { safe } = await deployStack(true);
      await expect(
        safe.connect(agent).agentExecute(stranger.address, 0n, "0x1234")
      ).to.be.revertedWith("MP: merchant not whitelisted");
    });
  });
});
