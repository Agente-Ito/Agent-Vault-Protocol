/**
 * Mission metadata store — persisted in IndexedDB.
 *
 * On-chain truth (permissions) lives in the LSP6KeyManager / ERC725Y storage.
 * This store holds UX metadata: label, type, created date, local status flag.
 *
 * Status reconciliation:
 *  - Read AddressPermissions:Permissions:<controller> from vault's ERC725Y
 *  - If value is 0x0 → status is 'revoked' regardless of local flag
 */

export type MissionStatus = 'active' | 'paused' | 'revoked' | 'error';

export interface MissionRecord {
  id: string;
  /** Human-readable mission label */
  label: string;
  type: string; // MissionType — stored as string for IndexedDB serialisability
  /** Controller public address (safe to display) */
  controllerAddress: string;
  /** AgentSafe vault address this mission belongs to */
  vaultSafe: string;
  /** Local status (on-chain revocation overrides this) */
  status: MissionStatus;
  createdAt: number; // Unix ms
  /** Optional: vault label for display */
  vaultLabel?: string;
}

// ─── IndexedDB persistence ────────────────────────────────────────────────────

const DB_NAME = 'vaultia-missions';
const DB_VERSION = 1;
const STORE_NAME = 'missions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('vaultSafe', 'vaultSafe', { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMission(record: MissionRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMission(id: string): Promise<MissionRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMissions(): Promise<MissionRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateMissionStatus(id: string, status: MissionStatus): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record: MissionRecord | undefined = req.result;
      if (record) store.put({ ...record, status });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMission(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Generate a stable mission ID from vault + controller address */
export function makeMissionId(vaultSafe: string, controllerAddress: string): string {
  return `${vaultSafe.toLowerCase()}_${controllerAddress.toLowerCase()}`;
}
