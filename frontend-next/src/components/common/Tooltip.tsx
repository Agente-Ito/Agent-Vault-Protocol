'use client';

import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg px-3 py-2 text-xs leading-snug shadow-lg pointer-events-none"
          style={{
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        tabIndex={0}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none focus:outline-none focus:ring-1"
        style={{
          background: 'var(--border)',
          color: 'var(--text-muted)',
        }}
        aria-label="More information"
      >
        ?
      </button>
    </Tooltip>
  );
}
