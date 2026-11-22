// Shared by the server, which reads the schema, and the browser, which edits the file.
import type { Preset } from './presets';

// The control that edits a setting. "json" is the fallback for shapes without a form.
export type Field =
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  | { kind: 'string'; suggestions: string[] }
  | { kind: 'number'; integer: boolean; min?: number; max?: number }
  | { kind: 'list'; options: string[] }
  | { kind: 'map' }
  | { kind: 'object'; settings: Setting[] }
  | { kind: 'json' };

export type Setting = {
  key: string;
  description: string;
  field: Field;
  // The default of a boolean, when the schema states it.
  fallback?: boolean;
  // Common values to pick from. For lists they are entries, and for maps they are names.
  presets?: Preset[];
  // JSON text of an example value, when there is a useful one.
  example?: string;
};

export type Settings = Record<string, unknown>;

export function isPlainObject(value: unknown): value is Settings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A value that does not fit its field is edited as JSON, so that nothing is lost.
export function fits(field: Field, value: unknown): boolean {
  if (value === undefined) return true;
  switch (field.kind) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'list':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'map':
      return isPlainObject(value) && Object.values(value).every((item) => typeof item === 'string');
    case 'object':
      return isPlainObject(value);
    case 'json':
      return true;
  }
}

// Sets the value at a path. undefined removes the key, and objects that become empty.
export function setAt(object: Settings, path: string[], value: unknown): Settings {
  const [key, ...rest] = path;
  const next = { ...object };
  const child = rest.length > 0 ? setAt(isPlainObject(object[key]) ? object[key] : {}, rest, value) : value;
  if (child === undefined || (rest.length > 0 && Object.keys(child as Settings).length === 0)) delete next[key];
  else next[key] = child;
  return next;
}
