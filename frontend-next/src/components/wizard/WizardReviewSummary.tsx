'use client';

import React from 'react';
import { useI18n } from '@/context/I18nContext';
import type { GoalKey, ExecutorType, SafetyLevel, FrequencyKey, RecipientEntry } from '@/context/OnboardingContext';

interface WizardReviewSummaryProps {
  goal: GoalKey | null;
  recipients: RecipientEntry[];
  maxPerTx: string;
  frequency: FrequencyKey;
  agentEnabled: boolean;
  executor: ExecutorType;
  safetyLevel: SafetyLevel;
}

export function WizardReviewSummary({
  goal,
  recipients,
  maxPerTx,
  frequency,
  agentEnabled,
  executor,
  safetyLevel,
}: WizardReviewSummaryProps) {
  const { t } = useI18n();

  const amount = maxPerTx ? maxPerTx : '—';
  const count  = recipients.length;
  const isManual = !agentEnabled;

  const freqLabel = t(`wizard.limits.freq.${frequency}` as Parameters<typeof t>[0]).toLowerCase();
  const executorLabel = isManual
    ? t('wizard.automation.executor.manual_state')
    : executor === 'vaultia'
    ? t('wizard.automation.executor.vaultia')
    : executor === 'my_agent'
      ? t('wizard.automation.executor.my_agent')
      : t('wizard.automation.executor.me');

  // Build human-readable summary
  const summary = !isManual
    ? t('wizard.review.summary')
        .replace('{amount}', amount)
        .replace('{count}', String(count || '—'))
        .replace('{period}', freqLabel)
    : t('wizard.review.summary_manual')
        .replace('{amount}', amount)
        .replace('{period}', freqLabel);

    const recipientPreview = count > 0
      ? recipients
          .slice(0, 2)
          .map((recipient) => recipient.label || `${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`)
          .join(', ')
      : '—';

  const rows: { label: string; value: string }[] = [
    { label: t('wizard.review.goal'),       value: goal ? t(`wizard.goal.${goal}` as Parameters<typeof t>[0]) : '—' },
      { label: t('wizard.review.recipients'), value: count > 0 ? `${recipientPreview}${count > 2 ? ` +${count - 2}` : ''}` : '—' },
    { label: t('wizard.review.max_per_tx'), value: amount },
    { label: t('wizard.review.frequency'),  value: freqLabel },
    { label: t('wizard.review.executor'),   value: executorLabel },
    ...(!isManual ? [{ label: t('wizard.review.safety'), value: t(`wizard.automation.safety.${safetyLevel}` as Parameters<typeof t>[0]) }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Natural-language summary */}
      <p
        className="text-base font-medium text-center px-2 leading-relaxed"
        style={{ color: 'var(--text)' }}
      >
        {summary}
      </p>

      {/* Detail rows */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-2.5 text-sm"
            style={{
              background: i % 2 === 0 ? 'var(--card)' : 'var(--card-mid)',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
