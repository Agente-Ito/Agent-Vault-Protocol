/**
 * errorMap.ts — Decodes on-chain revert reasons into user-friendly strings.
 *
 * Handles:
 *  - Custom errors (4-byte selector lookup table from LUKSO LSP6 + AVP contracts)
 *  - require()/revert() string reasons
 *  - Wagmi/viem ContractFunctionRevertedError format
 *  - Generic fallback
 *
 * Usage:
 *   import { decodeRevertReason } from '@/lib/errorMap';
 *   const msg = decodeRevertReason(caughtError);   // show to user
 */

/**
 * Known 4-byte custom error selectors.
 * Source: LSP6Errors.sol (@lukso/lsp6-contracts) + TemplateFactory.sol (AVP)
 * Keep in sync with scripts/lsp6Keys.ts KNOWN_SELECTORS.
 */
const SELECTOR_MAP: Record<string, string> = {
  // LSP6 KeyManager
  '0x82507c0e': 'Not authorised — the controller is missing a required permission',
  '0x3621bbcc': 'No permissions set for this controller address',
  '0x59bbd7a8': 'Call not allowed — target address is not on the AllowedCalls list',
  '0xa84f2360': 'No calls allowed — the AllowedCalls list is empty for this controller',
  '0x6f855b54': 'Invalid AllowedCalls encoding in storage',
  '0x5c4e99d6': 'Whitelisted call is invalid or misconfigured',
  '0x8e7cc7e8': 'Calling the KeyManager contract itself is not permitted',
  // LSP17 extensions
  '0x06d5b17d': 'No extension found for this function selector',
  // AVP TemplateFactory
  '0x4b6d3d25': 'Unknown vault template ID',
};

/**
 * Known require() reason strings → user-friendly messages.
 * Keys are the exact strings from contract require() calls.
 */
const REASON_MAP: Record<string, string> = {
  'AS: must call via KeyManager':        'Access denied — this action must be called through the vault KeyManager',
  'AS: KM not set':                      'KeyManager is not configured for this vault',
  'AS: PE not set':                      'PolicyEngine is not configured for this vault',
  'AS: PE already set':                  'PolicyEngine is already set and cannot be changed',
  'AS: KM already set':                  'KeyManager is already set and cannot be changed',
  'AS: insufficient LYX balance':        'Insufficient LYX balance in the vault',
  'AS: insufficient token balance':      'Insufficient token balance in the vault',
  'PE: only safe':                       'PolicyEngine can only be called by its linked AgentSafe',
  'BP: budget exceeded':                 'Payment exceeds the remaining period budget',
  'BP: token mismatch':                  "Token address doesn't match this vault's budget token",
  'MP: merchant not allowed':            'Recipient is not on the approved merchant whitelist',
  'EP: expired':                         'This vault has expired — payments are no longer allowed',
  'Registry: too many agents':           'Too many agents (maximum 20 per vault)',
  'Registry: too many merchants':        'Too many merchants (maximum 100 per batch)',
  'Registry: caller not authorized':     'Caller is not authorized to deploy vaults on behalf of others',
  'Registry: expiration in the past':    'Expiration timestamp must be in the future',
  'Registry: super permissions disabled':           'SUPER permissions are not allowed — set allowSuperPermissions to enable them',
  'Registry: AllowedCalls required for CALL permission': 'AllowedCalls list is required when using CALL permission without SUPER mode',
  'Registry: allowedCallsByAgent length mismatch':  'Number of AllowedCalls entries must match the number of agents',
  'Ownable: caller is not the owner':    'Only the vault owner can perform this action',
};

/**
 * Decodes a revert error from wagmi/viem/ethers into a user-friendly string.
 *
 * @param error  Any thrown error from a transaction or contract call
 * @returns      Human-readable description suitable for display in the UI
 */
export function decodeRevertReason(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return String(error);

  type ErrorWithExtras = Error & {
    data?: unknown;
    shortMessage?: unknown;
    reason?: unknown;
    error?: { data?: unknown };
    cause?: { data?: unknown };
    code?: unknown;
  };
  const e = error as ErrorWithExtras;

  // viem ContractFunctionRevertedError: exposes decoded error name
  const viemData = e.data as { errorName?: string } | undefined;
  if (viemData?.errorName) {
    return SELECTOR_MAP[viemData.errorName] ?? `Transaction reverted: ${viemData.errorName}`;
  }

  // ethers v6 / wagmi: shortMessage wraps the original reason
  const shortMsg: string | undefined =
    typeof e.shortMessage === 'string' ? e.shortMessage :
    typeof e.reason === 'string' ? e.reason :
    undefined;
  if (typeof shortMsg === 'string' && shortMsg.length > 0) {
    // extract require() reason from viem's formatted string
    const reasonMatch = shortMsg.match(/reverted with reason string "([^"]+)"/);
    if (reasonMatch) {
      const reason = reasonMatch[1];
      return REASON_MAP[reason] ?? `Reverted: ${reason}`;
    }
    if (shortMsg.startsWith('The contract function')) {
      return shortMsg.replace(/^The contract function "\w+" reverted\.?\s*/, 'Reverted: ');
    }
    if (shortMsg.includes('reverted')) return shortMsg.slice(0, 300);
  }

  // 4-byte selector in raw error data
  const rawData: string | undefined =
    (typeof e.data === 'string' ? e.data : undefined) ??
    (typeof e.error?.data === 'string' ? e.error.data : undefined) ??
    (typeof e.cause?.data === 'string' ? e.cause.data : undefined);
  if (typeof rawData === 'string' && rawData.startsWith('0x') && rawData.length >= 10) {
    const selector = rawData.slice(0, 10).toLowerCase();
    if (SELECTOR_MAP[selector]) return `Transaction reverted: ${SELECTOR_MAP[selector]}`;
    return `Transaction reverted with an unrecognized error (${selector})`;
  }

  // require() reason buried in the error message string
  const msg = error.message ?? '';
  const requireMatch = msg.match(/reverted with reason string '([^']+)'/);
  if (requireMatch) {
    const reason = requireMatch[1];
    return REASON_MAP[reason] ?? `Reverted: ${reason}`;
  }

  // Panic code (e.g. division by zero, array out of bounds)
  const panicMatch = msg.match(/reverted with panic code (\w+)/);
  if (panicMatch) {
    return `Contract panic — invalid operation (code: ${panicMatch[1]})`;
  }

  // User rejected in wallet
  if (
    msg.includes('User rejected') ||
    msg.includes('user rejected') ||
    e.code === 4001
  ) {
    return 'Transaction cancelled by user';
  }

  return `Transaction failed: ${msg.slice(0, 300)}`;
}

/**
 * Returns true if the error is a user wallet rejection (e.g. MetaMask cancel).
 * Use this to suppress error toasts for expected user cancellations.
 */
export function isUserRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const e = error as Error & { code?: unknown };
  const msg = error.message ?? '';
  return (
    msg.includes('User rejected') ||
    msg.includes('user rejected') ||
    e.code === 4001
  );
}
