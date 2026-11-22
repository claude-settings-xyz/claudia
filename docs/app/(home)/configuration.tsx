'use client';

import { BookOpen, Braces } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { isPlainObject, setAt, type Settings } from './fields';
import { JSONEditor } from './json-editor';
import { SettingsBrowser } from './settings-browser';
import type { Category } from './settings-data';

type Mode = 'browse' | 'json';

const empty: Settings = { $schema: 'https://json.schemastore.org/claude-code-settings.json' };
const format = (file: Settings) => JSON.stringify(file, null, 2) + '\n';

// One file, edited in two ways: setting by setting in Browse, or as text in JSON.
// Links to #json open the JSON view, and links such as #settings-hooks open a group.
export function Configuration({ categories, known }: { categories: Category[]; known: string[] }) {
  const [mode, setMode] = useState<Mode>('browse');
  const [tab, setTab] = useState<string>(categories[0].id);
  const [file, setFile] = useState<Settings>(empty);
  const [text, setText] = useState(() => format(empty));
  const count = Object.keys(file).filter((key) => key !== '$schema').length;

  useEffect(() => {
    const follow = () => {
      const hash = window.location.hash;
      if (hash === '#json') setMode('json');
      if (hash === '#settings') setMode('browse');
      const group = categories.find((category) => hash === `#settings-${category.id}`);
      if (group) {
        setMode('browse');
        setTab(group.id);
      }
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [categories]);

  function choose(next: Mode) {
    setMode(next);
    window.history.replaceState(null, '', next === 'json' ? '#json' : `#settings-${tab}`);
  }

  function chooseTab(id: string) {
    setTab(id);
    window.history.replaceState(null, '', `#settings-${id}`);
  }

  function change(path: string[], value: unknown) {
    const next = setAt(file, path, value);
    setFile(next);
    setText(format(next));
  }

  // Invalid text stays in the editor, and Browse keeps the last valid file.
  function edit(next: string) {
    setText(next);
    try {
      const parsed: unknown = next.trim() === '' ? {} : JSON.parse(next);
      if (isPlainObject(parsed)) setFile(parsed);
    } catch {}
  }

  function reset() {
    setFile(empty);
    setText(format(empty));
  }

  return (
    <section id="settings" className="scroll-mt-20">
      <span id="json" className="block scroll-mt-20" />
      {categories.map((category) => (
        <span key={category.id} id={`settings-${category.id}`} className="block scroll-mt-20" />
      ))}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
        <div role="radiogroup" aria-label="View" className="flex self-start rounded-lg border bg-fd-card p-1">
          {(
            [
              { value: 'browse', label: 'Browse', icon: BookOpen },
              { value: 'json', label: 'JSON', icon: Braces },
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
              {value === 'json' && count > 0 && (
                <span className="rounded-full bg-[#d9623f] px-1.5 text-[11px] leading-4 font-semibold text-white tabular-nums">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {mode === 'browse' ? (
        <SettingsBrowser categories={categories} active={tab} onActive={chooseTab} file={file} onChange={change} />
      ) : (
        <JSONEditor text={text} file={file} known={known} onText={edit} onReset={reset} />
      )}
    </section>
  );
}
