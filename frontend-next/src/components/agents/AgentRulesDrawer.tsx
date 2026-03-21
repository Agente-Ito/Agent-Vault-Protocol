'use client';

import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/common/Button';
import { Alert, AlertDescription } from '@/components/common/Alert';
import { useAssignRole } from '@/hooks/useAssignRole';
import type { AgentRecord } from './types';

interface AgentRulesDrawerProps {
  agent: AgentRecord | null;
  open: boolean;
  onClose: () => void;
  isRoleAdmin?: boolean;
}

export function AgentRulesDrawer({ agent, open, onClose, isRoleAdmin }: AgentRulesDrawerProps) {
  const assignRole = useAssignRole();
  const [roleName, setRoleName] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!agent) return null;

  const handleAssignRole = async () => {
    setFeedback(null);
    try {
      await assignRole.mutateAsync({
        agent: agent.address,
        role: roleName,
        capabilities: capabilities.split(',').map((c) => c.trim()).filter(Boolean),
      });
      setFeedback({ ok: true, msg: `Role "${roleName}" assigned successfully.` });
      setRoleName('');
      setCapabilities('');
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Transaction failed.' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <SheetContent side="right">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <SheetTitle>Agent details</SheetTitle>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {/* Address */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Address</p>
            <p className="text-xs font-mono break-all text-neutral-500">{agent.address}</p>
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Roles</p>
            {agent.roles.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {agent.roles.map((role) => (
                  <span key={role} className="inline-flex items-center gap-1 text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded-full">
                    {role}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No roles assigned.</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
              <p className="text-xs text-neutral-500">Automation</p>
              <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">
                {agent.allowedAutomation ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
              <p className="text-xs text-neutral-500">Max gas / call</p>
              <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">{agent.maxGasPerCall.toLocaleString()}</p>
            </div>
          </div>

          {/* Admin: Assign Role */}
          {isRoleAdmin && (
            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Assign role</p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Role name</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. PAYMENT_AGENT"
                  className="w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-neutral-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Capabilities <span className="font-normal text-neutral-400">(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="e.g. CAN_PAY, CAN_TRANSFER"
                  className="w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-neutral-50"
                />
              </div>

              <Button
                size="sm"
                onClick={handleAssignRole}
                disabled={!roleName.trim() || assignRole.isPending}
                className="w-full"
              >
                {assignRole.isPending ? 'Assigning…' : 'Assign role on-chain'}
              </Button>

              {feedback && (
                <Alert variant={feedback.ok ? 'success' : 'error'}>
                  <AlertDescription>{feedback.msg}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          <Button onClick={onClose} className="flex-1">
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
