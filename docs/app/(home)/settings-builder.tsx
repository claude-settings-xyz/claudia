'use client';

import { ArrowLeft, ArrowRight, Check, Copy, Download, Plus, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';
import { JSONView } from './json-view';

export type BuilderOptions = {
  effortLevels: string[];
  permissionModes: string[];
  themes: string[];
  updateChannels: string[];
};

type Choices = {
  model: string;
  effort: string;
  thinking: boolean;
  mode: string;
  allowPresets: string[];
  denyPresets: string[];
  allow: string[];
  deny: string[];
  attribution: boolean;
  gitInstructions: boolean;
  env: { name: string; value: string }[];
  theme: string;
  vim: boolean;
  fullscreen: boolean;
  verbose: boolean;
  spinnerTips: boolean;
  autoMemory: boolean;
  cleanupDays: string;
  channel: string;
};

// Claude Code's defaults. The builder only writes what differs from them.
const defaults: Choices = {
  model: '',
  effort: '',
  thinking: true,
  mode: '',
  allowPresets: [],
  denyPresets: [],
  allow: [],
  deny: [],
  attribution: true,
  gitInstructions: true,
  env: [],
  theme: '',
  vim: false,
  fullscreen: false,
  verbose: false,
  spinnerTips: true,
  autoMemory: true,
  cleanupDays: '30',
  channel: '',
};

const models = [
  { value: '', label: 'Default', hint: 'Claude Code picks the model for your plan.' },
  { value: 'opus', label: 'Opus', hint: 'The most capable model.' },
  { value: 'sonnet', label: 'Sonnet', hint: 'Fast, and strong at code.' },
  { value: 'haiku', label: 'Haiku', hint: 'The fastest model.' },
];

const modes: Record<string, { label: string; hint: string }> = {
  default: { label: 'Ask first', hint: 'Asks before it edits files or runs commands.' },
  acceptEdits: { label: 'Accept edits', hint: 'Edits files without asking. Asks before it runs commands.' },
  plan: { label: 'Plan', hint: 'Reads and plans. It changes nothing until you approve the plan.' },
  auto: { label: 'Auto', hint: 'Goes ahead with actions that look safe, and asks about the rest.' },
  dontAsk: { label: "Don't ask", hint: 'Never asks. It denies anything that your rules do not allow.' },
  bypassPermissions: { label: 'Bypass', hint: 'Never asks and allows everything. Use it only in a sandbox.' },
};

const allowPresets = [
  { id: 'git', label: 'Read the git status, diffs and history', rules: ['Bash(git status)', 'Bash(git diff *)', 'Bash(git log *)'] },
  { id: 'npm', label: 'Run npm scripts', rules: ['Bash(npm run *)'] },
  { id: 'search', label: 'Search the web', rules: ['WebSearch'] },
];

const denyPresets = [
  { id: 'env', label: 'Never read .env files', rules: ['Read(./.env)', 'Read(./.env.*)'] },
  { id: 'rm', label: 'Never run rm -rf', rules: ['Bash(rm -rf *)'] },
  { id: 'network', label: 'Never run curl or wget', rules: ['Bash(curl *)', 'Bash(wget *)'] },
];

const steps = ['Model', 'Permissions', 'Git', 'Environment', 'Interface', 'Housekeeping', 'Your file'] as const;

function buildSettings(choices: Choices) {
  const settings: Record<string, unknown> = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
  };
  if (choices.model) settings.model = choices.model;
  if (choices.effort) settings.effortLevel = choices.effort;
  if (!choices.thinking) settings.alwaysThinkingEnabled = false;

  const rules = (presets: typeof allowPresets, chosen: string[], extra: string[]) => [
    ...presets.filter((preset) => chosen.includes(preset.id)).flatMap((preset) => preset.rules),
    ...extra,
  ];
  const allow = rules(allowPresets, choices.allowPresets, choices.allow);
  const deny = rules(denyPresets, choices.denyPresets, choices.deny);
  const permissions: Record<string, unknown> = {};
  if (allow.length > 0) permissions.allow = allow;
  if (deny.length > 0) permissions.deny = deny;
  if (choices.mode) permissions.defaultMode = choices.mode;
  if (Object.keys(permissions).length > 0) settings.permissions = permissions;

  if (!choices.attribution) settings.attribution = { commit: '', pr: '' };
  if (!choices.gitInstructions) settings.includeGitInstructions = false;

  const env = choices.env.filter((entry) => entry.name.trim());
  if (env.length > 0) settings.env = Object.fromEntries(env.map((entry) => [entry.name.trim(), entry.value]));

  if (choices.theme) settings.theme = choices.theme;
  if (choices.vim) settings.editorMode = 'vim';
  if (choices.fullscreen) settings.tui = 'fullscreen';
  if (choices.verbose) settings.verbose = true;
  if (!choices.spinnerTips) settings.spinnerTipsEnabled = false;

  if (!choices.autoMemory) settings.autoMemoryEnabled = false;
  const days = Number.parseInt(choices.cleanupDays, 10);
  if (Number.isFinite(days) && days >= 1 && days !== 30) settings.cleanupPeriodDays = days;
  if (choices.channel) settings.autoUpdatesChannel = choices.channel;

  return JSON.stringify(settings, null, 2) + '\n';
}

export function SettingsBuilder({ options }: { options: BuilderOptions }) {
  const [choices, setChoices] = useState<Choices>(defaults);
  const [step, setStep] = useState(0);
  const json = buildSettings(choices);
  const last = step === steps.length - 1;

  function set<K extends keyof Choices>(key: K, value: Choices[K]) {
    setChoices((old) => ({ ...old, [key]: value }));
  }

  function toggle(key: 'allowPresets' | 'denyPresets', id: string) {
    setChoices((old) => ({
      ...old,
      [key]: old[key].includes(id) ? old[key].filter((each) => each !== id) : [...old[key], id],
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="flex min-w-0 flex-col gap-5">
        <ol className="flex flex-wrap gap-1" aria-label="Steps">
          {steps.map((label, index) => (
            <li key={label} className="shrink-0">
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={index === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  index === step
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
                )}
              >
                <span className="tabular-nums opacity-60">{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="flex min-h-[26rem] flex-col gap-6 rounded-xl border bg-fd-card p-5 sm:p-6">
          {step === 0 && (
            <>
              <Question title="Which model should Claude Code use?">
                <Choice value={choices.model} onChange={(value) => set('model', value)} options={models} />
              </Question>
              {options.effortLevels.length > 0 && (
                <Question title="How much effort?" hint="Higher effort thinks longer on supported models.">
                  <Choice
                    value={choices.effort}
                    onChange={(value) => set('effort', value)}
                    options={[{ value: '', label: 'Default' }, ...options.effortLevels.map((value) => ({ value, label: capitalize(value) }))]}
                    compact
                  />
                </Question>
              )}
              <Toggle
                checked={choices.thinking}
                onChange={(value) => set('thinking', value)}
                label="Let Claude think before it answers"
                hint="On by default for models that support thinking."
              />
            </>
          )}

          {step === 1 && (
            <>
              <Question title="How careful should Claude Code be?">
                <Choice
                  value={choices.mode}
                  onChange={(value) => set('mode', value)}
                  options={[
                    { value: '', label: 'Default', hint: 'Asks before it edits files or runs commands.' },
                    ...Object.entries(modes)
                      .filter(([value]) => value !== 'default' && options.permissionModes.includes(value))
                      .map(([value, mode]) => ({ value, ...mode })),
                  ]}
                />
              </Question>
              <Question title="Always allow" hint="Claude Code does these without asking.">
                <Checks presets={allowPresets} chosen={choices.allowPresets} onToggle={(id) => toggle('allowPresets', id)} />
                <Rules rules={choices.allow} onChange={(rules) => set('allow', rules)} placeholder="Bash(npm run build)" />
              </Question>
              <Question title="Never allow" hint="Claude Code refuses these, whatever you answer.">
                <Checks presets={denyPresets} chosen={choices.denyPresets} onToggle={(id) => toggle('denyPresets', id)} />
                <Rules rules={choices.deny} onChange={(rules) => set('deny', rules)} placeholder="Read(./secrets/**)" />
              </Question>
            </>
          )}

          {step === 2 && (
            <>
              <Toggle
                checked={choices.attribution}
                onChange={(value) => set('attribution', value)}
                label="Credit Claude in commits and pull requests"
                hint="Adds Claude as a co-author of commits, and a note to pull requests."
              />
              <Toggle
                checked={choices.gitInstructions}
                onChange={(value) => set('gitInstructions', value)}
                label="Use the built-in git instructions"
                hint="Tells Claude how to write commits and pull requests. Turn it off if your CLAUDE.md has its own rules."
              />
            </>
          )}

          {step === 3 && (
            <Question
              title="Environment variables"
              hint="Claude Code sets these in every session, for example for a proxy or an API endpoint."
            >
              <Variables entries={choices.env} onChange={(env) => set('env', env)} />
            </Question>
          )}

          {step === 4 && (
            <>
              {options.themes.length > 0 && (
                <Question title="Theme">
                  <Choice
                    value={choices.theme}
                    onChange={(value) => set('theme', value)}
                    options={[{ value: '', label: 'Default' }, ...options.themes.map((value) => ({ value, label: value }))]}
                    compact
                  />
                </Question>
              )}
              <Toggle checked={choices.vim} onChange={(value) => set('vim', value)} label="Vim keys in the prompt" />
              <Toggle
                checked={choices.fullscreen}
                onChange={(value) => set('fullscreen', value)}
                label="Full-screen interface"
                hint="A renderer without flicker, with its own scrollback."
              />
              <Toggle
                checked={choices.verbose}
                onChange={(value) => set('verbose', value)}
                label="Show the full output of tools"
                hint="Instead of short summaries."
              />
              <Toggle checked={choices.spinnerTips} onChange={(value) => set('spinnerTips', value)} label="Show tips while Claude works" />
            </>
          )}

          {step === 5 && (
            <>
              <Toggle
                checked={choices.autoMemory}
                onChange={(value) => set('autoMemory', value)}
                label="Auto memory"
                hint="Claude saves notes about your projects and reads them in later sessions."
              />
              <Question title="Keep transcripts for" hint="Older transcripts are deleted from your computer. The default is 30 days.">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={choices.cleanupDays}
                    onChange={(event) => set('cleanupDays', event.target.value)}
                    aria-label="Days to keep transcripts"
                    className="h-9 w-24 rounded-lg border bg-fd-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
                  />
                  <span className="text-sm text-fd-muted-foreground">days</span>
                </div>
              </Question>
              {options.updateChannels.length > 0 && (
                <Question title="Updates" hint="Stable gets releases after they have been out for a while.">
                  <Choice
                    value={choices.channel}
                    onChange={(value) => set('channel', value)}
                    options={[{ value: '', label: 'Default' }, ...options.updateChannels.map((value) => ({ value, label: capitalize(value) }))]}
                    compact
                  />
                </Question>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <Question title="Your settings.json is ready" hint="Save it in one of these places. Claude Code reads it when a session starts.">
                <ul className="flex flex-col gap-2 text-sm">
                  <Place path="~/.claude/settings.json" text="For you, in every project." />
                  <Place path=".claude/settings.json" text="For everyone who works on a project. Commit it." />
                  <Place path=".claude/settings.local.json" text="For you, in one project. Keep it out of git." />
                </ul>
              </Question>
              <FileActions json={json} />
              <p className="text-sm text-fd-muted-foreground">
                To change it later without editing JSON,{' '}
                <a href="#claudia" className="font-medium text-fd-foreground underline underline-offset-4">
                  try Claudia
                </a>
                .
              </p>
            </>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground disabled:invisible"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            {!last && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
              >
                {step === steps.length - 2 ? 'Finish' : 'Next'}
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-sm font-semibold">settings.json</h3>
          <FileActions json={json} compact />
        </div>
        <JSONView
          text={json}
          className="max-h-[32rem] overflow-y-auto rounded-xl border bg-fd-card p-4 whitespace-pre-wrap [overflow-wrap:anywhere]"
        />
      </aside>
    </div>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        {hint && <span className="text-sm text-fd-muted-foreground">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({
  value,
  onChange,
  options,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  compact?: boolean;
}) {
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]' : 'sm:grid-cols-2')}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value || 'default'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
              selected ? 'border-fd-primary bg-fd-primary/5 ring-1 ring-fd-primary' : 'hover:bg-fd-accent',
            )}
          >
            <span className="text-sm font-medium">{option.label}</span>
            {option.hint && <span className="text-xs text-fd-muted-foreground">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-fd-muted-foreground">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-fd-muted ring-1 ring-fd-border transition-colors peer-checked:bg-fd-primary peer-focus-visible:ring-2 peer-focus-visible:ring-fd-ring after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-fd-background after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

function Checks({
  presets,
  chosen,
  onToggle,
}: {
  presets: { id: string; label: string; rules: string[] }[];
  chosen: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {presets.map((preset) => (
        <label key={preset.id} className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 hover:bg-fd-accent">
          <input
            type="checkbox"
            checked={chosen.includes(preset.id)}
            onChange={() => onToggle(preset.id)}
            className="mt-1 size-4 accent-fd-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{preset.label}</span>
            <code className="font-mono text-xs text-fd-muted-foreground">{preset.rules.join(', ')}</code>
          </span>
        </label>
      ))}
    </div>
  );
}

// Free-form permission rules, one per row.
function Rules({ rules, onChange, placeholder }: { rules: string[]; onChange: (rules: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const rule = draft.trim();
    if (rule && !rules.includes(rule)) onChange([...rules, rule]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule) => (
        <div key={rule} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
          <code className="font-mono text-xs">{rule}</code>
          <button
            type="button"
            onClick={() => onChange(rules.filter((each) => each !== rule))}
            aria-label={`Remove ${rule}`}
            className="text-fd-muted-foreground hover:text-fd-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && add()}
          placeholder={placeholder}
          aria-label="New rule"
          className="h-9 min-w-0 flex-1 rounded-lg border bg-fd-background px-3 font-mono text-xs outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-fd-accent disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
    </div>
  );
}

function Variables({
  entries,
  onChange,
}: {
  entries: { name: string; value: string }[];
  onChange: (entries: { name: string; value: string }[]) => void;
}) {
  const update = (index: number, change: Partial<{ name: string; value: string }>) =>
    onChange(entries.map((entry, each) => (each === index ? { ...entry, ...change } : entry)));
  const field =
    'h-9 min-w-0 rounded-lg border bg-fd-background px-3 font-mono text-xs outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring';

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={entry.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder="NAME"
            aria-label="Variable name"
            className={cn(field, 'w-2/5')}
          />
          <input
            value={entry.value}
            onChange={(event) => update(index, { value: event.target.value })}
            placeholder="value"
            aria-label="Variable value"
            className={cn(field, 'flex-1')}
          />
          <button
            type="button"
            onClick={() => onChange(entries.filter((_, each) => each !== index))}
            aria-label="Remove the variable"
            className="px-1 text-fd-muted-foreground hover:text-fd-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...entries, { name: '', value: '' }])}
        className="flex items-center gap-1 self-start rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-accent"
      >
        <Plus className="size-4" />
        Add a variable
      </button>
    </div>
  );
}

function Place({ path, text }: { path: string; text: string }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <code className="font-mono text-xs font-semibold">{path}</code>
      <span className="text-fd-muted-foreground">{text}</span>
    </li>
  );
}

function FileActions({ json, compact }: { json: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  const button = cn(
    'flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
    compact ? 'px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground' : 'border px-3 py-2 hover:bg-fd-accent',
  );

  return (
    <div className="flex gap-2">
      <button type="button" onClick={copy} className={button}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button type="button" onClick={download} className={button}>
        <Download className="size-4" />
        Download
      </button>
    </div>
  );
}
