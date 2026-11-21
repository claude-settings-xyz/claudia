import type { JSONSchema } from '@/lib/api'
import { isPlainObject } from '@/lib/settings'

// The control that edits a setting. "json" is the fallback for shapes without a form.
export type Field =
  | { kind: 'boolean' }
  | { kind: 'enum'; options: string[] }
  | { kind: 'string'; suggestions: string[] }
  | { kind: 'number'; integer: boolean; min?: number; max?: number }
  | { kind: 'list'; options: string[] }
  | { kind: 'map' }
  | { kind: 'object'; properties: [string, JSONSchema][] }
  | { kind: 'json' }

export function fieldOf(schema: JSONSchema | undefined): Field {
  if (!schema) return { kind: 'json' }
  const s = withoutNull(schema)

  if (s.anyOf) {
    // For example the theme: a list of names, or any "custom:" string.
    if (s.anyOf.every((option) => option.type === 'string')) {
      return { kind: 'string', suggestions: s.anyOf.flatMap((option) => strings(option.enum)) }
    }
    return { kind: 'json' }
  }

  switch (s.type) {
    case 'boolean':
      return { kind: 'boolean' }
    case 'string':
      return s.enum ? { kind: 'enum', options: strings(s.enum) } : { kind: 'string', suggestions: [] }
    case 'integer':
    case 'number':
      return { kind: 'number', integer: s.type === 'integer', min: s.minimum, max: s.maximum }
    case 'array': {
      const items = withoutNull(s.items ?? {})
      return items.type === 'string' ? { kind: 'list', options: strings(items.enum) } : { kind: 'json' }
    }
    case 'object': {
      if (s.properties && Object.keys(s.properties).length > 0) {
        return { kind: 'object', properties: Object.entries(s.properties) }
      }
      const values = s.additionalProperties
      if (typeof values === 'object' && withoutNull(values).type === 'string') return { kind: 'map' }
      return { kind: 'json' }
    }
  }
  return { kind: 'json' }
}

// A value that does not fit its field is edited as JSON, so that nothing is lost.
export function fits(field: Field, value: unknown): boolean {
  if (value === undefined) return true
  switch (field.kind) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'list':
      return Array.isArray(value) && value.every((item) => typeof item === 'string')
    case 'map':
      return isPlainObject(value) && Object.values(value).every((item) => typeof item === 'string')
    case 'object':
      return isPlainObject(value)
    case 'json':
      return true
  }
}

// Many descriptions state the default, as in "(default: true)".
export function defaultOf(schema: JSONSchema | undefined): unknown {
  if (schema?.default !== undefined) return schema.default
  const match = /default:?\s*(true|false)\b/i.exec(schema?.description ?? '')
  return match ? match[1].toLowerCase() === 'true' : undefined
}

export function isDeprecated(schema: JSONSchema | undefined) {
  return /^deprecated\b/i.test(schema?.description ?? '')
}

// Claude Code marks settings that only a launching program may pass, and that
// settings files ignore.
export function isInternal(schema: JSONSchema | undefined) {
  return (schema?.description ?? '').startsWith('@internal')
}

// Settings that only work when an administrator deploys them. The schema says so
// only in the description, as in "Only honored from managed settings".
const managedOnly =
  /(?:^|[.(;]\s*)(?:read from )?managed settings only|only (?:honou?red|read)\b[^.]{0,40}?\b(?:from|in) (?:admin-controlled|managed|policy)|\((?:and )?set in (?:device )?managed settings|^when set in managed settings|^enterprise /i

export function isManagedOnly(schema: JSONSchema | undefined) {
  return managedOnly.test(schema?.description ?? '')
}

function withoutNull(schema: JSONSchema): JSONSchema {
  if (!schema.anyOf) return schema
  const options = schema.anyOf.filter((option) => option.type !== 'null')
  if (options.length === 1) return { ...options[0], description: schema.description ?? options[0].description }
  return { ...schema, anyOf: options }
}

function strings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string')
}
