import { categories, examples, type CategoryId } from './categories';
import snapshot from './settings-schema.json';

type Schema = {
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
};

export type Setting = {
  key: string;
  description: string;
  // A short label, such as "boolean" or "list".
  type: string;
  // The allowed values, when the schema lists them.
  values?: string[];
  // JSON text of an example value, when there is a useful one.
  example?: string;
};

export type Category = { id: CategoryId; label: string; intro: string; settings: Setting[] };

const properties = (snapshot.schema as Schema).properties ?? {};

// The same checks as the Claudia app: internal settings are for programs that
// start Claude Code, and managed-only settings need an administrator.
const isInternal = (schema: Schema) => (schema.description ?? '').startsWith('@internal');
const isDeprecated = (schema: Schema) => /^deprecated\b/i.test(schema.description ?? '');
const managedOnly =
  /(?:^|[.(;]\s*)(?:read from )?managed settings only|only (?:honou?red|read)\b[^.]{0,40}?\b(?:from|in) (?:admin-controlled|managed|policy)|\((?:and )?set in (?:device )?managed settings|^when set in managed settings|^enterprise /i;
const isManagedOnly = (schema: Schema) => managedOnly.test(schema.description ?? '');

const typeLabels: Record<string, string> = {
  boolean: 'boolean',
  string: 'string',
  integer: 'number',
  number: 'number',
  array: 'list',
  object: 'object',
};

function options(schema: Schema): Schema[] {
  return [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])].filter((option) => option.type !== 'null');
}

function describeType(schema: Schema): { type: string; values?: string[] } {
  const values = [
    ...(schema.enum ?? []),
    ...options(schema).flatMap((option) => option.enum ?? (option.const !== undefined ? [option.const] : [])),
  ].map(String);
  const types = new Set(
    [schema, ...options(schema)]
      .flatMap((option) => (Array.isArray(option.type) ? option.type : option.type ? [option.type] : []))
      .filter((type) => type !== 'null')
      .map((type) => typeLabels[type] ?? type),
  );
  const type = values.length > 0 && types.size <= 1 ? 'one of' : [...types].join(' or ') || 'any';
  return values.length > 0 ? { type, values } : { type };
}

// A default that the description states, as in "(default: 30)".
function statedDefault(description: string) {
  return /default(?:s to|:)?\s*\(?(true|false|-?\d+(?:\.\d+)?)\b/i.exec(description)?.[1];
}

function exampleValue(key: string, schema: Schema, values: string[] | undefined): unknown {
  if (key in examples) return examples[key];
  if (values?.length) return values.find((value) => value !== 'default' && value !== 'auto') ?? values[0];

  const description = schema.description ?? '';
  const types = [schema, ...options(schema)].flatMap((option) => option.type ?? []);
  if (types.includes('boolean')) {
    // Show the change from the default: settings that are on by default get false.
    const onByDefault = statedDefault(description) === 'true' || /when absent or true|^set to false|^when false/i.test(description);
    return !onByDefault;
  }
  if (types.includes('integer') || types.includes('number')) return Number(statedDefault(description) ?? 1);
  // An empty string, list or object teaches nothing.
  return undefined;
}

function toSetting(key: string, schema: Schema): Setting {
  const { type, values } = describeType(schema);
  const description = (schema.description ?? '').replace(/^\(EAP\)\s*/, '');
  const example = exampleValue(key, schema, values);
  return {
    key,
    description,
    type,
    values,
    example: example === undefined ? undefined : JSON.stringify(example, null, 2),
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
    version: snapshot.version,
    count: result.reduce((total, category) => total + category.settings.length, 0),
    categories: result.filter((category) => category.settings.length > 0),
  };
}

// The values that the builder offers, from the schema, so that they stay current.
export function getBuilderOptions() {
  const enumOf = (schema: Schema | undefined) => (schema ? (describeType(schema).values ?? []) : []);
  return {
    effortLevels: enumOf(properties.effortLevel),
    permissionModes: enumOf(properties.permissions?.properties?.defaultMode),
    themes: enumOf(properties.theme),
    updateChannels: enumOf(properties.autoUpdatesChannel),
  };
}
