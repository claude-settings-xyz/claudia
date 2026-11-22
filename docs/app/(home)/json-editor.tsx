'use client';

import { AlertTriangle, Check, CircleCheck, Copy, Download, FolderOpen, RotateCcw } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { Settings } from './fields';
import { highlightJSON } from './json-view';

const places = [
  { path: '~/.claude/settings.json', text: 'For you, in every project.' },
  { path: '.claude/settings.json', text: 'For everyone on a project. Commit it.' },
  { path: '.claude/settings.local.json', text: 'For you, in one project. Keep it out of git.' },
];

// The file as text. Valid edits update the settings in Browse.
export function JSONEditor({
  text,
  file,
  known,
  onText,
  onReset,
}: {
  text: string;
  file: Settings;
  known: string[];
  onText: (text: string) => void;
  onReset: () => void;
}) {
  const error = problemOf(text);
  const count = Object.keys(file).filter((key) => key !== '$schema').length;
  const unknown = error ? [] : Object.keys(file).filter((key) => !known.includes(key));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      {/* The box stretches to the height of the side column. */}
      <div
        className={cn(
          'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-fd-card focus-within:ring-2 focus-within:ring-fd-ring',
          error && 'border-red-500',
        )}
      >
        <Editor text={text} onText={onText} />
        <div className="flex flex-col gap-1 border-t px-5 py-3 text-sm">
          <p className={cn('flex items-center gap-1.5', error ? 'text-red-500' : 'text-fd-muted-foreground')}>
            {error ? (
              <AlertTriangle className="size-4 shrink-0" />
            ) : (
              <CircleCheck className="size-4 shrink-0 text-emerald-500" />
            )}
            {error ?? `Valid JSON with ${count} ${count === 1 ? 'setting' : 'settings'}.`}
          </p>
          {unknown.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              Claude Code does not know {unknown.length === 1 ? 'this key' : 'these keys'}:{' '}
              {unknown.map((key, index) => (
                <span key={key}>
                  {index > 0 && ', '}
                  <code className="font-mono">{key}</code>
                </span>
              ))}
              . Check the spelling.
            </p>
          )}
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <Actions text={text} disabled={error !== undefined} onText={onText} onReset={onReset} />
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wider text-fd-muted-foreground uppercase">Where to save it</h3>
          <ul className="flex flex-col divide-y rounded-xl border bg-fd-card text-sm">
            {places.map((place) => (
              <li key={place.path} className="flex flex-col gap-0.5 px-4 py-3">
                <code className="font-mono text-xs font-semibold">{place.path}</code>
                <span className="text-fd-muted-foreground">{place.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-fd-muted-foreground">
          To change it later without JSON,{' '}
          <a href="#claudia" className="font-medium text-fd-foreground underline underline-offset-4">
            try Claudia
          </a>
          .
        </p>
      </aside>
    </div>
  );
}

function problemOf(text: string): string | undefined {
  if (text.trim() === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return 'The file must be a JSON object, in { }.';
    return undefined;
  } catch (problem) {
    return problem instanceof Error ? problem.message : 'This is not valid JSON.';
  }
}

// A textarea over colored text. The textarea has clear text, so the colors show through.
function Editor({ text, onText }: { text: string; onText: (text: string) => void }) {
  const colors = useRef<HTMLPreElement>(null);
  const shared = 'm-0 p-5 font-mono text-[13px] leading-relaxed whitespace-pre';
  // Grows with the file, from 10 to 30 lines.
  const lines = Math.min(Math.max(text.split('\n').length + 1, 10), 30);

  return (
    <div style={{ minHeight: `calc(${lines} * 13px * 1.625 + 2.5rem)` }} className="relative flex-1">
      <pre ref={colors} aria-hidden className={cn(shared, 'pointer-events-none absolute inset-0 overflow-hidden')}>
        {highlightJSON(text)}
        {'\n'}
      </pre>
      <textarea
        value={text}
        onChange={(event) => onText(event.target.value)}
        onScroll={(event) => {
          if (!colors.current) return;
          colors.current.scrollTop = event.currentTarget.scrollTop;
          colors.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        spellCheck={false}
        wrap="off"
        aria-label="settings.json"
        placeholder="Paste your settings.json here"
        className={cn(
          shared,
          'absolute inset-0 size-full resize-none overflow-auto bg-transparent text-transparent caret-fd-foreground outline-none selection:bg-[#d9623f]/30 placeholder:text-fd-muted-foreground',
        )}
      />
    </div>
  );
}

function Actions({
  text,
  disabled,
  onText,
  onReset,
}: {
  text: string;
  disabled: boolean;
  onText: (text: string) => void;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function open(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (chosen) onText(await chosen.text());
    event.target.value = '';
  }

  const secondary =
    'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-fd-accent';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-linear-to-b from-[#e0703f] to-[#b4482a] px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110 disabled:opacity-50"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={download} disabled={disabled} className={cn(secondary, 'disabled:opacity-50')}>
          <Download className="size-4" />
          Download
        </button>
        <button type="button" onClick={() => picker.current?.click()} className={secondary}>
          <FolderOpen className="size-4" />
          Open a file
        </button>
        <button type="button" onClick={onReset} className={secondary}>
          <RotateCcw className="size-4" />
          Start over
        </button>
      </div>
      <input ref={picker} type="file" accept=".json,application/json" onChange={open} className="hidden" />
    </div>
  );
}
