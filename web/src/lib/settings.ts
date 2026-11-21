import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api, queries, type ConfigFile, type FileRef, type Kind } from '@/lib/api'
import { notify } from '@/lib/notify'

export type SkillVisibility = 'on' | 'name-only' | 'user-invocable-only' | 'off'

export type Settings = Record<string, unknown> & {
  enabledPlugins?: Record<string, boolean>
  skillOverrides?: Record<string, SkillVisibility>
}

export function parseSettings(file: ConfigFile): Settings | null {
  if (!file.exists || file.content.trim() === '') return {}
  try {
    const value = JSON.parse(file.content)
    return isPlainObject(value) ? value : null
  } catch {
    return null
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Sets a nested value. undefined removes it, and objects left empty are removed too.
export function setPath(target: Record<string, unknown>, path: string[], value: unknown) {
  const [key, ...rest] = path
  if (rest.length === 0) {
    if (value === undefined) delete target[key]
    else target[key] = value
    return
  }
  const child = isPlainObject(target[key]) ? { ...target[key] } : {}
  setPath(child, rest, value)
  if (Object.keys(child).length > 0) target[key] = child
  else delete target[key]
}

// Changes a settings file. The file is read again just before each change, so
// that recent writes from Claude Code are kept. Changes to one file run in order.
export function useUpdateSettings(dir: string, kind: Kind = 'settings') {
  const client = useQueryClient()
  const target: FileRef = { dir, kind }

  return useMutation({
    scope: { id: `settings:${dir}:${kind}` },
    mutationFn: async (change: (settings: Settings) => void) => {
      const file = await client.fetchQuery({ ...queries.file(target), staleTime: 0 })
      const settings = parseSettings(file)
      if (!settings) throw new Error('Fix the JSON in the Settings tab first.')

      change(settings)
      const newline = !file.exists || file.content.endsWith('\n') ? '\n' : ''
      return api.saveFile(target, JSON.stringify(settings, null, 2) + newline, file.version)
    },
    onSuccess: (file) => client.setQueryData(queries.file(target).queryKey, file),
    onError: (error) => notify.error('Could not save settings', error.message),
  })
}
