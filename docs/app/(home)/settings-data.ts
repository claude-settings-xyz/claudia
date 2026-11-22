import { categories, examples, type CategoryId } from './categories';
import type { Field, Setting } from './fields';
import { presets } from './presets';
import snapshot from './settings-schema.json';

type Schema = {
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  anyOf?: Schema[];
  oneOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
};

export type Category = { id: CategoryId; label: string; intro: string; settings: Setting[] };

const properties = (snapshot.schema as unknown as Schema).properties ?? {};

// The same checks as the Claudia app: internal settings are for programs that
// start Claude Code, and managed-only settings need an administrator.
const isInternal = (schema: Schema) => (schema.description ?? '').startsWith('@internal');
const isDeprecated = (schema: Schema) => /^deprecated\b/i.test(schema.description ?? '');
const managedOnly =
  /(?:^|[.(;]\s*)(?:read from )?managed settings only|only (?:honou?red|read)\b[^.]{0,40}?\b(?:from|in) (?:admin-controlled|managed|policy)|\((?:and )?set in (?:device )?managed settings|^when set in managed settings|^enterprise /i;
const isManagedOnly = (schema: Schema) => managedOnly.test(schema.description ?? '');

export const isManagedKey = (key: string) => key in properties && isManagedOnly(properties[key]);
export const claudeCodeVersion = snapshot.version;

function withoutNull(schema: Schema): Schema {
  if (!schema.anyOf) return schema;
  const options = schema.anyOf.filter((option) => option.type !== 'null');
  if (options.length === 1) return { ...options[0], description: schema.description ?? options[0].description };
  return { ...schema, anyOf: options };
}

function strings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string');
}

function fieldOf(schema: Schema, path: string): Field {
  const s = withoutNull(schema);

  if (s.anyOf) {
    // For example the theme: a list of names, or any "custom:" string.
    if (s.anyOf.every((option) => option.type === 'string')) {
      return { kind: 'string', suggestions: s.anyOf.flatMap((option) => strings(option.enum)) };
    }
    return { kind: 'json' };
  }

  switch (s.type) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return s.enum ? { kind: 'enum', options: strings(s.enum) } : { kind: 'string', suggestions: [] };
    case 'integer':
    case 'number':
      return { kind: 'number', integer: s.type === 'integer', min: s.minimum, max: s.maximum };
    case 'array': {
      const items = withoutNull(s.items ?? {});
      return items.type === 'string' ? { kind: 'list', options: strings(items.enum) } : { kind: 'json' };
    }
    case 'object': {
      if (s.properties && Object.keys(s.properties).length > 0) {
        const settings = Object.entries(s.properties)
          .filter(([, child]) => !isInternal(child))
          .map(([key, child]) => toSetting(key, child, `${path}.${key}`));
        return { kind: 'object', settings };
      }
      const values = s.additionalProperties;
      if (typeof values === 'object' && withoutNull(values).type === 'string') return { kind: 'map' };
      return { kind: 'json' };
    }
  }
  return { kind: 'json' };
}

// A default that the description states, as in "(default: true)".
function statedDefault(description: string) {
  return /default(?:s to|:)?\s*\(?(true|false|-?\d+(?:\.\d+)?)\b/i.exec(description)?.[1];
}

function fallbackOf(schema: Schema): boolean | undefined {
  if (typeof schema.default === 'boolean') return schema.default;
  const stated = statedDefault(schema.description ?? '');
  if (stated === 'true' || /when absent or true|^set to false|^when false/i.test(schema.description ?? '')) return true;
  if (stated === 'false') return false;
  return undefined;
}

function toSetting(key: string, schema: Schema, path = key): Setting {
  let field = fieldOf(schema, path);
  let common = presets[path];
  // Known values in the schema, such as the names of the themes, become presets.
  if (field.kind === 'string' && !common && field.suggestions.length > 0) {
    common = field.suggestions.map((value) => ({ value }));
    field = { kind: 'string', suggestions: [] };
  }
  // Too many to list, so the field suggests them as you type.
  if (path === 'timeZone') field = { kind: 'string', suggestions: Intl.supportedValuesOf('timeZone') };
  const description = (schema.description ?? '').replace(/^\(EAP\)\s*/, '');
  return {
    key,
    description,
    field,
    fallback: field.kind === 'boolean' ? fallbackOf(schema) : undefined,
    presets: common,
    example: key in examples ? JSON.stringify(examples[key], null, 2) : undefined,
  };
}

export function getSettings() {
  const listed = new Set<string>();
  const result: Category[] = [];
  const usable = (key: string) => {
    const schema = properties[key];
    return schema !== undefined && key !== '$schema' && !isInternal(schema) && !isDeprecated(schema);
  };
  const managed = Object.keys(properties).filter((key) => usable(key) && isManagedOnly(properties[key]));

  for (const category of categories) {
    const keys: string[] =
      category.id === 'organization'
        ? [...category.keys, ...managed.filter((key) => !(category.keys as readonly string[]).includes(key))]
        : category.keys.filter((key) => !managed.includes(key));
    const settings = keys.filter((key) => usable(key) && !listed.has(key)).map((key) => toSetting(key, properties[key]));
    for (const setting of settings) listed.add(setting.key);
    result.push({ id: category.id, label: category.label, intro: category.intro, settings });
  }

  const rest = Object.keys(properties).filter((key) => usable(key) && !listed.has(key));
  if (rest.length > 0) {
    result.push({
      id: 'more',
      label: 'More',
      intro: 'Other settings that Claude Code reads.',
      settings: rest.sort((a, b) => a.localeCompare(b)).map((key) => toSetting(key, properties[key])),
    });
  }

  return {
    count: result.reduce((total, category) => total + category.settings.length, 0),
    categories: result.filter((category) => category.settings.length > 0),
    // All keys that Claude Code knows, to find typos in a pasted file.
    known: Object.keys(properties),
  };
}
