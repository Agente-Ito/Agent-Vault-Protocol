import React from 'react';
import { cn } from '@/lib/utils/cn';

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  info:    { background: 'rgba(60,242,255,0.08)',  border: '1px solid rgba(60,242,255,0.25)',  color: 'var(--text)' },
  success: { background: 'rgba(34,255,178,0.08)',  border: '1px solid rgba(34,255,178,0.25)',  color: 'var(--text)' },
  warning: { background: 'rgba(255,200,87,0.08)',  border: '1px solid rgba(255,200,87,0.25)',  color: 'var(--text)' },
  error:   { background: 'rgba(255,77,109,0.08)',  border: '1px solid rgba(255,77,109,0.25)',  color: 'var(--text)' },
};

type Variant = keyof typeof VARIANT_STYLES;

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl px-md py-md', className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      role="alert"
      {...props}
    />
  )
);

Alert.displayName = 'Alert';

type AlertTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-xs font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  )
);

AlertTitle.displayName = 'AlertTitle';

type AlertDescriptionProps = React.HTMLAttributes<HTMLDivElement>;

const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('[&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);

AlertDescription.displayName = 'AlertDescription';

// Keep for backward compat
const alertVariants = () => '';

export { Alert, AlertTitle, AlertDescription, alertVariants };
export type { AlertProps, AlertTitleProps, AlertDescriptionProps };
