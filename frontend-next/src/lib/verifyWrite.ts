/**
 * verifyWrite.ts — Post-transaction ERC725Y read-back verification.
 *
 * After every setData / setDataBatch transaction is mined, call verifyERC725YWrite
 * to confirm the chain actually stored the intended value.
 *
 * WHY: tx.status = 1 (success) only means the transaction did not revert.
 * Silent storage corruption (e.g. wrong key encoding, off-by-one indexes)
 * would be invisible without an explicit read-back. The "success" shown in the
 * UI MUST depend on getData(), not just tx.status or emitted events.
 */

import type { PublicClient } from 'viem';

/** Minimal ABI fragment for ERC725Y.getData(). */
const ERC725Y_GET_DATA_ABI = [
  {
    inputs: [{ internalType: 'bytes32', name: 'dataKey', type: 'bytes32' }],
    name: 'getData',
    outputs: [{ internalType: 'bytes', name: 'dataValue', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Reads a key from an ERC725Y contract and checks it equals the expected value.
 *
 * @param publicClient  Viem PublicClient for the target network
 * @param contractAddr  Address of the ERC725Y contract (AgentSafe)
 * @param key           bytes32 data key as a `0x`-prefixed hex string
 * @param expected      Exact bytes value that was written (hex string)
 * @returns             true if the stored value matches; false otherwise
 */
export async function verifyERC725YWrite(
  publicClient: PublicClient,
  contractAddr: `0x${string}`,
  key: `0x${string}`,
  expected: string,
): Promise<boolean> {
  try {
    const observed = await publicClient.readContract({
      address: contractAddr,
      abi: ERC725Y_GET_DATA_ABI,
      functionName: 'getData',
      args: [key],
    });
    const norm = (s: string) => (s as string).toLowerCase().replace(/^0x/, '');
    return norm(observed as string) === norm(expected);
  } catch {
    // Read failure → conservative: treat as unverified (not success)
    return false;
  }
}

/**
 * Verifies multiple ERC725Y write operations in a single batch (parallel reads).
 *
 * @param publicClient  Viem PublicClient
 * @param contractAddr  ERC725Y contract address
 * @param writes        Array of { key, expected, label } pairs to check
 * @returns             Array of results: { key, label, matches: boolean }
 */
export async function verifyERC725YWrites(
  publicClient: PublicClient,
  contractAddr: `0x${string}`,
  writes: Array<{ key: `0x${string}`; expected: string; label: string }>,
): Promise<Array<{ key: string; label: string; matches: boolean }>> {
  return Promise.all(
    writes.map(async ({ key, expected, label }) => ({
      key,
      label,
      matches: await verifyERC725YWrite(publicClient, contractAddr, key, expected),
    })),
  );
}

/**
 * Returns a user-facing error string if any writes failed, or null if all passed.
 *
 * @param results  Output from verifyERC725YWrites
 * @returns        null if all verified; descriptive error string if any failed
 */
export function summarizeVerificationResults(
  results: Array<{ key: string; label: string; matches: boolean }>,
): string | null {
  const failures = results.filter((r) => !r.matches);
  if (failures.length === 0) return null;
  const list = failures
    .map((f) => `  • ${f.label} (${f.key.slice(0, 18)}...)`)
    .join('\n');
  return (
    `Storage verification failed after transaction:\n${list}\n\n` +
    `The transaction was accepted but the chain did not store the intended values. ` +
    `Please contact support with the transaction hash.`
  );
}

// ─── LSP6 key derivation (mirrors scripts/lsp6Keys.ts) ────────────────────────
// AddressPermissions:Permissions:<addr> prefix (10 bytes, no 0x)
const AP_PERMS_PREFIX   = '4b80742de2bf82acb363';
// AddressPermissions:AllowedCalls:<addr> prefix (10 bytes, no 0x)
const AP_ALLOWED_PREFIX = '4b80742de2bf393a64c7';

function lsp6PermissionsKey(address: string): `0x${string}` {
  const raw = address.toLowerCase().replace(/^0x/, '');
  return `0x${AP_PERMS_PREFIX}0000${raw}`;
}

function lsp6AllowedCallsKey(address: string): `0x${string}` {
  const raw = address.toLowerCase().replace(/^0x/, '');
  return `0x${AP_ALLOWED_PREFIX}0000${raw}`;
}

// ─── Per-agent permission verification ────────────────────────────────────────

export interface PermissionsVerificationResult {
  agent: string;
  mode: number;
  permissionsMatch: boolean;
  allowedCallsMatch: boolean;
  observedPermissions: string;
  observedAllowedCalls: string;
}

/**
 * After deployVault, reads back each agent's permissions and AllowedCalls from
 * the ERC725Y storage and compares against what the frontend expected to write.
 *
 * @param publicClient       Viem PublicClient
 * @param safeAddr           AgentSafe contract address
 * @param agents             Array of { address, mode, expectedPermissions, expectedAllowedCalls }
 * @returns                  Per-agent verification results
 */
export async function verifyPermissionsWrite(
  publicClient: PublicClient,
  safeAddr: `0x${string}`,
  agents: Array<{
    address: string;
    mode: number;
    expectedPermissions: string;
    expectedAllowedCalls: string;
  }>,
): Promise<PermissionsVerificationResult[]> {
  const norm = (s: string) => s.toLowerCase().replace(/^0x/, '');

  return Promise.all(
    agents.map(async ({ address, mode, expectedPermissions, expectedAllowedCalls }) => {
      const permKey    = lsp6PermissionsKey(address);
      const allowedKey = lsp6AllowedCallsKey(address);

      const [rawPerms, rawAllowed] = await Promise.all([
        publicClient.readContract({
          address: safeAddr,
          abi: ERC725Y_GET_DATA_ABI,
          functionName: 'getData',
          args: [permKey],
        }).catch(() => '0x'),
        publicClient.readContract({
          address: safeAddr,
          abi: ERC725Y_GET_DATA_ABI,
          functionName: 'getData',
          args: [allowedKey],
        }).catch(() => '0x'),
      ]);

      return {
        agent: address,
        mode,
        permissionsMatch:  norm(rawPerms as string) === norm(expectedPermissions),
        allowedCallsMatch: norm(rawAllowed as string) === norm(expectedAllowedCalls),
        observedPermissions:  rawPerms as string,
        observedAllowedCalls: rawAllowed as string,
      };
    }),
  );
}
