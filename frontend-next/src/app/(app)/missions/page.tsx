'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { useI18n } from '@/context/I18nContext';
import { useMissions } from '@/hooks/useMissions';
import { useWeb3 } from '@/context/Web3Context';
import { MissionCard } from '@/components/missions/MissionCard';
import { Skeleton } from '@/components/common/Skeleton';
import { Alert, AlertDescription } from '@/components/common/Alert';

export default function MissionsPage() {
  const { t } = useI18n();
  const { account } = useWeb3();
  const { missions, loading, error, reload } = useMissions(account);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            🎯 {t('missions.page_title')}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('missions.page_desc')}
          </p>
        </div>
        <Link href="/missions/create">
          <Button variant="primary" size="md">
            + {t('missions.create_cta')}
          </Button>
        </Link>
      </div>

      {/* Trust copy */}
      <p className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
        <span>🔒</span>
        <span>{t('missions.trust_copy')}</span>
      </p>

      {/* Error */}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && missions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <span className="text-6xl">🎯</span>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {t('missions.empty_title')}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
              {t('missions.empty_desc')}
            </p>
          </div>
          <Link href="/missions/create">
            <Button variant="primary">{t('missions.create_cta')}</Button>
          </Link>
        </div>
      )}

      {/* Mission list */}
      {!loading && missions.length > 0 && (
        <div className="space-y-4">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} onUpdate={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
