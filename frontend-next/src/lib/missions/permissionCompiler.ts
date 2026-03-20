import { ethers } from 'ethers';
import { MissionType, MISSION_PERMISSIONS, Period } from './missionTypes';

// ─── ERC725Y storage key constants (mirrored from LSP6KeyLib.sol) ─────────────

/** AddressPermissions[] — stores the length of the controller array as uint128 */
export const AP_ARRAY_KEY =
  '0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3';

/** bytes16 prefix for AddressPermissions[index] element keys */
const AP_ARRAY_ELEMENT_PREFIX = '0xdf30dba06db6a30e65354d9a64c60986';

/** bytes10 prefix for AddressPermissions:Permissions:<address> */
const AP_PERMS_PREFIX = '0x4b80742de2bf82acb363';

/** bytes10 prefix for AddressPermissions:AllowedCalls:<address> */
const AP_ALLOWED_CALLS_PREFIX = '0x4b80742de2bf393a64c7';

/**
 * Generate the ERC725Y key for AddressPermissions[index].
 * Mirrors apArrayElementKey(uint128 index) in LSP6KeyLib.sol.
 */
export function apArrayElementKey(index: number): string {
  const idxHex = index.toString(16).padStart(32, '0'); // 16 bytes (uint128)
  return AP_ARRAY_ELEMENT_PREFIX + idxHex;
}

/**
 * Generate the ERC725Y key for AddressPermissions:Permissions:<controller>.
 * Mirrors apPermissionsKey(address controller) in LSP6KeyLib.sol.
 */
export function apPermissionsKey(controller: string): string {
  const addr = controller.toLowerCase().replace('0x', '');
  // bytes10(prefix) + bytes2(0) + bytes20(address)
  return AP_PERMS_PREFIX + '0000' + addr;
}

/**
 * Generate the ERC725Y key for AddressPermissions:AllowedCalls:<controller>.
 * Mirrors apAllowedCallsKey(address controller) in LSP6KeyLib.sol.
 */
export function apAllowedCallsKey(controller: string): string {
  const addr = controller.toLowerCase().replace('0x', '');
  return AP_ALLOWED_CALLS_PREFIX + '0000' + addr;
}

// ─── AllowedCalls encoding ────────────────────────────────────────────────────

/**
 * LSP6 AllowedCalls call type bits.
 * Stored as bytes4 in the first word of each 32-byte entry.
 */
export const CALL_TYPE = {
  /** Allow sending value (LYX) */
  VALUE: 0x00000001,
  /** Allow CALL */
  CALL: 0x00000002,
  /** Allow STATICCALL */
  STATICCALL: 0x00000004,
  /** Allow DELEGATECALL */
  DELEGATECALL: 0x00000008,
} as const;

/**
 * Wildcard values for standard interface and function selector.
 * 0xffffffff = any interface / any function.
 */
const WILDCARD = '0xffffffff';

/**
 * Build a single 32-byte AllowedCalls entry.
 * Format: bytes4(callTypes) + bytes20(address) + bytes4(standardId) + bytes4(selector)
 *
 * @param callTypes - OR'd CALL_TYPE bits
 * @param target    - destination address (without 0x prefix accepted)
 * @param standardId - LSP interface id or 0xffffffff for wildcard
 * @param selector   - function selector or 0xffffffff for wildcard
 */
export function buildAllowedCallEntry(
  callTypes: number,
  target: string,
  standardId: string = WILDCARD,
  selector: string = WILDCARD
): string {
  const callTypesHex = callTypes.toString(16).padStart(8, '0');
  const addrHex = target.toLowerCase().replace('0x', '').padStart(40, '0');
  const stdHex = standardId.replace('0x', '').padStart(8, '0');
  const selHex = selector.replace('0x', '').padStart(8, '0');
  return callTypesHex + addrHex + stdHex + selHex; // 32 bytes
}

/**
 * Encode a list of allowed targets as a CompactBytesArray for ERC725Y storage.
 * Each 32-byte entry is prefixed with its length (2 bytes = 0x0020).
 *
 * @param entries - array of 32-byte hex entries (without 0x, 64 chars each)
 */
export function encodeAllowedCallsValue(entries: string[]): string {
  if (entries.length === 0) return '0x';
  const encoded = entries
    .map((e) => {
      const raw = e.replace('0x', '');
      if (raw.length !== 64) throw new Error(`AllowedCalls entry must be 32 bytes, got ${raw.length / 2}`);
      return '0020' + raw; // 2-byte length prefix (0x0020 = 32)
    })
    .join('');
  return '0x' + encoded;
}

// ─── Mission permission compilation ──────────────────────────────────────────

export interface CompiledPermissions {
  /** bytes32 LSP6 permission bitmask */
  permBytes: string;
  /** Encoded CompactBytesArray for AllowedCalls ERC725Y storage */
  allowedCallsEncoded: string;
}

/**
 * Determine which call types to allow for a given mission type.
 */
function callTypesForMission(type: MissionType): number {
  switch (type) {
    case 'YIELD':
    case 'TREASURY_REBALANCE':
      // Can CALL and STATICCALL (read protocol state)
      return CALL_TYPE.CALL | CALL_TYPE.STATICCALL | CALL_TYPE.VALUE;
    default:
      // Payment-only missions: VALUE + CALL
      return CALL_TYPE.CALL | CALL_TYPE.VALUE;
  }
}

/**
 * Compile LSP6 permissions and AllowedCalls for a mission controller.
 *
 * @param type            - mission preset type
 * @param allowedTargets  - list of wallet/contract addresses this controller may call
 */
export function compileMission(
  type: MissionType,
  allowedTargets: string[]
): CompiledPermissions {
  const permBigInt = MISSION_PERMISSIONS[type];
  // Pad to 32 bytes (bytes32)
  const permBytes = '0x' + permBigInt.toString(16).padStart(64, '0');

  const callTypes = callTypesForMission(type);
  const entries = allowedTargets
    .map((addr) => ethers.isAddress(addr) ? addr : null)
    .filter((a): a is string => a !== null)
    .map((addr) => buildAllowedCallEntry(callTypes, addr));

  const allowedCallsEncoded = encodeAllowedCallsValue(entries);
  return { permBytes, allowedCallsEncoded };
}

// ─── ERC725Y setData payload builder ────────────────────────────────────────

export interface SetDataPayload {
  keys: string[];
  values: string[];
}

/**
 * Build the keys[] and values[] arrays for an ERC725Y setData call to
 * register a new controller on an AgentSafe vault.
 *
 * The owner must also read the current AddressPermissions[] length from-chain
 * so we know which array index slot to write to. Pass that length as
 * `existingControllerCount`.
 *
 * @param controllerAddress   - newly generated controller keypair address
 * @param compiled            - output of compileMission()
 * @param existingControllerCount - current length of AddressPermissions[] array
 */
export function buildSetDataPayload(
  controllerAddress: string,
  compiled: CompiledPermissions,
  existingControllerCount: number
): SetDataPayload {
  const keys: string[] = [];
  const values: string[] = [];

  // 1. Write controller into the AddressPermissions array at index N
  // Store as 20 bytes (abi.encodePacked(bytes20(controller))) per LSP6 spec
  keys.push(apArrayElementKey(existingControllerCount));
  values.push(controllerAddress.toLowerCase()); // raw 20-byte address

  // 2. Increment the AddressPermissions[] length  
  // Value is a 16-byte uint128 (LSP2 CompactByteArray length)
  const newLength = existingControllerCount + 1;
  keys.push(AP_ARRAY_KEY);
  values.push('0x' + newLength.toString(16).padStart(32, '0'));

  // 3. Write permission bitmask
  keys.push(apPermissionsKey(controllerAddress));
  values.push(compiled.permBytes);

  // 4. Write AllowedCalls (only if the controller has CALL without SUPER_CALL)
  if (compiled.allowedCallsEncoded !== '0x') {
    keys.push(apAllowedCallsKey(controllerAddress));
    values.push(compiled.allowedCallsEncoded);
  }

  return { keys, values };
}

/**
 * Build the setData payload to revoke a controller by zeroing its permissions.
 */
export function buildRevokePayload(controllerAddress: string): SetDataPayload {
  return {
    keys: [apPermissionsKey(controllerAddress)],
    values: ['0x' + '0'.repeat(64)], // 32 zero bytes
  };
}

// ─── Default policy config per mission type ───────────────────────────────────

export interface DefaultPolicyConfig {
  period: Period;
  budgetHint: number;
  merchantsRequired: boolean;
  expirationRequired: boolean;
}

/**
 * Return suggested policy parameters for the wizard form pre-population.
 */
export function getDefaultPolicyConfig(type: MissionType): DefaultPolicyConfig {
  const presets: Record<MissionType, DefaultPolicyConfig> = {
    VENDORS:             { period: 'DAILY',   budgetHint: 500,  merchantsRequired: true,  expirationRequired: false },
    SUBSCRIPTIONS:       { period: 'MONTHLY', budgetHint: 200,  merchantsRequired: true,  expirationRequired: false },
    YIELD:               { period: 'WEEKLY',  budgetHint: 1000, merchantsRequired: true,  expirationRequired: false },
    PAYROLL:             { period: 'MONTHLY', budgetHint: 5000, merchantsRequired: true,  expirationRequired: false },
    GRANTS:              { period: 'MONTHLY', budgetHint: 1000, merchantsRequired: true,  expirationRequired: true  },
    TREASURY_REBALANCE:  { period: 'WEEKLY',  budgetHint: 2000, merchantsRequired: true,  expirationRequired: false },
    TAX_RESERVE:         { period: 'MONTHLY', budgetHint: 300,  merchantsRequired: false, expirationRequired: false },
  };
  return presets[type];
}

/** Map period label to BudgetPolicy.Period enum value (uint8 in contracts) */
export function periodToUint8(period: Period): number {
  return period === 'DAILY' ? 0 : period === 'WEEKLY' ? 1 : 2;
}
