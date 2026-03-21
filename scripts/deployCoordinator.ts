import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface CoordinatorDeploymentResult {
  network: string;
  chainId: number;
  deployer: string;
  coordinatorAddress: string;
  roleAdmin: string;
  demoAgentAddress: string;
  demoAgentPrivateKey: string;
  deploymentTimestamp: number;
  blockNumber: number;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("🔗 Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("📍 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "LYX");

  if (balance <= 0n) {
    throw new Error("Deployer balance is 0. Fund the account before deploying AgentCoordinator.");
  }

  let nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log(`   Starting nonce: ${nonce}`);

  console.log("\n[1/2] Deploying AgentCoordinator...");
  const AgentCoordinatorFactory = await ethers.getContractFactory("AgentCoordinator");
  const coordinator = await AgentCoordinatorFactory.deploy({ nonce: nonce++ });
  await coordinator.waitForDeployment();
  const coordinatorAddress = await coordinator.getAddress();
  console.log("✅ AgentCoordinator:", coordinatorAddress);

  console.log("\n[2/2] Registering Vaultia demo agent...");
  const demoAgentWallet = ethers.Wallet.createRandom();
  const registerTx = await coordinator.registerAgent(demoAgentWallet.address, 0, true, { nonce: nonce++ });
  await registerTx.wait();
  console.log("✅ Demo agent registered:", demoAgentWallet.address);

  const blockNumber = await ethers.provider.getBlockNumber();
  const result: CoordinatorDeploymentResult = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    coordinatorAddress,
    roleAdmin: deployer.address,
    demoAgentAddress: demoAgentWallet.address,
    demoAgentPrivateKey: demoAgentWallet.privateKey,
    deploymentTimestamp: Math.floor(Date.now() / 1000),
    blockNumber,
  };

  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    const updates = [
      { key: "COORDINATOR_ADDRESS", value: result.coordinatorAddress },
      { key: "AGENT_ADDRESS", value: result.demoAgentAddress },
      { key: "AGENT_PRIVATE_KEY", value: result.demoAgentPrivateKey },
    ];

    updates.forEach(({ key, value }) => {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });

    fs.writeFileSync(envPath, envContent);
    console.log("✅ Updated root .env with coordinator values");
  }

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const jsonPath = path.join(deploymentsDir, `agent-coordinator-${network.chainId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log("✅ Coordinator deployment JSON saved to", jsonPath);

  console.log("\n🔍 Block Explorer Links (LUKSO Testnet):");
  console.log(`  Coordinator: https://explorer.testnet.lukso.network/address/${coordinatorAddress}`);
  console.log(`  Demo Agent:  ${demoAgentWallet.address}`);

  console.log("\n========================================");
  console.log("✅ AgentCoordinator Deployment Successful");
  console.log("========================================");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("❌ AgentCoordinator deployment failed:");
  console.error(error);
  process.exitCode = 1;
});