'use client';

import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionResult = 'success' | 'blocked';

export interface ExecutionLogEntry {
  id: string;
  missionId?: string;
  controller: string;
  target: string;
  token: string; // address(0) = LYX
  amount: string; // Wei string
  result: ExecutionResult;
  reason?: string; // Only present on 'blocked'
  timestamp: number; // Unix ms (approximated from block)
  txHash?: string;
  blockNumber?: number;
}

// ─── PolicyEngine event ABIs ─────────────────────────────────────────────────

const POLICY_ENGINE_ABI = [
  'event Validated(address indexed agent, address indexed token, address indexed to, uint256 amount)',
  'event ExecutionBlocked(address indexed agent, address indexed policy, address indexed token, address to, uint256 amount, string reason)',
];

const SAFE_ABI = [
  'function policyEngine() view returns (address)',
];

// ─── InMemory log store (supplements on-chain events with runner logs) ────────

const LOCAL_LOGS: Map<string, ExecutionLogEntry[]> = new Map();

export function addLocalLog(vaultSafe: string, entry: ExecutionLogEntry) {
  const existing = LOCAL_LOGS.get(vaultSafe.toLowerCase()) ?? [];
  LOCAL_LOGS.set(vaultSafe.toLowerCase(), [entry, ...existing].slice(0, 100));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExecutionLogs(
  vaultSafe: string | null,
  controllerFilter?: string | null
) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!vaultSafe) { setLogs([]); return; }
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);

      // 1. Resolve PolicyEngine address from the safe
      const safe = new ethers.Contract(vaultSafe, SAFE_ABI, provider);
      let policyEngineAddr: string;
      try {
        policyEngineAddr = await safe.policyEngine();
      } catch {
        setLoading(false);
        return;
      }

      const pe = new ethers.Contract(policyEngineAddr, POLICY_ENGINE_ABI, provider);
      const fromBlock = -10000; // last ~10000 blocks; adjust as needed

      // 2. Fetch success events
      const validatedFilter = controllerFilter
        ? pe.filters.Validated(controllerFilter)
        : pe.filters.Validated();
      const blockedFilter = controllerFilter
        ? pe.filters.ExecutionBlocked(controllerFilter)
        : pe.filters.ExecutionBlocked();

      const [validated, blocked] = await Promise.all([
        pe.queryFilter(validatedFilter, fromBlock),
        pe.queryFilter(blockedFilter, fromBlock),
      ]);

      const chain: ExecutionLogEntry[] = [
        ...validated.map((e) => {
          const log = e as ethers.EventLog;
          return {
            id: `${e.transactionHash}-v`,
            controller: log.args[0] as string,
            target: log.args[2] as string,
            token: log.args[1] as string,
            amount: (log.args[3] as bigint).toString(),
            result: 'success' as const,
            timestamp: Date.now(), // block timestamp not easily available without extra call
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
          };
        }),
        ...blocked.map((e) => {
          const log = e as ethers.EventLog;
          return {
            id: `${e.transactionHash}-b`,
            controller: log.args[0] as string,
            target: log.args[3] as string,
            token: log.args[2] as string,
            amount: (log.args[4] as bigint).toString(),
            result: 'blocked' as const,
            reason: log.args[5] as string,
            timestamp: Date.now(),
            txHash: e.transactionHash,
            blockNumber: e.blockNumber,
          };
        }),
      ];

      // 3. Merge with locally added runner logs
      const local = LOCAL_LOGS.get(vaultSafe.toLowerCase()) ?? [];
      const merged = [...local, ...chain].sort((a, b) => b.timestamp - a.timestamp);
      setLogs(merged);
    } catch {
      // Non-fatal: logs are supplementary
      const local = LOCAL_LOGS.get(vaultSafe?.toLowerCase() ?? '') ?? [];
      setLogs(local);
    } finally {
      setLoading(false);
    }
  }, [vaultSafe, controllerFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}
