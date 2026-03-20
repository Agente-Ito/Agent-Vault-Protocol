import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { type RunState, runStore } from '@/lib/runner/runStore';

// ─── POST /api/runner/run ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    missionId?: string;
    vaultSafe?: string;
    controllerPrivateKey?: string;
    rpcUrl?: string;
    keyManagerAddress?: string;
    targetAddress?: string;
    amountWei?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    missionId,
    vaultSafe,
    controllerPrivateKey,
    keyManagerAddress,
    targetAddress,
    amountWei,
  } = body;

  // Basic input validation
  if (!missionId || !vaultSafe || !controllerPrivateKey) {
    return NextResponse.json(
      { error: 'missionId, vaultSafe, and controllerPrivateKey are required.' },
      { status: 400 }
    );
  }

  // Verify the private key looks like a valid hex key (don't log it)
  if (!/^0x[0-9a-fA-F]{64}$/.test(controllerPrivateKey)) {
    return NextResponse.json({ error: 'Invalid controller private key format.' }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  const state: RunState = {
    runId,
    status: 'running',
    message: 'Starting agent runner…',
    logs: [{ ts: Date.now(), level: 'info', msg: 'Run initiated' }],
    startedAt: Date.now(),
  };
  runStore.set(runId, state);

  // Spawn runner in background process
  const runnerPath = path.join(process.cwd(), '..', 'runner', 'agent-runner.js');

  const args = [
    runnerPath,
    '--mission-id', missionId,
    '--vault', vaultSafe,
    '--rpc', process.env.NEXT_PUBLIC_RPC_URL ?? '',
  ];
  if (keyManagerAddress) args.push('--key-manager', keyManagerAddress);
  if (targetAddress) args.push('--target', targetAddress);
  if (amountWei) args.push('--amount', amountWei);

  const child = spawn('node', args, {
    env: {
      ...process.env,
      // Pass the key via env — env vars are not logged and don't appear in process list args
      CONTROLLER_PRIVATE_KEY: controllerPrivateKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { level?: string; msg?: string };
        const entry = {
          ts: Date.now(),
          level: (parsed.level ?? 'info') as 'info' | 'warn' | 'error',
          msg: parsed.msg ?? line,
        };
        state.logs.push(entry);
        state.message = entry.msg;
      } catch {
        state.logs.push({ ts: Date.now(), level: 'info', msg: line });
        state.message = line;
      }
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) {
      state.logs.push({ ts: Date.now(), level: 'error', msg });
      state.message = msg;
    }
  });

  child.on('close', (code) => {
    state.status = code === 0 ? 'done' : 'error';
    state.message = code === 0 ? 'Agent run complete.' : `Runner exited with code ${code}`;
    // Auto-clean after 10 minutes
    setTimeout(() => runStore.delete(runId), 10 * 60 * 1000);
  });

  return NextResponse.json({ runId }, { status: 202 });
}
