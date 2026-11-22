import { Caveat } from 'next/font/google';
import { cn } from '@/lib/cn';

const handwriting = Caveat({ subsets: ['latin'], weight: '600' });

// A hand-drawn note that points down to the middle of the Configuration section.
export function ConfigNote() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-40 left-1/2 hidden -translate-x-[35px] items-start text-fd-foreground select-none sm:flex"
    >
      <svg viewBox="0 0 120 90" className="h-[135px] w-[180px] shrink-0 overflow-visible">
        <path
          d="M112 14 C 84 2, 44 14, 23 68"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M18 55 L 23 69 L 34 60"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className={cn(handwriting.className, '-mt-1 -ml-2 -rotate-3 text-[1.9rem] leading-none whitespace-nowrap')}>
        Create or edit your existing configuration
      </p>
    </div>
  );
}
