import { Caveat } from 'next/font/google';
import { cn } from '@/lib/cn';

const handwriting = Caveat({ subsets: ['latin'], weight: '600' });

// A hand-drawn note that points down to the middle of the Configuration section.
export function ConfigNote() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-24 left-1/2 hidden -translate-x-[23px] items-start text-[#b4482a] select-none sm:flex dark:text-[#f5936a]"
    >
      <svg viewBox="0 0 120 90" className="h-[90px] w-[120px] shrink-0 overflow-visible">
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
      <p className={cn(handwriting.className, '-mt-2 -ml-1 -rotate-3 text-[1.7rem] leading-none whitespace-nowrap text-fd-foreground')}>
        Create or edit your existing configuration
      </p>
    </div>
  );
}
