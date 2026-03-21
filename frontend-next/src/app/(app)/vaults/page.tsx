'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useWeb3 } from '@/context/Web3Context';
import { useVaults } from '@/hooks/useVaults';
import { useVault } from '@/hooks/useVault';
import { useBaseVaults, BaseVaultSummary } from '@/hooks/useBaseVaults';
import { isBaseFactoryConfigured } from '@/lib/web3/baseContracts';
import { Skeleton, SkeletonCard } from '@/components/common/Skeleton';
import { Alert, AlertDescription } from '@/components/common/Alert';
import { useI18n } from '@/context/I18nContext';
import { AddAgentModal, VaultRef } from '@/components/agents/AddAgentModal';
import { ethers } from 'ethers';

// ─── Spend bar ────────────────────────────────────────────────────────────────

function SpendBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const ratio = total > 0 ? spent / total : 0;
  const barColor = ratio >= 1 ? 'var(--blocked)' : ratio >= 0.85 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--card-mid)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        <span style={ratio >= 1 ? { color: 'var(--blocked)', fontWeight: 500 } : undefined}>
          {spent} LYX spent
        </span>
        <span>{total} LYX</span>
      </div>
    </div>
  );
}

// ─── Vault card ───────────────────────────────────────────────────────────────

function VaultCard({
  vault,
  signer,
  onAddAgent,
}: {
  vault: { safe: string; keyManager: string; policyEngine: string; label: string };
  signer: ethers.Signer | null;
  onAddAgent: (ref: VaultRef) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { detail, loading } = useVault(expanded ? vault.safe : null);
  const { t } = useI18n();
  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  const spent  = detail ? parseFloat(detail.policySummary.spent ?? '0') : 0;
  const budget = detail?.policySummary.budget ? parseFloat(detail.policySummary.budget) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{vault.label || 'Unnamed Vault'}</CardTitle>
            <CardDescription className="font-mono text-xs mt-xs">{short(vault.safe)}</CardDescription>
          </div>
          <Badge variant="success">{t('common.active')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-md">
        {loading && (
          <div className="space-y-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}

        {detail && (
          <>
            <div className="flex items-end justify-between gap-sm">
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  {t('vaults.card.balance')}
                </p>
                <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  {detail.balance}
                  <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>LYX</span>
                </p>
              </div>
              {detail.policySummary.expiration && detail.policySummary.expiration !== '0' && (
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('vaults.card.expires')}</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    {new Date(Number(detail.policySummary.expiration) * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            {detail.policySummary.budget && <SpendBar spent={spent} total={budget} />}
          </>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`vault-details-${vault.safe}`}
          className="text-xs text-left hover:underline"
          style={{ color: 'var(--primary)' }}
        >
          {expanded ? t('vaults.card.hide_details') : t('vaults.card.show_details')}
        </button>

        {expanded && detail && (
          <div
            id={`vault-details-${vault.safe}`}
            className="space-y-xs text-xs font-mono pt-md"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
          >
            <p><span className="font-sans font-medium">{t('vaults.card.key_manager')}:</span> {short(detail.keyManager)}</p>
            <p><span className="font-sans font-medium">{t('vaults.card.policy_engine')}:</span> {short(detail.policyEngine)}</p>
            {detail.policySummary.merchants?.length ? (
              <p><span className="font-sans font-medium">{t('vaults.card.merchants')}:</span> {detail.policySummary.merchants.length} {t('vaults.card.whitelisted')}</p>
            ) : (
              <p><span className="font-sans font-medium">{t('vaults.card.merchants')}:</span> {t('vaults.card.no_restriction')}</p>
            )}
            {!!detail.policySummary.warnings?.length && (
              <Alert variant="warning" className="mt-sm font-sans">
                <AlertDescription>{detail.policySummary.warnings.join(' ')}</AlertDescription>
              </Alert>
            )}
            {signer && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-sm font-sans"
                onClick={() =>
                  onAddAgent({
                    chain: 'lukso',
                    vaultSafe: vault.safe,
                    keyManager: vault.keyManager,
                    label: vault.label,
                    signer,
                  })
                }
              >
                {t('vaults.card.manage_agents')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Base vault card ──────────────────────────────────────────────────────────

function BaseVaultCard({
  vault,
  onAddAgent,
}: {
  vault: BaseVaultSummary;
  onAddAgent: (ref: VaultRef) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();
  const short = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  return (
    <Card className="flex flex-col" style={{ border: '1px solid rgba(60,242,255,0.25)' }}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{vault.label || 'Unnamed Vault'}</CardTitle>
            <CardDescription className="font-mono text-xs mt-xs">{short(vault.vault)}</CardDescription>
          </div>
          <div className="flex gap-xs">
            <Badge variant="primary">{t('vaults.base.chain_badge')}</Badge>
            <Badge variant="success">{t('common.active')}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-md">
        <div className="flex items-center gap-sm">
          <span className="text-xl">{vault.tokenEmoji}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{vault.tokenSymbol}</span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{short(vault.token)}</span>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-xs hover:underline text-left"
          style={{ color: 'var(--primary)' }}
        >
          {expanded ? t('vaults.card.hide_details') : t('vaults.card.show_details')}
        </button>

        {expanded && (
          <div
            className="space-y-xs text-xs font-mono pt-md"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
          >
            <p><span className="font-sans font-medium">{t('vaults.card.policy_engine')}:</span> {short(vault.policyEngine)}</p>
            <p><span className="font-sans font-medium">Vault:</span> {vault.vault}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-sm font-sans"
              onClick={() =>
                onAddAgent({
                  chain: 'base',
                  vaultAddress: vault.vault,
                  label: vault.label,
                })
              }
            >
              {t('vaults.card.manage_agents')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VaultsPage() {
  const { registry, account, isConnected, signer } = useWeb3();
  const { vaults, loading, error, refresh: refreshVaults } = useVaults(registry, account);
  const { vaults: baseVaults, loading: baseLoading, error: baseError, refresh: refreshBase } = useBaseVaults(account);
  const { t } = useI18n();
  const [agentModalVault, setAgentModalVault] = useState<VaultRef | null>(null);

  const handleRefreshAll = () => { refreshVaults(); refreshBase(); };

  return (
    <div className="space-y-lg">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{t('vaults.title')}</h1>
          <p className="mt-xs" style={{ color: 'var(--text-muted)' }}>{t('vaults.subtitle')}</p>
        </div>
        <div className="flex gap-sm">
          <Button variant="secondary" size="sm" onClick={handleRefreshAll} disabled={loading || baseLoading}>
            {(loading || baseLoading) ? '…' : t('common.refresh')}
          </Button>
          <Link href="/vaults/create">
            <Button>{t('vaults.create')}</Button>
          </Link>
        </div>
      </div>

      {isConnected && !loading && vaults.length > 0 && (
        <div className="grid grid-cols-3 gap-md">
          {[
            { emoji: '🏦', label: t('vaults.stats.total'),   value: String(vaults.length) },
            { emoji: '✅', label: t('vaults.stats.active'),  value: String(vaults.length) },
            { emoji: '🤖', label: t('vaults.stats.network'), value: 'LUKSO' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <span className="text-2xl">{s.emoji}</span>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isConnected && (
        <Alert variant="info"><AlertDescription>{t('vaults.connect_prompt')}</AlertDescription></Alert>
      )}

      {isConnected && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <SkeletonCard /><SkeletonCard />
        </div>
      )}

      {isConnected && error && (
        <Card><CardContent><p className="text-sm" style={{ color: 'var(--blocked)' }}>Error: {error}</p></CardContent></Card>
      )}

      {isConnected && !loading && !error && vaults.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('vaults.empty.title')}</CardTitle>
            <CardDescription>{t('vaults.empty.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-md" style={{ color: 'var(--text-muted)' }}>{t('vaults.empty.description')}</p>
            <Link href="/vaults/create">
              <Button variant="primary">{t('vaults.empty.cta')}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {vaults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {vaults.map((vault) => (
            <VaultCard
              key={vault.safe}
              vault={vault}
              signer={signer}
              onAddAgent={setAgentModalVault}
            />
          ))}
        </div>
      )}

      {isConnected && isBaseFactoryConfigured() && (
        <div className="space-y-md">
          <div className="pt-lg" style={{ borderTop: '1px solid var(--border)' }}>
            <h2 className="text-xl font-bold flex items-center gap-sm" style={{ color: 'var(--text)' }}>
              <span className="text-2xl">🔵</span>
              {t('vaults.base.section_title')}
            </h2>
            <p className="text-sm mt-xs" style={{ color: 'var(--text-muted)' }}>{t('vaults.base.section_subtitle')}</p>
          </div>

          {baseLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <SkeletonCard /><SkeletonCard />
            </div>
          )}
          {baseError && (
            <Card><CardContent><p className="text-sm" style={{ color: 'var(--blocked)' }}>Error: {baseError}</p></CardContent></Card>
          )}
          {!baseLoading && !baseError && baseVaults.length === 0 && (
            <Card>
              <CardContent>
                <p className="text-sm py-sm" style={{ color: 'var(--text-muted)' }}>{t('vaults.base.empty')}</p>
              </CardContent>
            </Card>
          )}
          {baseVaults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {baseVaults.map((vault) => (
                <BaseVaultCard
                  key={vault.vault}
                  vault={vault}
                  onAddAgent={setAgentModalVault}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AddAgentModal
        vault={agentModalVault}
        open={agentModalVault !== null}
        onClose={() => setAgentModalVault(null)}
        onSuccess={() => { handleRefreshAll(); setAgentModalVault(null); }}
      />
    </div>
  );
}
