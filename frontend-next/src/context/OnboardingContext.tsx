'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { EntityType } from '@/lib/onboarding/entityData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingState {
  step: number;           // 0-4
  visible: boolean;
  completed: boolean;
  dismissed: boolean;
  // Step 0: entity type
  entityType: EntityType | null;
  // Step 1: profile within entity
  entityProfile: string | null;
  // Step 2: vault setup
  vaultName: string;
  vaultEmoji: string;
  selectedSubVaults: string[];   // sub-vault template ids the user toggled on
  // Step 3: budget
  rootBudget: string;
  budgetPeriod: 'daily' | 'weekly' | 'monthly';
}

interface OnboardingContextType extends OnboardingState {
  open: () => void;
  close: () => void;
  next: () => void;
  back: () => void;
  finish: () => void;
  dismissPermanently: () => void;
  setEntityType: (t: EntityType) => void;
  setEntityProfile: (id: string) => void;
  setVaultName: (s: string) => void;
  setVaultEmoji: (s: string) => void;
  toggleSubVault: (id: string) => void;
  setRootBudget: (s: string) => void;
  setBudgetPeriod: (p: 'daily' | 'weekly' | 'monthly') => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_COMPLETED = 'onboarding-completed';
const STORAGE_DISMISSED = 'onboarding-dismissed';
export const MAX_STEPS = 5;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated]           = useState(false);
  const [step, setStep]                   = useState(0);
  const [visible, setVisible]             = useState(false);
  const [completed, setCompleted]         = useState(false);
  const [dismissed, setDismissed]         = useState(false);

  const [entityType, setEntityTypeState]       = useState<EntityType | null>(null);
  const [entityProfile, setEntityProfileState] = useState<string | null>(null);
  const [vaultName, setVaultNameState]         = useState('');
  const [vaultEmoji, setVaultEmojiState]       = useState('💰');
  const [selectedSubVaults, setSelectedSubVaults] = useState<string[]>([]);
  const [rootBudget, setRootBudgetState]       = useState('1');
  const [budgetPeriod, setBudgetPeriodState]   = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    const isCompleted = localStorage.getItem(STORAGE_COMPLETED) === 'true';
    const isDismissed = localStorage.getItem(STORAGE_DISMISSED) === 'true';
    setCompleted(isCompleted);
    setDismissed(isDismissed);
    if (!isCompleted && !isDismissed) setVisible(true);
    setHydrated(true);
  }, []);

  const open = useCallback(() => {
    setVisible(true);
    setDismissed(false);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, MAX_STEPS - 1));
  }, []);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const finish = useCallback(() => {
    setCompleted(true);
    setVisible(false);
    localStorage.setItem(STORAGE_COMPLETED, 'true');
  }, []);

  const dismissPermanently = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    localStorage.setItem(STORAGE_DISMISSED, 'true');
  }, []);

  const setEntityType = useCallback((t: EntityType) => {
    setEntityTypeState(t);
    // Reset downstream selections when entity changes
    setEntityProfileState(null);
    setSelectedSubVaults([]);
    setVaultNameState('');
    setVaultEmojiState('💰');
  }, []);

  const setEntityProfile = useCallback((id: string) => {
    setEntityProfileState(id);
  }, []);

  const toggleSubVault = useCallback((id: string) => {
    setSelectedSubVaults((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const setVaultName    = useCallback((s: string) => setVaultNameState(s), []);
  const setVaultEmoji   = useCallback((s: string) => setVaultEmojiState(s), []);
  const setRootBudget   = useCallback((s: string) => setRootBudgetState(s), []);
  const setBudgetPeriod = useCallback((p: 'daily' | 'weekly' | 'monthly') => setBudgetPeriodState(p), []);

  return (
    <OnboardingContext.Provider
      value={{
        step, visible: hydrated && visible, completed, dismissed,
        entityType, entityProfile, vaultName, vaultEmoji,
        selectedSubVaults, rootBudget, budgetPeriod,
        open, close, next, back, finish, dismissPermanently,
        setEntityType, setEntityProfile, setVaultName, setVaultEmoji,
        toggleSubVault, setRootBudget, setBudgetPeriod,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
