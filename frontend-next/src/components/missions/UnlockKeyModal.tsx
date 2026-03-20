'use client';

import { useState } from 'react';
import { Button } from '@/components/common/Button';
import { useI18n } from '@/context/I18nContext';

interface UnlockKeyModalProps {
  missionLabel: string;
  onUnlock: (passphrase: string) => Promise<boolean>;
  onCancel: () => void;
  error?: string | null;
  unlocking?: boolean;
}

export function UnlockKeyModal({
  missionLabel,
  onUnlock,
  onCancel,
  error,
  unlocking,
}: UnlockKeyModalProps) {
  const { t } = useI18n();
  const [passphrase, setPassphrase] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    await onUnlock(passphrase);
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            🔑 {t('missions.unlock_title')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('missions.unlock_desc')}
          </p>
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded px-2 py-1 w-fit">
            {missionLabel}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('missions.create.passphrase_label')}
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('missions.unlock_placeholder')}
              autoFocus
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Trust copy */}
          <p className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
            <span>🔒</span>
            <span>{t('missions.trust_copy')}</span>
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={onCancel}
              disabled={unlocking}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={!passphrase.trim() || unlocking}
            >
              {unlocking ? '…' : t('missions.unlock_cta')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
