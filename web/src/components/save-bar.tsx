import type { ReactNode } from 'react'

// Floats at the bottom left of its container, away from the toasts on the right.
export function SaveBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 flex">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-popover p-1 pl-4 shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 slide-in-from-bottom-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  )
}
