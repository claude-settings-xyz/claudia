'use client';

import { ChevronDown, X } from 'lucide-react';
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Field, fits, isPlainObject, type Setting } from './fields';

// undefined removes the setting from the file.
export type Change = (path: string[], value: unknown) => void;

const input =
  'h-9 w-full min-w-0 rounded-lg border bg-fd-background px-3 text-sm outline-none placeholder:text-fd-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-fd-ring';
const smallButton =
  'flex h-9 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-fd-accent disabled:opacity-50';
const iconButton =
  'grid size-9 shrink-0 place-items-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground';

export function SettingRow({
  setting,
  path,
  value,
  onChange,
  category,
}: {
  setting: Setting;
  path: string[];
  value: unknown;
  onChange: Change;
  // Shown next to the name in search results.
  category?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const field: Field = fits(setting.field, value) ? setting.field : { kind: 'json' };
  const set = (next: unknown) => onChange(path, next);

  // Unset settings take one line. Larger editors open on demand or when there is a value.
  const collapsible = field.kind === 'json' || field.kind === 'object' || field.kind === 'map';
  const open = value !== undefined || expanded;
  const block = collapsible ? open : field.kind === 'list' && Array.isArray(value) && value.length > 0;

  const control =
    collapsible && !open ? (
      <button type="button" onClick={() => setExpanded(true)} className={smallButton}>
        {field.kind === 'object' ? `Show ${field.settings.length} settings` : field.kind === 'map' ? 'Add entry' : 'Edit JSON'}
      </button>
    ) : (
      <Control setting={setting} field={field} value={value} path={path} set={set} onChange={onChange} />
    );

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {value !== undefined && path.length > 1 && (
              <span aria-label="Set in your file" className="size-1.5 shrink-0 rounded-full bg-[#e0703f]" />
            )}
            <code className="font-mono text-sm font-semibold break-all">{setting.key}</code>
            {category && <span className="text-xs text-fd-muted-foreground">in {category}</span>}
            {value !== undefined && (
              <button
                type="button"
                title="Remove it from the file, so that Claude Code uses its default"
                aria-label={`Remove ${setting.key}`}
                onClick={() => set(undefined)}
                className="text-xs font-medium text-fd-muted-foreground hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>
          {setting.description && <Description text={setting.description} />}
        </div>
        {!block && <div className="flex shrink-0 sm:w-64 sm:justify-end">{control}</div>}
      </div>
      {block && <div className="mt-3">{control}</div>}
    </li>
  );
}

// Shows three lines, and a toggle only when the text is cut off.
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const observer = new ResizeObserver(() => setClipped(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <>
      <p ref={ref} className={cn('mt-1.5 text-sm leading-relaxed text-fd-muted-foreground', !expanded && 'line-clamp-3')}>
        {text}
      </p>
      {(clipped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-medium text-[#b4482a] hover:underline dark:text-[#f5936a]"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

function Control({
  setting,
  field,
  value,
  path,
  set,
  onChange,
}: {
  setting: Setting;
  field: Field;
  value: unknown;
  path: string[];
  set: (value: unknown) => void;
  onChange: Change;
}) {
  const example = parse(setting.example);

  switch (field.kind) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2.5">
          {value === undefined && (
            <span className="text-xs text-fd-muted-foreground">{setting.fallback === undefined ? 'Not set' : 'Default'}</span>
          )}
          <Switch checked={(value ?? setting.fallback ?? false) as boolean} onChange={set} label={setting.key} />
        </div>
      );
    case 'enum':
      return <OptionSelect options={field.options} value={value as string | undefined} onSelect={set} label={setting.key} />;
    case 'string':
      return (
        <DraftInput
          value={(value as string | undefined) ?? ''}
          onCommit={(text) => set(text === '' ? undefined : text)}
          suggestions={field.suggestions}
          placeholder={typeof example === 'string' ? example : 'Not set'}
          aria-label={setting.key}
        />
      );
    case 'number':
      return (
        <DraftInput
          type="number"
          step={field.integer ? 1 : 'any'}
          min={field.min}
          max={field.max}
          value={value === undefined ? '' : String(value)}
          onCommit={(text) => {
            const number = Number(text);
            if (text.trim() === '') set(undefined);
            else if (Number.isFinite(number)) set(number);
          }}
          placeholder={typeof example === 'number' ? String(example) : 'Not set'}
          aria-label={setting.key}
        />
      );
    case 'list':
      return (
        <ListControl
          items={(value as string[] | undefined) ?? []}
          options={field.options}
          onChange={(items) => set(items.length > 0 ? items : undefined)}
          label={setting.key}
          placeholder={Array.isArray(example) && typeof example[0] === 'string' ? example[0] : 'Add an entry'}
        />
      );
    case 'map':
      return (
        <MapControl
          entries={(value as Record<string, string> | undefined) ?? {}}
          onChange={(entries) => set(Object.keys(entries).length > 0 ? entries : undefined)}
          label={setting.key}
          example={isPlainObject(example) ? Object.entries(example)[0] : undefined}
        />
      );
    case 'object':
      return (
        <ul className="divide-y rounded-xl border bg-fd-background/40">
          {field.settings.map((child) => (
            <SettingRow
              key={child.key}
              setting={child}
              path={[...path, child.key]}
              value={isPlainObject(value) ? value[child.key] : undefined}
              onChange={onChange}
            />
          ))}
        </ul>
      );
    case 'json':
      return <JSONControl value={value} onChange={set} label={setting.key} placeholder={setting.example} />;
  }
}

function parse(text: string | undefined): unknown {
  return text === undefined ? undefined : JSON.parse(text);
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:outline-none',
        checked ? 'bg-[#d9623f]' : 'bg-fd-muted ring-1 ring-fd-border ring-inset',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

type DraftInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (text: string) => void;
  suggestions?: string[];
};

// Saves when the field loses focus or on Enter. Escape restores the saved text.
function DraftInput({ value, onCommit, suggestions = [], className, ...props }: DraftInputProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const listId = useId();
  if (value !== saved) {
    setSaved(value);
    setDraft(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setDraft(value);
  }

  return (
    <>
      <input
        {...props}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={onKeyDown}
        list={suggestions.length > 0 ? listId : undefined}
        className={cn(input, className)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}

function OptionSelect({
  options,
  value,
  onSelect,
  label,
  placeholder = 'Not set',
}: {
  options: string[];
  value: string | undefined;
  onSelect: (value: string | undefined) => void;
  label: string;
  placeholder?: string;
}) {
  // A value from a pasted file that the schema does not list still shows.
  const all = value !== undefined && !options.includes(value) ? [...options, value] : options;
  return (
    <div className="relative w-full">
      <select
        value={value ?? ''}
        onChange={(event) => onSelect(event.target.value === '' ? undefined : event.target.value)}
        aria-label={label}
        className={cn(input, 'appearance-none pr-8', value === undefined && 'text-fd-muted-foreground')}
      >
        <option value="">{placeholder}</option>
        {all.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-fd-muted-foreground" />
    </div>
  );
}

function ListControl({
  items,
  options,
  onChange,
  label,
  placeholder,
}: {
  items: string[];
  options: string[];
  onChange: (items: string[]) => void;
  label: string;
  placeholder: string;
}) {
  const [adding, setAdding] = useState('');
  const remaining = options.filter((option) => !items.includes(option));

  function add(entry: string | undefined) {
    if (!entry?.trim()) return;
    onChange([...items, entry.trim()]);
    setAdding('');
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <DraftInput
            value={item}
            onCommit={(text) =>
              onChange(text.trim() === '' ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? text : old)))
            }
            aria-label={`${label} entry ${index + 1}`}
            className="font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className={iconButton}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {options.length > 0 ? (
        remaining.length > 0 && (
          <OptionSelect options={remaining} value={undefined} onSelect={add} label={`Add to ${label}`} placeholder="Add an entry" />
        )
      ) : (
        <div className="flex gap-2">
          <input
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add(adding)}
            placeholder={placeholder}
            aria-label={`Add to ${label}`}
            className={cn(input, 'font-mono text-xs')}
          />
          <button type="button" disabled={!adding.trim()} onClick={() => add(adding)} className={smallButton}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function MapControl({
  entries,
  onChange,
  label,
  example,
}: {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  label: string;
  example?: [string, unknown];
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const pairs = Object.entries(entries);

  // Rebuilding the object keeps the order of the keys.
  const rename = (from: string, to: string) =>
    to.trim() !== '' &&
    !(to in entries) &&
    onChange(Object.fromEntries(pairs.map(([k, v]) => (k === from ? [to.trim(), v] : [k, v]))));

  function add() {
    if (key.trim() === '' || key in entries) return;
    onChange({ ...entries, [key.trim()]: value });
    setKey('');
    setValue('');
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
      {pairs.map(([k, v]) => (
        <div key={k} className="contents">
          <DraftInput value={k} onCommit={(text) => rename(k, text)} aria-label={`${label} name`} className="font-mono text-xs" />
          <DraftInput
            value={v}
            onCommit={(text) => onChange({ ...entries, [k]: text })}
            aria-label={`${label} ${k}`}
            className="font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Remove ${k}`}
            onClick={() => onChange(Object.fromEntries(pairs.filter(([other]) => other !== k)))}
            className={iconButton}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <input
        value={key}
        onChange={(event) => setKey(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder={example?.[0] ?? 'Name'}
        aria-label={`New ${label} name`}
        className={cn(input, 'font-mono text-xs')}
      />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder={typeof example?.[1] === 'string' ? example[1] : 'Value'}
        aria-label={`New ${label} value`}
        className={cn(input, 'font-mono text-xs')}
      />
      <button type="button" disabled={!key.trim() || key in entries} onClick={add} className={smallButton}>
        Add
      </button>
    </div>
  );
}

// Saves when the field loses focus, if the text is valid JSON. Empty text removes the setting.
function JSONControl({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  placeholder?: string;
}) {
  const text = value === undefined ? '' : JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(text);
  const [saved, setSaved] = useState(text);
  const [error, setError] = useState('');
  if (text !== saved) {
    setSaved(text);
    setDraft(text);
    setError('');
  }

  function commit() {
    if (draft === text) return;
    if (draft.trim() === '') return onChange(undefined);
    try {
      onChange(JSON.parse(draft));
      setError('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'This is not valid JSON.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error !== ''}
        spellCheck={false}
        rows={Math.min(Math.max((draft || placeholder || '').split('\n').length, 3), 16)}
        className={cn(input, 'h-auto py-2 font-mono text-xs leading-relaxed', error && 'border-red-500')}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
