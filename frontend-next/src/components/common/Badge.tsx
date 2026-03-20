import React from 'react';
import { cn } from '@/lib/utils/cn';

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: { background: 'rgba(123,97,255,0.15)', color: 'var(--primary)' },
  success: { background: 'rgba(34,255,178,0.12)', color: 'var(--success)' },
  warning: { background: 'rgba(255,200,87,0.12)', color: 'var(--warning)' },
  danger:  { background: 'rgba(255,77,109,0.12)', color: 'var(--blocked)' },
  neutral: { background: 'var(--card-mid)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
};

type Variant = keyof typeof VARIANT_STYLES;

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'neutral', style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('inline-flex items-center rounded-full px-xs py-xs text-xs font-semibold whitespace-nowrap', className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    />
  )
);

Badge.displayName = 'Badge';

// Keep for backward compat
const badgeVariants = () => '';

export { Badge, badgeVariants };
export type { BadgeProps };
