'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { JSONView } from './json-view';
import type { Category, Setting } from './settings-data';

export function SettingsBrowser({ categories }: { categories: Category[] }) {
  const [active, setActive] = useState(categories[0].id);
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const current = categories.find((category) => category.id === active) ?? categories[0];

  const results = search
    ? categories.flatMap((category) =>
        category.settings
          .filter((setting) => setting.key.toLowerCase().includes(search) || setting.description.toLowerCase().includes(search))
          .map((setting) => ({ setting, category: category.label })),
      )
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Groups of settings" className="flex flex-wrap gap-1">
          {categories.map((category) => {
            const selected = !search && category.id === current.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActive(category.id);
                  setQuery('');
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  selected
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
                )}
              >
                {category.label}
                <span className={cn('text-xs tabular-nums', selected ? 'opacity-70' : 'opacity-60')}>
                  {category.settings.length}
                </span>
              </button>
            );
          })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fd-muted-foreground">
          {search
            ? results.length === 0
              ? 'No setting matches your search.'
              : `${results.length} ${results.length === 1 ? 'setting matches' : 'settings match'} your search.`
            : current.intro}
        </p>
        <label className="relative flex shrink-0 items-center sm:w-64">
          <Search className="pointer-events-none absolute left-3 size-4 text-fd-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-9 w-full rounded-lg border bg-fd-background pr-8 pl-9 text-sm outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className="absolute right-2 text-fd-muted-foreground hover:text-fd-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      <ul className="divide-y rounded-xl border bg-fd-card">
        {(search ? results : current.settings.map((setting) => ({ setting, category: '' }))).map(({ setting, category }) => (
          <SettingRow key={setting.key} setting={setting} category={category} />
        ))}
      </ul>
    </div>
  );
}

function SettingRow({ setting, category }: { setting: Setting; category: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = setting.description.length > 240;

  return (
    <li className={cn('grid gap-4 p-5', setting.example && 'md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm font-semibold break-all">{setting.key}</code>
          <span className="rounded-md border px-1.5 py-0.5 text-xs text-fd-muted-foreground">{setting.type}</span>
          {category && <span className="text-xs text-fd-muted-foreground">in {category}</span>}
        </div>
        {setting.description && (
          <p className={cn('mt-2 text-sm leading-relaxed text-fd-muted-foreground', long && !expanded && 'line-clamp-3')}>
            {setting.description}
          </p>
        )}
        {long && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-medium text-fd-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        {setting.values && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {setting.values.map((value) => (
              <code key={value} className="rounded-md bg-fd-muted px-1.5 py-0.5 font-mono text-xs">
                {value}
              </code>
            ))}
          </div>
        )}
      </div>
      {setting.example && (
        <JSONView
          text={`"${setting.key}": ${setting.example}`}
          className="self-start rounded-lg border bg-fd-background px-3 py-2.5 text-xs"
        />
      )}
    </li>
  );
}
