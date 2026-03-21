/**
 * seedAgents.ts — Register curated demo agent profiles in the AgentCoordinator.
 *
 * Reads COORDINATOR_ADDRESS from root .env (written by deployCoordinator.ts).
 * Caller must be the roleAdmin; run with the same account that deployed the coordinator.
 *
 * Usage:
 *   npx hardhat run scripts/seedAgents.ts --network luksoTestnet
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ─── Agent profiles ────────────────────────────────────────────────────────────
// Each profile maps to a distinct use-case. Addresses are fresh random wallets so
// they are EOA-type agents (isContract = false, since no code is deployed there).

const PROFILES = [
  {
    name: "Recurring Payments Agent",
    role: "PAYMENT_AGENT",
    capabilities: ["CAN_PAY", "CAN_TRANSFER"],
    allowedAutomation: true,
    maxGasPerCall: 0,
    description: "Handles recurring payment schedules within a fixed budget window.",
  },
  {
    name: "Subscriptions Agent",
    role: "SUBSCRIPTION_AGENT",
    capabilities: ["CAN_SUBSCRIBE"],
    allowedAutomation: true,
    maxGasPerCall: 0,
    description: "Manages subscription-based payment flows to whitelisted merchants.",
  },
  {
    name: "Treasury Agent",
    role: "TREASURY_AGENT",
    capabilities: ["CAN_REBALANCE", "CAN_TRANSFER"],
    allowedAutomation: false,
    maxGasPerCall: 500_000,
    description: "High-permission agent for treasury rebalancing. Automation disabled.",
  },
];

// ─── Coordinator ABI (subset required for seeding) ────────────────────────────
const COORDINATOR_ABI = [
  "function registerAgent(address agent, uint256 maxGasPerCall, bool allowedAutomation) external",
  "function assignRole(address agent, bytes32 role, bytes32[] capabilities) external",
  "function isAgentRegistered(address agent) external view returns (bool)",
  "function roleAdmin() external view returns (address)",
  "event AgentRegistered(address indexed agent, bool isContract, uint256 maxGasPerCall, bool allowedAutomation)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("🔗 Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("📍 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "LYX");

  // ── Resolve coordinator address ───────────────────────────────────────────────
  let coordinatorAddress: string | undefined =
    process.env.COORDINATOR_ADDRESS ??
    process.env.NEXT_PUBLIC_COORDINATOR_ADDRESS;

  if (!coordinatorAddress) {
    // Try reading from the deployment JSON
    const jsonPath = path.join(__dirname, "..", "deployments", `agent-coordinator-${network.chainId}.json`);
    if (fs.existsSync(jsonPath)) {
      const deployment = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      coordinatorAddress = deployment.coordinatorAddress;
    }
  }

  if (!coordinatorAddress || !ethers.isAddress(coordinatorAddress)) {
    throw new Error(
      "No valid COORDINATOR_ADDRESS found. Run deployCoordinator.ts first."
    );
  }

  console.log("\n📝 CoordinatorAddress:", coordinatorAddress);

  const coordinator = new ethers.Contract(coordinatorAddress, COORDINATOR_ABI, deployer);

  // Verify caller is roleAdmin
  const roleAdmin: string = await coordinator.roleAdmin();
  if (roleAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Caller ${deployer.address} is not roleAdmin (${roleAdmin}). Use the deployer account.`
    );
  }
  console.log("✅ roleAdmin confirmed:", roleAdmin);

  let nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log(`   Starting nonce: ${nonce}`);

  const results: Array<{
    name: string;
    address: string;
    privateKey: string;
    role: string;
    capabilities: string[];
    allowedAutomation: boolean;
    maxGasPerCall: number;
  }> = [];

  // ── Register each profile ─────────────────────────────────────────────────────
  for (let i = 0; i < PROFILES.length; i++) {
    const profile = PROFILES[i];
    console.log(`\n[${i + 1}/${PROFILES.length}] Registering "${profile.name}"...`);

    const wallet = ethers.Wallet.createRandom();
    console.log(`  Address: ${wallet.address}`);

    // Register agent
    const registerTx = await coordinator.registerAgent(
      wallet.address,
      profile.maxGasPerCall,
      profile.allowedAutomation,
      { nonce: nonce++ }
    );
    await registerTx.wait();
    console.log(`  ✅ Registered (hash: ${registerTx.hash})`);

    // Assign role with capabilities
    const roleBytes32 = ethers.encodeBytes32String(profile.role);
    const capBytes32 = profile.capabilities.map((c) => ethers.encodeBytes32String(c));

    const roleTx = await coordinator.assignRole(
      wallet.address,
      roleBytes32,
      capBytes32,
      { nonce: nonce++ }
    );
    await roleTx.wait();
    console.log(`  ✅ Role "${profile.role}" assigned`);

    results.push({
      name: profile.name,
      address: wallet.address,
      privateKey: wallet.privateKey,
      role: profile.role,
      capabilities: profile.capabilities,
      allowedAutomation: profile.allowedAutomation,
      maxGasPerCall: profile.maxGasPerCall,
    });
  }

  // ── Persist results ───────────────────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const jsonPath = path.join(deploymentsDir, `agent-seeds-${network.chainId}.json`);

  const output = {
    network: network.name,
    chainId: Number(network.chainId),
    coordinatorAddress,
    seededAt: Math.floor(Date.now() / 1000),
    agents: results,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Seed data saved to deployments/agent-seeds-${network.chainId}.json`);

  console.log("\n========================================");
  console.log("✅ Agent Seeding Complete");
  console.log("========================================");
  results.forEach((r) => {
    console.log(`\n  ${r.name}`);
    console.log(`    Address : ${r.address}`);
    console.log(`    Role    : ${r.role}`);
    console.log(`    Caps    : ${r.capabilities.join(", ")}`);
    console.log(`    Auto    : ${r.allowedAutomation}`);
  });
}

main().catch((error) => {
  console.error("❌ Agent seeding failed:");
  console.error(error);
  process.exitCode = 1;
});
