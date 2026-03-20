'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { loadKey, decryptKey } from '@/lib/crypto/keyStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseControllerKeyState {
  /** True if the key is decrypted and available in memory */
  isUnlocked: boolean;
  /** Controller address (public key — safe to display at all times) */
  controllerAddress: string | null;
  /** Whether a key is stored for this mission (regardless of unlock state) */
  hasStoredKey: boolean;
  /** Error message from last unlock attempt */
  unlockError: string | null;
  /** True while the decrypt operation is running */
  unlocking: boolean;
}

interface UseControllerKeyActions {
  /**
   * Decrypt the stored key for this mission with the given passphrase.
   * On success, the Wallet is held in a ref (never in React state).
   */
  unlock: (passphrase: string) => Promise<boolean>;
  /** Zero the in-memory key and reset unlock state. */
  lock: () => void;
  /**
   * Sign and send a transaction using the unlocked controller wallet connected
   * to the provided provider.
   */
  getWallet: (provider: ethers.Provider) => ethers.Wallet | null;
}

/** Auto-lock timeout in milliseconds (15 minutes) */
const AUTO_LOCK_MS = 15 * 60 * 1000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of a per-mission controller private key.
 *
 * Security model:
 *  - Private key lives ONLY in a ref (not React state, not localStorage)
 *  - Auto-locks after AUTO_LOCK_MS of inactivity
 *  - Auto-locks on window blur / tab visibility change
 *  - Wallet ref is zeroed on lock (not just nulled)
 */
export function useControllerKey(missionId: string | null): UseControllerKeyState & UseControllerKeyActions {
  const walletRef = useRef<ethers.Wallet | null>(null);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<UseControllerKeyState>({
    isUnlocked: false,
    controllerAddress: null,
    hasStoredKey: false,
    unlockError: null,
    unlocking: false,
  });

  // ── Check whether a stored key exists for this mission ──
  useEffect(() => {
    if (!missionId) {
      setState((s) => ({ ...s, hasStoredKey: false, controllerAddress: null }));
      return;
    }
    loadKey(missionId).then((entry) => {
      setState((s) => ({
        ...s,
        hasStoredKey: !!entry,
        controllerAddress: entry?.controllerAddress ?? null,
      }));
    });
  }, [missionId]);

  // ── Reset auto-lock timer on each user interaction ──
  const resetTimer = useCallback(() => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    autoLockTimer.current = setTimeout(() => lock(), AUTO_LOCK_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-lock on tab visibility change ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && walletRef.current) lock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      walletRef.current = null;
    };
  }, []);

  // ── Lock ──────────────────────────────────────────────────────────────────
  const lock = useCallback(() => {
    walletRef.current = null;
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    setState((s) => ({
      ...s,
      isUnlocked: false,
      unlockError: null,
    }));
  }, []);

  // ── Unlock ────────────────────────────────────────────────────────────────
  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!missionId) return false;
    setState((s) => ({ ...s, unlocking: true, unlockError: null }));
    try {
      const entry = await loadKey(missionId);
      if (!entry) throw new Error('No key stored for this mission.');
      const privateKey = await decryptKey(entry.blob, passphrase);
      walletRef.current = new ethers.Wallet(privateKey);
      setState((s) => ({
        ...s,
        isUnlocked: true,
        unlocking: false,
        controllerAddress: walletRef.current!.address,
        unlockError: null,
      }));
      resetTimer();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unlock failed.';
      setState((s) => ({ ...s, unlocking: false, unlockError: msg }));
      return false;
    }
  }, [missionId, resetTimer]);

  // ── Get connected wallet ──────────────────────────────────────────────────
  const getWallet = useCallback(
    (provider: ethers.Provider): ethers.Wallet | null => {
      if (!walletRef.current) return null;
      resetTimer();
      return walletRef.current.connect(provider);
    },
    [resetTimer]
  );

  return { ...state, unlock, lock, getWallet };
}
