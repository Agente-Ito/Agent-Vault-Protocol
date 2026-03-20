import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// Structural classes only — colors handled via style prop
const buttonBase = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:opacity-85 active:opacity-70',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary:   { background: 'var(--primary)',  color: '#fff' },
  secondary: { background: 'var(--card-mid)', color: 'var(--text)', border: '1px solid var(--border)' },
  ghost:     { background: 'transparent',     color: 'var(--primary)' },
  danger:    { background: 'var(--blocked)',  color: '#fff' },
  success:   { background: 'var(--success)',  color: '#000' },
};

type Variant = keyof typeof VARIANT_STYLES;

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonBase> {
  variant?: Variant;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size, fullWidth, style, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonBase({ size, fullWidth }), className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    />
  )
);

Button.displayName = 'Button';

// Keep export for backward compat (not used externally but avoids import errors)
const buttonVariants = buttonBase;

export { Button, buttonVariants };
export type { ButtonProps };
