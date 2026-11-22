import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('size-8 drop-shadow', className)}>
      <rect width="64" height="64" rx="16" fill="#fff" />
      <rect x="11" y="19.5" width="42" height="25" rx="12.5" fill="none" stroke="#b94e30" strokeWidth="4.5" />
      <circle cx="41" cy="32" r="6.5" fill="#b94e30" />
    </svg>
  );
}
