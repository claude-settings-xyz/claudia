'use client';

import { BookOpen, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { type BuilderOptions, SettingsBuilder } from './settings-builder';
import { SettingsBrowser } from './settings-browser';
import type { Category } from './settings-data';

type Mode = 'browse' | 'build';

// The settings, as a browser by group or as a builder. Links to #builder open the builder.
export function Configuration({
  categories,
  options,
  count,
  version,
}: {
  categories: Category[];
  options: BuilderOptions;
  count: number;
  version: string;
}) {
  const [mode, setMode] = useState<Mode>('browse');

  useEffect(() => {
    const follow = () => {
      if (window.location.hash === '#builder') setMode('build');
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    window.history.replaceState(null, '', next === 'build' ? '#builder' : '#settings');
  }

  return (
    <section id="settings" className="scroll-mt-20">
      <span id="builder" className="block scroll-mt-20" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            {count} settings from Claude Code {version}.
          </p>
        </div>
        <div role="radiogroup" aria-label="View" className="flex rounded-lg border bg-fd-card p-1">
          {(
            [
              { value: 'browse', label: 'Browse', icon: BookOpen },
              { value: 'build', label: 'Build', icon: Wand2 },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => choose(value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === value ? 'bg-fd-primary text-fd-primary-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'browse' ? <SettingsBrowser categories={categories} /> : <SettingsBuilder options={options} />}
    </section>
  );
}
