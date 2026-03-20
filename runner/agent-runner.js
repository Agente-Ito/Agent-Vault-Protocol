#!/usr/bin/env node
/**
 * Agent Runner — standalone Node.js process.
 *
 * Lifecycle:
 *  1. Parse args (mission-id, vault, rpc, key-manager, target, amount)
 *  2. Build signed tx: keyManager.execute(CALL, agentSafe, 0, agentExecute(to, amount))
 *  3. Simulate via policyEngine.simulateExecution() — shows policy decision without spending budget
 *  4. If allowed, send real tx
 *  5. Emit structured JSON logs to stdout (picked up by the Next.js API route)
 *  6. Append to logs/agent_log.json
 *
 * Usage:
 *   node runner/agent-runner.js \
 *     --mission-id <id> \
 *     --vault <0x…>  \
 *     --rpc <https://…> \
 *     --key-manager <0x…> \
 *     --target <0x…> \
 *     --amount <wei>
 *
 *   CONTROLLER_PRIVATE_KEY=0x… (set via env, never as CLI arg)
 *
 * npm run runner:once  — runs with env vars from .env.runner
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    map[key] = args[i + 1];
  }
  return map;
}

const args = parseArgs();
const MISSION_ID     = args['mission-id']  || process.env.MISSION_ID || 'unknown';
const VAULT_SAFE     = args['vault']        || process.env.VAULT_SAFE;
const RPC_URL        = args['rpc']          || process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL;
const KM_ADDRESS     = args['key-manager']  || process.env.KEY_MANAGER_ADDRESS;
const TARGET         = args['target']        || process.env.TARGET_ADDRESS;
const AMOUNT_WEI     = args['amount']        || process.env.AMOUNT_WEI;
const PRIVATE_KEY    = process.env.CONTROLLER_PRIVATE_KEY;

// ─── Logging ──────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, '..', 'logs', 'agent_log.json');

function log(level, msg, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    missionId: MISSION_ID,
    level,
    msg,
    ...extra,
  };
  // Structured JSON to stdout — read by the API route
  process.stdout.write(JSON.stringify(entry) + '\n');

  // Append to persistent log file
  try {
    let log = [];
    if (fs.existsSync(LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    }
    log.unshift(entry);
    // Keep last 1000 entries
    fs.writeFileSync(LOG_FILE, JSON.stringify(log.slice(0, 1000), null, 2));
  } catch { /* non-fatal */ }
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const KM_ABI = [
  'function execute(uint256 operationType, address target, uint256 value, bytes calldata data) external payable returns (bytes memory)',
];

const SAFE_ABI = [
  'function agentExecute(address payable to, uint256 amount, bytes calldata data) external',
  'function policyEngine() view returns (address)',
];

const PE_ABI = [
  'function simulateExecution(address agent, address token, address to, uint256 amount, bytes calldata data) external',
  'event Validated(address indexed agent, address indexed token, address indexed to, uint256 amount)',
  'event ExecutionBlocked(address indexed agent, address indexed policy, address indexed token, address to, uint256 amount, string reason)',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!PRIVATE_KEY) {
    log('error', 'CONTROLLER_PRIVATE_KEY env variable is required.');
    process.exit(1);
  }
  if (!VAULT_SAFE || !RPC_URL || !KM_ADDRESS || !TARGET || !AMOUNT_WEI) {
    log('error', 'Missing required args: vault, rpc, key-manager, target, amount.');
    process.exit(1);
  }

  log('info', 'Agent runner starting', { vault: VAULT_SAFE, target: TARGET, amountWei: AMOUNT_WEI });

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  log('info', 'Controller loaded', { controller: wallet.address });

  // ── Step 1: Resolve PolicyEngine
  const safe = new ethers.Contract(VAULT_SAFE, SAFE_ABI, provider);
  let policyEngineAddr;
  try {
    policyEngineAddr = await safe.policyEngine();
    log('info', 'Policy engine resolved', { policyEngine: policyEngineAddr });
  } catch (err) {
    log('error', 'Failed to resolve policy engine', { error: err.message });
    process.exit(1);
  }

  // ── Step 2: Simulate execution (static, does not change state or spend budget)
  const pe = new ethers.Contract(policyEngineAddr, PE_ABI, provider);
  log('info', 'Simulating execution (policy pre-check)…');

  let simulationPassed = false;
  let blockedReason = null;
  try {
    await pe.simulateExecution.staticCall(
      wallet.address,          // agent = controller address
      ethers.ZeroAddress,      // token = LYX
      TARGET,
      BigInt(AMOUNT_WEI),
      '0x'
    );
    simulationPassed = true;
    log('info', 'Simulation passed — payment allowed by policies');
  } catch (err) {
    blockedReason = err.message;
    log('warn', 'Simulation blocked — payment would be denied by policy', { reason: err.message });
  }

  if (!simulationPassed) {
    log('info', 'Execution aborted (policy blocked)', {
      missionId: MISSION_ID,
      controller: wallet.address,
      target: TARGET,
      amountWei: AMOUNT_WEI,
      result: 'blocked',
      reason: blockedReason,
    });
    process.exit(0);
  }

  // ── Step 3: Encode agentExecute(target, amount, 0x)
  const safeIface = new ethers.Interface(SAFE_ABI);
  const agentExecuteCalldata = safeIface.encodeFunctionData('agentExecute', [
    TARGET,
    BigInt(AMOUNT_WEI),
    '0x',
  ]);

  // ── Step 4: Send via KeyManager.execute(CALL=0, safe, 0, agentExecuteCalldata)
  log('info', 'Sending transaction via KeyManager…');
  const km = new ethers.Contract(KM_ADDRESS, KM_ABI, wallet);

  let txHash = null;
  let blockNumber = null;
  try {
    const tx = await km.execute(0, VAULT_SAFE, 0, agentExecuteCalldata);
    log('info', 'Transaction submitted', { txHash: tx.hash });
    const receipt = await tx.wait();
    txHash = tx.hash;
    blockNumber = receipt.blockNumber;
    log('info', 'Transaction confirmed', {
      missionId: MISSION_ID,
      controller: wallet.address,
      target: TARGET,
      amountWei: AMOUNT_WEI,
      result: 'success',
      txHash,
      blockNumber,
    });
  } catch (err) {
    log('error', 'Transaction failed', {
      missionId: MISSION_ID,
      controller: wallet.address,
      target: TARGET,
      amountWei: AMOUNT_WEI,
      result: 'error',
      reason: err.message,
    });
    process.exit(1);
  }

  log('info', 'Agent run complete.', { txHash, blockNumber });
  process.exit(0);
}

main().catch((err) => {
  log('error', 'Unhandled error in agent runner', { error: err.message });
  process.exit(1);
});
