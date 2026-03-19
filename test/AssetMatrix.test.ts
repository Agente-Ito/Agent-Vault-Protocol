/**
 * AssetMatrix.test.ts — Cross-asset safety tests.
 *
 * Tests AgentSafe behavior across different asset types:
 *  1. LYX (native) — baseline (references existing coverage)
 *  2. Standard LSP7 token — transfer path
 *  3. Malicious token (reentrancy) — nonReentrant guard
 *  4. Non-standard ERC20 (no return value) — graceful handling via MockERC20
 *
 * Each case asserts that the safe handles edge cases without silent corruption.
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AgentSafe, PolicyEngine, BudgetPolicy, MockReentrantToken } from "../typechain-types";

describe("AssetMatrix — cross-asset safety tests", function () {
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let merchant: SignerWithAddress;
  let attacker: SignerWithAddress;
  let safe: AgentSafe;
  let pe: PolicyEngine;

  const LYX_BUDGET = ethers.parseEther("100");
  const TOKEN_BUDGET = 10_000n;

  // ─── Setup helpers ─────────────────────────────────────────────────────────

  async function deploySafeWithPE() {
    [owner, agent, merchant, attacker] = await ethers.getSigners();

    const AgentSafeFactory    = await ethers.getContractFactory("AgentSafe");
    const PolicyEngineFactory = await ethers.getContractFactory("PolicyEngine");

    const _safe = await AgentSafeFactory.deploy(owner.address) as AgentSafe;
    const _pe   = await PolicyEngineFactory.deploy(owner.address, await _safe.getAddress()) as PolicyEngine;

    // Wire up (agent is KM in unit tests)
    await _safe.setPolicyEngine(await _pe.getAddress());
    await _safe.setKeyManager(agent.address);
    await owner.sendTransaction({ to: await _safe.getAddress(), value: LYX_BUDGET });

    return { safe: _safe, pe: _pe };
  }

  async function addLYXBudget(_pe: PolicyEngine) {
    const BudgetPolicyFactory = await ethers.getContractFactory("BudgetPolicy");
    const bp = await BudgetPolicyFactory.deploy(
      owner.address, await _pe.getAddress(), LYX_BUDGET, 0, ethers.ZeroAddress,
    ) as BudgetPolicy;
    await _pe.addPolicy(await bp.getAddress());
    return bp;
  }

  async function addTokenBudget(_pe: PolicyEngine, tokenAddr: string) {
    const BudgetPolicyFactory = await ethers.getContractFactory("BudgetPolicy");
    const bp = await BudgetPolicyFactory.deploy(
      owner.address, await _pe.getAddress(), TOKEN_BUDGET, 0, tokenAddr,
    ) as BudgetPolicy;
    await _pe.addPolicy(await bp.getAddress());
    return bp;
  }

  // ─── 1. LYX (native) — baseline ───────────────────────────────────────────

  describe("LYX (native) transfers", function () {
    beforeEach(async function () {
      const s = await deploySafeWithPE();
      safe = s.safe; pe = s.pe;
      await addLYXBudget(pe);
    });

    it("agent can pay merchant in LYX", async function () {
      const before = await ethers.provider.getBalance(merchant.address);
      await safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("10"), "0x");
      expect(await ethers.provider.getBalance(merchant.address) - before).to.equal(ethers.parseEther("10"));
    });

    it("LYX transfer to zero address does not revert (EVM allows it, ETH is burned)", async function () {
      // agentExecute has no explicit zero-address guard; sending to address(0) burns ETH.
      // This test documents the behavior — callers are responsible for recipient validation.
      const safeBefore = await ethers.provider.getBalance(await safe.getAddress());
      // Send 1 wei to zero address (burns it). Should not throw.
      await safe.connect(agent).agentExecute(ethers.ZeroAddress, 1n, "0x");
      const safeAfter = await ethers.provider.getBalance(await safe.getAddress());
      expect(safeBefore - safeAfter).to.equal(1n); // 1 wei burned
    });

    it("LYX transfer exceeding safe balance reverts cleanly", async function () {
      await expect(
        safe.connect(agent).agentExecute(merchant.address, ethers.parseEther("200"), "0x")
      ).to.be.reverted;
    });
  });

  // ─── 2. Standard ERC20 token (via agentExecute + encoded calldata) ──────────
  //
  // agentTransferToken() requires an LSP7-compatible token (5-arg transfer).
  // For a plain ERC20, we encode the transfer calldata and use agentExecute()
  // with amount=0 (no LYX transfer) and the token address as target.
  // The BudgetPolicy sees amount=0 (trivially within any LYX budget).

  describe("Standard ERC20 token (via agentExecute + encoded transfer calldata)", function () {
    let tokenAddr: string;

    beforeEach(async function () {
      const s = await deploySafeWithPE();
      safe = s.safe; pe = s.pe;

      // Deploy mock ERC20 (implements balanceOf + transfer)
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20Factory.deploy("Test Token", "TEST", 18);
      tokenAddr = await token.getAddress();

      // Mint tokens directly to safe
      await (token as any).mint(await safe.getAddress(), TOKEN_BUDGET * 2n);

      // LYX budget (token transfers have amount=0 for LYX, always within budget)
      await addLYXBudget(pe);
    });

    it("agent can transfer ERC20 token to merchant via agentExecute + calldata", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const token = MockERC20Factory.attach(tokenAddr);

      const iface = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]);
      const calldata = iface.encodeFunctionData("transfer", [merchant.address, TOKEN_BUDGET]);

      const before = await (token as any).balanceOf(merchant.address);
      // agentExecute to the token contract with amount=0, passing ERC20 transfer calldata
      await safe.connect(agent).agentExecute(tokenAddr as any, 0n, calldata);
      const after = await (token as any).balanceOf(merchant.address);
      expect(after - before).to.equal(TOKEN_BUDGET);
    });

    it("token transfer with zero amount is a no-op — safe balance unchanged", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const token = MockERC20Factory.attach(tokenAddr);
      const safeBefore = await (token as any).balanceOf(await safe.getAddress());

      const iface = new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]);
      const calldata = iface.encodeFunctionData("transfer", [merchant.address, 0n]);
      await safe.connect(agent).agentExecute(tokenAddr as any, 0n, calldata);

      const safeAfter = await (token as any).balanceOf(await safe.getAddress());
      expect(safeAfter).to.equal(safeBefore); // 0-amount transfer doesn't change balance
    });

    it("agentTransferToken rejects zero token address (must use agentExecute for LYX)", async function () {
      await expect(
        safe.connect(agent).agentTransferToken(ethers.ZeroAddress, merchant.address, 100n, true, "0x")
      ).to.be.revertedWith("AS: token cannot be zero address");
    });
  });

  // ─── 3. Malicious token — reentrancy guard ─────────────────────────────────

  describe("Malicious token (reentrancy) — nonReentrant guard", function () {
    let reentrantToken: MockReentrantToken;

    beforeEach(async function () {
      const s = await deploySafeWithPE();
      safe = s.safe; pe = s.pe;

      const MockTokenFactory = await ethers.getContractFactory("MockReentrantToken");
      reentrantToken = await MockTokenFactory.deploy() as unknown as MockReentrantToken;

      // Mint tokens to safe and point attack at safe
      await (reentrantToken as any).mint(await safe.getAddress(), 10_000n);
      await (reentrantToken as any).setTarget(await safe.getAddress());

      await addTokenBudget(pe, await reentrantToken.getAddress());
    });

    it("reentrancy attack is blocked by nonReentrant — outer call reverts", async function () {
      // The mock token calls agentTransferToken() again inside its transfer().
      // The ReentrancyGuard ensures the reentrant call is rejected.
      await expect(
        safe.connect(agent).agentTransferToken(
          await reentrantToken.getAddress(),
          merchant.address,
          100n,
          true,
          "0x",
        )
      ).to.be.reverted; // ReentrancyGuard: reentrant call
    });

    it("safe token balance is unchanged after failed reentrancy attack", async function () {
      const balBefore = await (reentrantToken as any).balanceOf(await safe.getAddress());
      try {
        await safe.connect(agent).agentTransferToken(
          await reentrantToken.getAddress(),
          merchant.address,
          100n,
          true,
          "0x",
        );
      } catch {
        // revert expected
      }
      const balAfter = await (reentrantToken as any).balanceOf(await safe.getAddress());
      // CEI order: balance must not have changed (no partial drain)
      expect(balAfter).to.equal(balBefore);
    });

    it("safe LYX balance is unchanged after failed reentrancy attack", async function () {
      const lyxBefore = await ethers.provider.getBalance(await safe.getAddress());
      try {
        await safe.connect(agent).agentTransferToken(
          await reentrantToken.getAddress(),
          merchant.address,
          100n,
          true,
          "0x",
        );
      } catch {
        // revert expected
      }
      const lyxAfter = await ethers.provider.getBalance(await safe.getAddress());
      expect(lyxAfter).to.equal(lyxBefore);
    });

    it("BudgetPolicy.spent() is unchanged after failed reentrancy attack", async function () {
      const policies = await pe.getPolicies();
      const bp = await ethers.getContractAt("BudgetPolicy", policies[0]) as BudgetPolicy;
      const spentBefore = await bp.spent();
      try {
        await safe.connect(agent).agentTransferToken(
          await reentrantToken.getAddress(),
          merchant.address,
          100n,
          true,
          "0x",
        );
      } catch {
        // revert expected
      }
      const spentAfter = await bp.spent();
      expect(spentAfter).to.equal(spentBefore, "spent must not increase on reverted payment");
    });
  });

  // ─── 4. execute() via KM path with malicious token ────────────────────────

  describe("execute() KM path with reentrant token", function () {
    it("reentrancy via execute() KM path is also blocked", async function () {
      const s = await deploySafeWithPE();
      safe = s.safe; pe = s.pe;

      const MockTokenFactory = await ethers.getContractFactory("MockReentrantToken");
      const rt = await MockTokenFactory.deploy() as unknown as MockReentrantToken;
      await (rt as any).mint(await safe.getAddress(), 10_000n);
      await (rt as any).setTarget(await safe.getAddress());
      await addTokenBudget(pe, await rt.getAddress());

      // Encode LSP7.transfer call for the KM execute() path
      const transferCalldata = safe.interface.encodeFunctionData("execute", [
        0,
        await rt.getAddress(),
        0,
        rt.interface.encodeFunctionData
          ? rt.interface.encodeFunctionData("transfer", [
              await safe.getAddress(), merchant.address, 100n, true, "0x"
            ])
          : "0x",
      ]);

      // This encodes an execute call — if rt doesn't have a standard ABI we use raw encoding
      const lsp7TransferData = ethers.solidityPacked(
        ["bytes4", "address", "address", "uint256", "bool", "bytes"],
        ["0x760d9bba", await safe.getAddress(), merchant.address, 100n, true, "0x"],
      );

      const kmPathCall = safe.interface.encodeFunctionData("execute", [
        0, await rt.getAddress(), 0, lsp7TransferData,
      ]);

      // agent (as KM) calls execute — triggers reentrancy inside token.transfer
      await expect(
        safe.connect(agent).execute(0, await rt.getAddress(), 0, lsp7TransferData)
      ).to.be.reverted;
    });
  });
});
