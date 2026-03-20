/**
 * createDemoTask.ts
 *
 * Post-deploy setup for LUKSO testnet keeper demo:
 *   1. Verifies the deployer owns the demo vault
 *   2. Authorizes TaskScheduler in the vault's LSP6 KeyManager
 *   3. Funds the vault if needed
 *   4. Creates a recurring payment task (every 2 min) in TaskScheduler
 *   5. Saves the task ID to .env
 *
 * Usage:
 *   npx hardhat run scripts/createDemoTask.ts --network luksoTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  apPermissionsKey,
  apArrayElementKey,
  AP_ARRAY_KEY,
  PERM_POWER_USER,
  decodeArrayLength,
} from "./lsp6Keys";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  const SAFE_ADDR = process.env.AGENT_SAFE_ADDRESS;
  const KM_ADDR = process.env.KEY_MANAGER_ADDRESS;
  const SCHEDULER_ADDR = process.env.TASK_SCHEDULER_ADDRESS;

  if (!SAFE_ADDR || !KM_ADDR || !SCHEDULER_ADDR) {
    throw new Error(
      "Missing AGENT_SAFE_ADDRESS, KEY_MANAGER_ADDRESS, or TASK_SCHEDULER_ADDRESS in .env.\n" +
      "Run deploy.ts first: npx hardhat run scripts/deploy.ts --network luksoTestnet"
    );
  }

  // Demo payment: 0.01 LYX every 2 minutes to the deployer (whitelisted as demo merchant)
  const MERCHANT_ADDR = deployer.address;
  const PAYMENT_AMOUNT = ethers.parseEther("0.01");
  const INTERVAL_SECS = 120; // 2 minutes (demo-friendly; production would be daily/weekly)

  console.log("🔗 Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("📍 Deployer:", deployer.address);
  console.log("🏛️  Vault:", SAFE_ADDR);
  console.log("🔑 KeyManager:", KM_ADDR);
  console.log("⏰ TaskScheduler:", SCHEDULER_ADDR);

  const safe = await ethers.getContractAt("AgentSafe", SAFE_ADDR);
  const km = await ethers.getContractAt("LSP6KeyManager", KM_ADDR);
  const scheduler = await ethers.getContractAt("TaskScheduler", SCHEDULER_ADDR);

  // ── 1. Verify ownership ────────────────────────────────────────────────────
  console.log("\n[1/5] Verifying vault ownership...");
  const currentOwner = await safe.owner();
  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Deployer (${deployer.address}) is not the vault owner.\n` +
      `Current owner: ${currentOwner}`
    );
  }
  console.log("✅ Deployer is vault owner");

  // ── 2. Authorize TaskScheduler in the vault's LSP6 KeyManager ─────────────
  // The TaskScheduler contract must have SUPER_CALL | SUPER_TRANSFERVALUE permissions
  // so it can call keyManager.execute(agentExecutePayload) when a task fires.
  console.log("\n[2/5] Authorizing TaskScheduler in vault KeyManager...");
  const permKey = apPermissionsKey(SCHEDULER_ADDR);
  const existingPermRaw = await safe.getData(permKey);

  const alreadyAuthorized =
    existingPermRaw &&
    existingPermRaw !== "0x" &&
    !existingPermRaw.match(/^0x0+$/);

  if (alreadyAuthorized) {
    console.log("✅ TaskScheduler already authorized — skipping");
  } else {
    // Read current AddressPermissions[] length
    const lenRaw = await safe.getData(AP_ARRAY_KEY);
    const currentLen = decodeArrayLength(lenRaw);
    console.log("   Current AddressPermissions[] count:", currentLen);

    const newLen = currentLen + 1;
    // uint128 length stored as 16 big-endian bytes (LSP2 spec)
    const newLenHex = "0x" + newLen.toString(16).padStart(32, "0");
    const indexKey = apArrayElementKey(currentLen);

    // LSP9Vault.setData is restricted to the direct owner — calling through the KM
    // triggers "Only Owner or reentered URD allowed". Deploy as owner directly.
    const setDataTx = await safe.setDataBatch(
      [permKey, indexKey, AP_ARRAY_KEY],
      [
        PERM_POWER_USER,                         // SUPER_CALL | SUPER_TRANSFERVALUE (0x500)
        SCHEDULER_ADDR.toLowerCase(),            // address stored as 20-byte value
        newLenHex,                               // new array length as uint128 (16 bytes)
      ],
    );
    await setDataTx.wait();
    console.log("✅ TaskScheduler authorized with POWER_USER permissions");
  }

  // ── 3. Fund vault if low ───────────────────────────────────────────────────
  console.log("\n[3/5] Checking vault balance...");
  const currentBalance = await ethers.provider.getBalance(SAFE_ADDR);
  console.log("   Vault balance:", ethers.formatEther(currentBalance), "LYX");

  if (currentBalance >= ethers.parseEther("0.5")) {
    console.log("✅ Vault sufficiently funded");
  } else {
    console.log("   Funding vault with 2 LYX...");
    const fundTx = await deployer.sendTransaction({
      to: SAFE_ADDR,
      value: ethers.parseEther("2"),
    });
    await fundTx.wait();
    const newBalance = await ethers.provider.getBalance(SAFE_ADDR);
    console.log("✅ Vault funded:", ethers.formatEther(newBalance), "LYX");
  }

  // ── 4. Encode the task's executeCalldata ──────────────────────────────────
  // Documented path (see AgentSafe.sol comment):
  //   km.execute(abi.encodeCall(IERC725X.execute, (0, merchant, amount, "")))
  //
  // Flow on execution:
  //   keeper → taskScheduler.executeTask(taskId)
  //   → taskScheduler calls keyManager.execute(vaultExecutePayload)
  //   → keyManager forwards to vault.execute(0, merchant, amount, "0x")
  //   → vault.execute detects msg.sender == vaultKeyManager → policy check path
  //   → policyEngine.validate(KM, address(0), merchant, amount, "0x") — all policies pass
  //   → _execute(0, merchant, amount, "0x") — transfers LYX from vault balance to merchant
  console.log("\n[4/5] Encoding task calldata...");
  const vaultExecutePayload = safe.interface.encodeFunctionData("execute", [
    0,              // operationType: CALL
    MERCHANT_ADDR,  // target: whitelisted merchant
    PAYMENT_AMOUNT, // value: LYX sent from vault balance
    "0x",           // data: empty
  ]);
  const kmExecuteCalldata = km.interface.encodeFunctionData("execute", [vaultExecutePayload]);

  console.log("   Recipient:", MERCHANT_ADDR, "(deployer = demo merchant)");
  console.log("   Amount per execution:", ethers.formatEther(PAYMENT_AMOUNT), "LYX");
  console.log("   Interval:", INTERVAL_SECS, "seconds (", INTERVAL_SECS / 60, "min)");

  // ── 5. Create task in TaskScheduler ───────────────────────────────────────
  console.log("\n[5/5] Creating task in TaskScheduler...");
  const taskId = ethers.id("DemoRecurringPayment-v1");
  const firstExecution = Math.floor(Date.now() / 1000) + INTERVAL_SECS;

  // If a task with this ID already exists (e.g. from a previous run with wrong encoding),
  // delete it so we can create it fresh with the correct calldata.
  let taskExists = false;
  try {
    await scheduler.getTask(taskId);
    taskExists = true;
  } catch {
    taskExists = false;
  }

  if (taskExists) {
    console.log("   Existing task found — deleting to recreate with fresh calldata...");
    const deleteTx = await scheduler.deleteTask(taskId);
    await deleteTx.wait();
    console.log("   Old task deleted");
  }

  const createTx = await scheduler.createTask(
    taskId,
    SAFE_ADDR,
    KM_ADDR,
    kmExecuteCalldata,
    0,               // TriggerType.TIMESTAMP
    firstExecution,
    INTERVAL_SECS,
  );
  await createTx.wait();
  console.log("✅ Task created:", taskId);
  console.log("   First execution:", new Date(firstExecution * 1000).toISOString());

  // Save task ID to .env
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  const taskIdRegex = /^DEMO_TASK_ID=.*$/m;
  if (taskIdRegex.test(envContent)) {
    envContent = envContent.replace(taskIdRegex, `DEMO_TASK_ID=${taskId}`);
  } else {
    envContent += `\nDEMO_TASK_ID=${taskId}`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log("✅ Task ID saved to .env");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("✅ Demo task ready!");
  console.log("========================================");
  console.log("  Vault:            ", SAFE_ADDR);
  console.log("  KeyManager:       ", KM_ADDR);
  console.log("  TaskScheduler:    ", SCHEDULER_ADDR);
  console.log("  Task ID:          ", taskId);
  console.log("  Merchant:         ", MERCHANT_ADDR);
  console.log("  Amount per run:   ", ethers.formatEther(PAYMENT_AMOUNT), "LYX");
  console.log("  Interval:         ", INTERVAL_SECS, "seconds");
  console.log("  First execution:  ", new Date(firstExecution * 1000).toISOString());
  console.log("\n▶ Start the keeper:");
  console.log("   node runner/keeper.js");
  console.log("\n🔍 Monitor on LUKSO testnet explorer:");
  console.log("   https://explorer.testnet.lukso.network/address/" + SCHEDULER_ADDR);
}

main().catch((e) => {
  console.error("❌ Error:", e.message || e);
  process.exitCode = 1;
});
