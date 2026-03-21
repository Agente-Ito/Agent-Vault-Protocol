import { ethers } from "hardhat";
import { parseUnits } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("🔗 Network:", network.name, `(chainId: ${network.chainId})`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("📍 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "LYX");

  console.log("\n🚀 Deploying LSP7DemoToken…");
  const Factory = await ethers.getContractFactory("LSP7DemoToken");
  const token = await Factory.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ LSP7DemoToken deployed at:", tokenAddress);

  console.log("\n🪙 Minting 10 000 AVT to deployer for verification…");
  const mintTx = await token.mint(deployer.address, parseUnits("10000", 18));
  await mintTx.wait();
  console.log("✅ Minted — tx:", mintTx.hash);

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const artifact = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    tokenAddress,
    deploymentTimestamp: Math.floor(Date.now() / 1000),
    mintTxHash: mintTx.hash,
  };

  const outPath = path.join(deploymentsDir, `lukso-demo-token-${network.chainId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log("\n📄 Deployment artifact written to:", outPath);
  console.log("\n📋 Add to .env.local:");
  console.log(`NEXT_PUBLIC_LUKSO_DEMO_TOKEN_ADDRESS=${tokenAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
