'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ethers } from 'ethers';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/common/Alert';
import { useWeb3 } from '@/context/Web3Context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAddressList(value: string, fieldName: string) {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!ethers.isAddress(entry)) {
        throw new Error(`${fieldName} contains an invalid address: ${entry}`);
      }
      const normalized = ethers.getAddress(entry);
      if (seen.has(normalized)) {
        throw new Error(`${fieldName} contains a duplicate address: ${normalized}`);
      }
      seen.add(normalized);
      return normalized;
    });
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const e = error as { reason?: unknown; message?: unknown };
    if (typeof e.reason === 'string' && e.reason) return e.reason;
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return String(error);
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string;
  budget: string;
  period: string;
  hasExpiry: boolean;
  expiryDate: string;
  agents: string;
  merchants: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'allowance',
    name: 'Weekly Allowance',
    description: 'Personal spending wallet that resets every week',
    budget: '1',
    period: '1',
    hasExpiry: false,
    expiryDate: '',
    agents: '',
    merchants: '',
  },
  {
    id: 'defi',
    name: 'DeFi Agent',
    description: 'Monthly budget for an AI trading or automation agent',
    budget: '5',
    period: '2',
    hasExpiry: false,
    expiryDate: '',
    agents: '',
    merchants: '',
  },
  {
    id: 'subscription',
    name: 'Subscription Service',
    description: 'Monthly payments to a fixed set of merchant addresses',
    budget: '10',
    period: '2',
    hasExpiry: false,
    expiryDate: '',
    agents: '',
    merchants: '',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Configure everything from scratch',
    budget: '0.5',
    period: '1',
    hasExpiry: false,
    expiryDate: '',
    agents: '',
    merchants: '',
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Basics', 'Rules', 'Agents'];
  return (
    <div className="flex items-center gap-xs">
      {labels.map((label, i) => {
        const num = i + 1;
        const active = num === current;
        const done = num < current;
        return (
          <div key={label} className="flex items-center gap-xs">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                active
                  ? 'bg-primary text-white'
                  : done
                  ? 'bg-success text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
              }`}
            >
              {done ? '✓' : num}
            </div>
            <span
              className={`text-xs ${
                active ? 'font-medium text-neutral-900 dark:text-neutral-50' : 'text-neutral-500'
              }`}
            >
              {label}
            </span>
            {i < total - 1 && (
              <div className="w-6 h-px bg-neutral-200 dark:bg-neutral-700 mx-xs" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateVaultPage() {
  const router = useRouter();
  const { registry, signer, isConnected, isRegistryConfigured } = useWeb3();

  // Form state
  const [label, setLabel] = useState('My Vault');
  const [budget, setBudget] = useState('0.5');
  const [period, setPeriod] = useState('1');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [agents, setAgents] = useState('');
  const [usePerAgentBudgets, setUsePerAgentBudgets] = useState(false);
  const [agentBudgetMap, setAgentBudgetMap] = useState<Record<string, string>>({});
  const [merchants, setMerchants] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState<{
    safe: string;
    keyManager: string;
    policyEngine: string;
  } | null>(null);

  // Wizard step: 1 = basics, 2 = rules, 3 = agents
  const [step, setStep] = useState(1);

  const applyTemplate = (t: Template) => {
    setBudget(t.budget);
    setPeriod(t.period);
    setHasExpiry(t.hasExpiry);
    setExpiryDate(t.expiryDate);
    setAgents(t.agents);
    setMerchants(t.merchants);
    setUsePerAgentBudgets(false);
    setAgentBudgetMap({});
    setStep(1);
  };

  // Raw agent list for rendering per-agent budget inputs
  const rawAgentList = agents.split(',').map((a) => a.trim()).filter(Boolean);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bug #1 fix: separate check for registry (env var) vs signer (wallet connection)
    if (!isRegistryConfigured) {
      setStatus('Error: Registry address not configured. Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local.');
      return;
    }
    if (!registry || !signer) {
      setStatus('Error: Connect your wallet first.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      const owner = await signer.getAddress();
      const existingVaults = await registry.getVaults(owner);
      const existingSafeAddresses = new Set(
        existingVaults.map((vault) => vault.safe.toLowerCase())
      );

      const agentList = parseAddressList(agents, 'Agents');
      const merchantList = parseAddressList(merchants, 'Merchant whitelist');
      const expirationUnix =
        hasExpiry && expiryDate
          ? BigInt(Math.floor(new Date(expiryDate).getTime() / 1000))
          : BigInt(0);

      if (
        hasExpiry &&
        expiryDate &&
        expirationUnix <= BigInt(Math.floor(Date.now() / 1000))
      ) {
        throw new Error('Expiration date must be in the future.');
      }

      // Bug #2 fix: agentList entries are already checksummed via ethers.getAddress()
      // agentBudgetMap is also keyed by checksummed address (normalized on input), so lookup matches.
      const agentBudgetsList =
        usePerAgentBudgets && agentList.length > 0
          ? agentList.map((agentAddress) => {
              const configuredBudget = agentBudgetMap[agentAddress];
              if (!configuredBudget) {
                throw new Error(`Missing budget for agent ${agentAddress}.`);
              }
              return ethers.parseEther(configuredBudget);
            })
          : [];

      if (
        usePerAgentBudgets &&
        agentBudgetsList.length !== agentList.length
      ) {
        throw new Error(
          'Every agent must have an individual budget before deployment.'
        );
      }

      setStatus('Sending transaction…');
      const tx = await registry.deployVault({
        budget: ethers.parseEther(budget),
        period: Number(period),
        budgetToken: ethers.ZeroAddress,
        expiration: expirationUnix,
        agents: agentList,
        agentBudgets: agentBudgetsList,
        merchants: merchantList,
        label,
      });

      setStatus('Waiting for confirmation…');
      const receipt = await tx.wait();
      if (!receipt) throw new Error('Transaction receipt not available');

      const iface = registry.interface;
      let safeAddr = '';
      let kmAddr = '';
      let peAddr = '';
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'VaultDeployed') {
            safeAddr = parsed.args.safe;
            kmAddr = parsed.args.keyManager;
            peAddr = parsed.args.policyEngine;
          }
        } catch {
          /* ignore unrelated logs */
        }
      }

      if (!safeAddr) {
        const latestVaults = await registry.getVaults(owner);
        const createdVault =
          latestVaults.find(
            (vault) =>
              !existingSafeAddresses.has(vault.safe.toLowerCase()) &&
              vault.label === label
          ) ??
          latestVaults.find(
            (vault) => !existingSafeAddresses.has(vault.safe.toLowerCase())
          );

        if (createdVault) {
          safeAddr = createdVault.safe;
          kmAddr = createdVault.keyManager;
          peAddr = createdVault.policyEngine;
        }
      }

      if (!safeAddr) {
        setStatus(
          `Vault deployed (tx: ${receipt.hash}), but deployed addresses could not be recovered. Check the explorer or refresh your vault list.`
        );
      } else {
        setDeployed({ safe: safeAddr, keyManager: kmAddr, policyEngine: peAddr });
        setStatus('Vault deployed!');
      }
    } catch (err: unknown) {
      setStatus('Error: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Deployed success screen ─────────────────────────────────────────────────
  if (deployed) {
    return (
      <div className="space-y-lg max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Vault Deployed!
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-xs">
            Your vault is live on-chain.
          </p>
        </div>

        <Alert variant="success">
          <AlertTitle>One more step — accept ownership</AlertTitle>
          <AlertDescription>
            The vault uses LSP14 two-step ownership. Call{' '}
            <code className="font-mono text-xs bg-neutral-100 dark:bg-neutral-700 px-1 rounded">
              acceptOwnership()
            </code>{' '}
            on the Safe and PolicyEngine contracts to finalize the ownership
            transfer.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent>
            <div className="space-y-md text-sm font-mono">
              {[
                { label: 'Safe', value: deployed.safe },
                { label: 'KeyManager', value: deployed.keyManager },
                { label: 'PolicyEngine', value: deployed.policyEngine },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-neutral-500 dark:text-neutral-400 font-sans text-xs uppercase tracking-wide mb-xs">
                    {label}
                  </p>
                  <p className="text-neutral-900 dark:text-neutral-100 break-all">
                    {value || '—'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-md">
          <Button variant="primary" onClick={() => router.push('/vaults')}>
            View My Vaults
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDeployed(null);
              setStatus('');
              setStep(1);
            }}
          >
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  // ── Wizard form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-lg max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          Create Vault
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-xs">
          Deploy a new financial vault with spending rules on LUKSO.
        </p>
      </div>

      {/* Bug #1 fix: show registry-not-configured alert separately from wallet alert */}
      {!isRegistryConfigured && (
        <Alert variant="warning">
          <AlertTitle>Registry not configured</AlertTitle>
          <AlertDescription>
            Set{' '}
            <code className="font-mono text-xs bg-neutral-100 dark:bg-neutral-700 px-1 rounded">
              NEXT_PUBLIC_REGISTRY_ADDRESS
            </code>{' '}
            in your{' '}
            <code className="font-mono text-xs bg-neutral-100 dark:bg-neutral-700 px-1 rounded">
              .env.local
            </code>{' '}
            to deploy vaults.
          </AlertDescription>
        </Alert>
      )}

      {isRegistryConfigured && !isConnected && (
        <Alert variant="warning">
          <AlertTitle>Wallet not connected</AlertTitle>
          <AlertDescription>
            Connect your wallet before deploying a vault.
          </AlertDescription>
        </Alert>
      )}

      <StepIndicator current={step} total={3} />

      {/* ── Step 1: Basics ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-md">
          {/* Template picker */}
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-sm">
              Start from a template
            </p>
            <div className="grid grid-cols-2 gap-sm">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="text-left p-md rounded-md border border-neutral-200 dark:border-neutral-700 hover:border-primary dark:hover:border-primary transition-colors"
                >
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                    {t.name}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-xs">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vault basics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                <div>
                  <label className="label">Vault Label</label>
                  <input
                    className="input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Groceries Vault"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="label">Budget (LYX)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Budget Period</label>
                    <select
                      className="input"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="0">Daily</option>
                      <option value="1">Weekly</option>
                      <option value="2">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-sm">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setStep(2)}
                    disabled={!label || !budget}
                  >
                    Next: Rules
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Protection Rules ─────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Protection rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Optional. Leave both empty for a basic vault with no extra restrictions.
              </p>

              <div className="space-y-sm">
                <label className="flex items-center gap-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExpiry}
                    onChange={(e) => setHasExpiry(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Set expiration date
                  </span>
                </label>
                {hasExpiry && (
                  <div>
                    <label htmlFor="expiry-date" className="label">
                      Expiration date
                    </label>
                    <input
                      id="expiry-date"
                      className="input"
                      type="datetime-local"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="label">Merchant Whitelist (optional)</label>
                <input
                  className="input"
                  value={merchants}
                  onChange={(e) => setMerchants(e.target.value)}
                  placeholder="0xabcd…, 0xef01… (comma-separated)"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-xs">
                  Leave empty to allow payments to any address
                </p>
              </div>

              <div className="flex justify-between pt-sm">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <div className="flex gap-sm">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setHasExpiry(false);
                      setExpiryDate('');
                      setMerchants('');
                      setStep(3);
                    }}
                  >
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setStep(3)}
                  >
                    Next: Agents
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Agents ───────────────────────────────────────────────────── */}
      {step === 3 && (
        <form onSubmit={onSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-md">
                <Alert variant="info">
                  <AlertDescription>
                    Agents are wallets or contracts authorized to spend from this vault — for example, an AI
                    automation script or a DeFi bot. Leave empty if you plan to control the vault directly.{' '}
                    <Link
                      href="/agents"
                      className="underline font-medium"
                    >
                      Browse registered agents
                    </Link>
                  </AlertDescription>
                </Alert>

                <div>
                  <label className="label">Agent Addresses (optional)</label>
                  <input
                    className="input"
                    value={agents}
                    onChange={(e) => {
                      setAgents(e.target.value);
                      // Reset per-agent budget map when agent list changes
                      setAgentBudgetMap({});
                    }}
                    placeholder="0x1234…, 0x5678… (comma-separated)"
                  />
                </div>

                {rawAgentList.length > 0 && (
                  <div className="space-y-sm">
                    <label className="flex items-center gap-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePerAgentBudgets}
                        onChange={(e) => setUsePerAgentBudgets(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Set per-agent spending limits
                      </span>
                    </label>
                    {usePerAgentBudgets && (
                      <div className="space-y-xs pl-md border-l-2 border-neutral-200 dark:border-neutral-700">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Each agent will have an individual limit in addition to the vault budget.
                        </p>
                        {rawAgentList.map((addr) => {
                          // Bug #2 fix: normalize key to checksummed address so it matches agentList at submit
                          const normalizedKey = ethers.isAddress(addr)
                            ? ethers.getAddress(addr)
                            : addr;
                          return (
                            <div key={addr} className="flex items-center gap-sm">
                              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 w-36 truncate">
                                {addr.slice(0, 10)}…{addr.slice(-6)}
                              </span>
                              <input
                                className="input text-sm"
                                type="number"
                                step="0.0001"
                                min="0"
                                placeholder="Budget (LYX)"
                                value={agentBudgetMap[normalizedKey] ?? ''}
                                onChange={(e) =>
                                  setAgentBudgetMap((prev) => ({
                                    ...prev,
                                    [normalizedKey]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-sm">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <div className="flex gap-sm">
                    {agents.trim() === '' && (
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={loading || !isConnected || !isRegistryConfigured}
                      >
                        {loading ? 'Deploying…' : 'Skip & Deploy'}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading || !isConnected || !isRegistryConfigured}
                    >
                      {loading ? 'Deploying…' : 'Deploy Vault'}
                    </Button>
                  </div>
                </div>

                {status && (
                  <Alert variant={status.startsWith('Error') ? 'error' : 'info'}>
                    <AlertDescription>{status}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
