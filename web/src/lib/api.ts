import { queryOptions } from '@tanstack/react-query'

export type Health = { app: string; version: string; home: string }

export type Project = { path: string; name: string; saved: boolean }

export type Kind = 'settings' | 'settings-local' | 'claude-md' | 'skill' | 'memory-note'

// An empty dir means the global scope. Skill files also need the skill name.
export type FileRef = { dir: string; kind: Kind; name?: string }

export type ConfigFile = {
  path: string
  exists: boolean
  content: string
  version: string
}

export type Install = { scope: string; projectPath?: string; version?: string }

// The two flags come from the frontmatter of SKILL.md, which skillOverrides cannot change.
// Servers before 0.2.0 leave them out.
export type Skill = { name: string; description: string; path: string; modelInvocable?: boolean; userInvocable?: boolean }

// user: every folder. local: one folder, only you. project: .mcp.json, shared.
export type MCPScope = 'user' | 'local' | 'project'
export type MCPServer = { name: string; scope: MCPScope; config: Record<string, unknown> }

// Claude's auto memory. index is true for MEMORY.md.
export type Memory = { enabled: boolean; notes: { name: string; index: boolean }[] }

// A JSON Schema, as zod writes it. Only the parts that the settings form reads.
export type JSONSchema = {
  type?: string
  description?: string
  enum?: unknown[]
  const?: unknown
  anyOf?: JSONSchema[]
  items?: JSONSchema
  properties?: Record<string, JSONSchema>
  additionalProperties?: JSONSchema | boolean
  default?: unknown
  minimum?: number
  maximum?: number
}

export type SettingsSchema = { version: string; binary: string; schema: JSONSchema }

export type Marketplace = { name: string; source: Record<string, unknown>; lastUpdated?: string; plugins: number }

export type Plugin = {
  id: string
  name: string
  marketplace: string
  description?: string
  category?: string
  installs: Install[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(sentence(message))
    this.status = status
  }
}

// The server sends Go-style errors, which start in lowercase and have no period.
function sentence(message: string) {
  const text = message.charAt(0).toUpperCase() + message.slice(1)
  return /[.!?]$/.test(text) ? text : `${text}.`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'X-Claudia': '1', 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function fileURL({ dir, kind, name }: FileRef) {
  const params = new URLSearchParams({ kind })
  if (dir) params.set('dir', dir)
  if (name) params.set('name', name)
  return `/api/files?${params}`
}

function scopeQuery(dir: string) {
  return dir ? `?${new URLSearchParams({ dir })}` : ''
}

export const api = {
  addProject: (path: string) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ path }) }),
  // Opens the system folder dialog. The path is empty when it is canceled.
  pickFolder: () => request<{ path: string }>('/api/pick-folder', { method: 'POST' }),
  saveMCP: (body: { dir: string; scope: MCPScope; name: string; config: object; previous?: MCPServer }) =>
    request<void>('/api/mcp', { method: 'PUT', body: JSON.stringify(body) }),
  deleteMCP: (dir: string, { scope, name }: MCPServer) =>
    request<void>(`/api/mcp?${new URLSearchParams({ dir, scope, name })}`, { method: 'DELETE' }),
  deleteFile: (ref: FileRef) => request<void>(fileURL(ref), { method: 'DELETE' }),
  removeProject: (path: string) =>
    request<void>(`/api/projects?${new URLSearchParams({ path })}`, { method: 'DELETE' }),
  saveFile: (ref: FileRef, content: string, version: string) =>
    request<ConfigFile>(fileURL(ref), {
      method: 'PUT',
      body: JSON.stringify({ content, version }),
    }),
}

export const queries = {
  health: () =>
    queryOptions({
      queryKey: ['health'],
      queryFn: () => request<Health>('/api/health'),
      staleTime: Infinity,
    }),
  projects: () =>
    queryOptions({
      queryKey: ['projects'],
      queryFn: () => request<Project[]>('/api/projects'),
    }),
  file: (ref: FileRef) =>
    queryOptions({
      queryKey: ['file', ref.dir, ref.kind, ref.name ?? ''],
      queryFn: () => request<ConfigFile>(fileURL(ref)),
    }),
  mcp: (dir: string) =>
    queryOptions({
      queryKey: ['mcp', dir],
      queryFn: () => request<MCPServer[]>(`/api/mcp${scopeQuery(dir)}`),
    }),
  memory: (dir: string) =>
    queryOptions({
      queryKey: ['memory', dir],
      queryFn: () => request<Memory>(`/api/memory${scopeQuery(dir)}`),
    }),
  skills: (dir: string) =>
    queryOptions({
      queryKey: ['skills', dir],
      queryFn: () => request<Skill[]>(`/api/skills${scopeQuery(dir)}`),
    }),
  schema: () =>
    queryOptions({
      queryKey: ['schema'],
      queryFn: () => request<SettingsSchema>('/api/schema'),
      staleTime: 60_000,
    }),
  marketplaces: () =>
    queryOptions({
      queryKey: ['marketplaces'],
      queryFn: () => request<Marketplace[]>('/api/marketplaces'),
    }),
  plugins: () =>
    queryOptions({
      queryKey: ['plugins'],
      queryFn: () => request<Plugin[]>('/api/plugins'),
    }),
}
