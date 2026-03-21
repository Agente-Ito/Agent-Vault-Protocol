'use client';

import React, { useState } from 'react';
import { SidebarClient } from './SidebarClient';
import { TopBar } from './TopBar';
import { ParticleField } from '@/components/common/ParticleField';

interface AppShellProps {
  children: React.ReactNode;
  account: string | null;
  chainId: number | null;
  onConnect?: () => void;
}

export function AppShell({ children, account, chainId, onConnect }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen" style={{ background: 'var(--bg)' }}>
      <ParticleField />

      {/* Sidebar */}
      <SidebarClient isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <TopBar
          account={account}
          chainId={chainId}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onConnect={onConnect}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-lg md:p-xl">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

