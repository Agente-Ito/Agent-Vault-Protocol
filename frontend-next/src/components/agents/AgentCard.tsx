'use client';

import React from 'react';
import { Badge } from '@/components/common/Badge';
import { useI18n } from '@/context/I18nContext';
import type { AgentRecord } from './types';

interface AgentCardProps {
  agent: AgentRecord;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const { t } = useI18n();

  return (
    <div
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{agent.address.slice(0, 8)}…{agent.address.slice(-6)}</h3>
            <p className="text-xs text-neutral-500 font-mono break-all">{agent.address}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant={agent.isContract ? 'warning' : 'neutral'}>
            {agent.isContract ? t('agents.badge.contract') : t('agents.badge.eoa')}
          </Badge>
          <Badge variant={agent.allowedAutomation ? 'success' : 'neutral'}>
            {agent.allowedAutomation ? t('agents.badge.auto') : t('agents.card.automation_disabled')}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {agent.roles.map((r) => (
          <span
            key={r}
            className="text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded-full"
          >
            {r}
          </span>
        ))}
        {agent.roles.length === 0 && (
          <span className="text-xs text-neutral-400">{t('agents.card.no_roles')}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2">
          <p className="text-xs text-neutral-500">{t('agents.card.automation')}</p>
          <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">
            {agent.allowedAutomation ? t('agents.card.automation_enabled') : t('agents.card.automation_disabled')}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2">
          <p className="text-xs text-neutral-500">{t('agents.card.max_gas')}</p>
          <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">
            {agent.maxGasPerCall > 0 ? agent.maxGasPerCall.toLocaleString() : '0'}
          </p>
        </div>
      </div>
    </div>
  );
}
