import type { JSONSchema } from '@/lib/api'
import { isPlainObject, setPath, type Settings } from '@/lib/settings'
import { isManagedOnly } from '@/settings/fields'

// A change to the global settings file. "add" puts entries in a list and keeps the
// ones that are there. "remove" deletes a setting.
export type Change =
  | { kind: 'set'; path: string[]; value: unknown; done?: (current: unknown) => boolean }
  | { kind: 'add'; path: string[]; items: string[] }
  | { kind: 'remove'; path: string[] }

export type Group = 'cleanup' | 'privacy' | 'quiet' | 'long' | 'reading' | 'advanced'

export type Suggestion = {
  id: string
  group: Group
  title: string
  benefit: string
  tradeoff?: string
  changes: Change[]
}

export const groups: { id: Group; label: string }[] = [
  { id: 'cleanup', label: 'Clean up' },
  { id: 'privacy', label: 'Privacy and safety' },
  { id: 'quiet', label: 'Fewer interruptions' },
  { id: 'long', label: 'Long tasks' },
  { id: 'reading', label: 'Reading' },
  { id: 'advanced', label: 'Advanced' },
]

const set = (path: string, value: unknown, done?: (current: unknown) => boolean): Change => ({
  kind: 'set',
  path: path.split('.'),
  value,
  done,
})

// Most of these come from a real global settings file. Keep them current with Claude Code:
// a suggestion whose setting or value the installed schema does not know stays hidden.
const list: Suggestion[] = [
  {
    id: 'deep-links',
    group: 'privacy',
    title: 'Block links that open Claude Code',
    benefit: 'Websites and other apps can no longer start Claude Code through claude-cli:// links.',
    tradeoff: 'Links such as “Open in Claude Code” stop working.',
    changes: [set('disableDeepLinkRegistration', 'disable')],
  },
  {
    id: 'skill-shell',
    group: 'privacy',
    title: 'Stop skills from running commands on their own',
    benefit:
      'Skills and commands from you, your projects or plugins can no longer run shell commands inline. Claude Code shows a placeholder instead.',
    tradeoff: 'Skills that depend on inline commands lose that part.',
    changes: [set('disableSkillShellExecution', true)],
  },
  {
    id: 'cross-session',
    group: 'privacy',
    title: 'Hold messages from your other sessions',
    benefit: 'Another Claude Code session cannot make this one act. Its messages wait until you review them.',
    tradeoff: 'You approve each message yourself.',
    changes: [set('crossSessionInbound', 'hold')],
  },
  {
    id: 'connectors',
    group: 'privacy',
    title: 'Keep claude.ai connectors out of Claude Code',
    benefit:
      'Connectors that you turned on at claude.ai, such as mail or drive, do not connect to coding sessions. Fewer tools also take less of the context.',
    tradeoff: 'You use those connectors on claude.ai only.',
    changes: [set('disableClaudeAiConnectors', true)],
  },
  {
    id: 'local-skills',
    group: 'privacy',
    title: 'Keep skills and plugins local',
    benefit: 'Only the skills and plugins that you install for Claude Code load, so every session starts the same way.',
    tradeoff: 'Skills and plugins synced from claude.ai move to the trash at the next start.',
    changes: [set('syncClaudeAiSkills', false), set('syncClaudeAiPlugins', false)],
  },
  {
    id: 'secrets',
    group: 'privacy',
    title: 'Never read secret files',
    benefit: 'Claude cannot read .env files or a secrets folder, so keys and passwords stay out of the conversation.',
    tradeoff: 'Claude cannot help you edit those files.',
    changes: [{ kind: 'add', path: ['permissions', 'deny'], items: ['Read(./.env)', 'Read(./.env.*)', 'Read(./secrets/**)'] }],
  },
  {
    id: 'telemetry',
    group: 'privacy',
    title: 'Send less data',
    benefit: 'Claude Code stops sending usage data and error reports.',
    tradeoff: 'Anthropic gets fewer reports about the problems you run into.',
    changes: [set('env.DISABLE_TELEMETRY', '1'), set('env.DISABLE_ERROR_REPORTING', '1')],
  },
  {
    id: 'auto-mode',
    group: 'quiet',
    title: 'Ask only about risky steps',
    benefit: 'Auto mode lets Claude go ahead with actions that look safe and asks about the rest, so you see far fewer prompts.',
    tradeoff: 'You approve fewer steps one by one.',
    changes: [set('permissions.defaultMode', 'auto')],
  },
  {
    id: 'attribution',
    group: 'quiet',
    title: 'Leave Claude out of commits and pull requests',
    benefit: 'Commits and pull requests get no Co-Authored-By line, note or session link.',
    tradeoff: 'Reviewers cannot see that Claude helped.',
    changes: [set('attribution', { commit: '', pr: '', sessionUrl: false }, (current) => current === false)],
  },
  {
    id: 'feedback',
    group: 'quiet',
    title: 'Stop feedback drafts',
    benefit: 'Claude no longer drafts feedback reports for Anthropic, and the notices about them go away.',
    changes: [set('feedbackDrafts', 'off')],
  },
  {
    id: 'tips',
    group: 'quiet',
    title: 'Hide tips while Claude works',
    benefit: 'The spinner shows what Claude is doing, without tips.',
    changes: [set('spinnerTipsEnabled', false)],
  },
  {
    id: 'usage-limit',
    group: 'long',
    title: 'Continue after a usage limit',
    benefit: 'When you reach a usage limit, Claude waits for the reset and then carries on with the task.',
    tradeoff: 'The task uses your next usage window right away.',
    changes: [set('autoContinueAtUsageLimit', true)],
  },
  {
    id: 'wait',
    group: 'long',
    title: 'Wait for your answers',
    benefit:
      'Questions and permission requests stay open until you answer, even hours later from your phone. Nothing is cancelled or answered for you.',
    tradeoff: 'A task waits for you instead of moving on.',
    changes: [set('dialogExpiry', 'never'), set('askUserQuestionTimeout', 'never')],
  },
  {
    id: 'notify',
    group: 'long',
    title: 'Tell me when Claude needs me',
    benefit: 'Claude can send a notification to your phone when a task needs you.',
    tradeoff: 'You need the Claude app on your phone.',
    changes: [set('agentPushNotifEnabled', true)],
  },
  {
    id: 'history',
    group: 'long',
    title: 'Keep chat history for 10 years',
    benefit: 'Claude Code deletes chats after 30 days. Keep them, so that you can resume and search old sessions.',
    tradeoff: 'Old chats take disk space.',
    changes: [set('cleanupPeriodDays', 3650, (current) => typeof current === 'number' && current >= 3650)],
  },
  {
    id: 'fullscreen',
    group: 'reading',
    title: 'Use the flicker-free terminal',
    benefit: 'Output no longer flickers, and long sessions scroll smoothly.',
    tradeoff: 'You scroll back inside Claude Code, not in your terminal.',
    changes: [set('tui', 'fullscreen')],
  },
  {
    id: 'width',
    group: 'reading',
    title: 'Keep answers at a readable width',
    benefit: 'On a wide terminal, the text of answers wraps at 120 columns. Tables and code still use the full width.',
    changes: [set('maxProseWidth', 120)],
  },
  {
    id: 'effort',
    group: 'advanced',
    title: 'Think harder by default',
    benefit: 'Extra-high effort gives better results on hard tasks.',
    tradeoff: 'Answers take longer and use more of your usage limit.',
    changes: [set('effortLevel', 'xhigh')],
  },
  {
    id: 'git-instructions',
    group: 'advanced',
    title: 'Use only your own git rules',
    benefit:
      'Claude Code leaves its commit and pull request instructions out of the system prompt. Your CLAUDE.md rules apply alone, and the prompt is shorter.',
    tradeoff: 'Without rules of your own, Claude has less guidance for commits.',
    changes: [set('includeGitInstructions', false)],
  },
  {
    id: 'bundled-skills',
    group: 'advanced',
    title: 'Turn off the bundled skills',
    benefit: 'The skills and workflows that ship with Claude Code no longer load. The prompt is shorter, and only your skills run.',
    tradeoff: 'You lose the built-in skills. Built-in slash commands still work.',
    changes: [set('disableBundledSkills', true)],
  },
]

// The suggestions that would change something in this file.
export function pendingSuggestions(settings: Settings, schema: JSONSchema): Suggestion[] {
  const properties = schema.properties ?? {}
  // Claude Code only reads these from managed settings, so in this file they do nothing.
  const cleanup: Suggestion[] = Object.keys(settings)
    .filter((key) => isManagedOnly(properties[key]))
    .map((key) => ({
      id: `cleanup:${key}`,
      group: 'cleanup',
      title: 'Remove a setting that does nothing here',
      benefit: 'Claude Code only reads this setting from managed settings, which an administrator deploys. In this file it has no effect.',
      changes: [{ kind: 'remove', path: [key] }],
    }))

  const known = list.filter((suggestion) => suggestion.changes.every((change) => fits(schema, change)))
  return [...cleanup, ...known].filter((suggestion) => suggestion.changes.some((change) => !isDone(settings, change)))
}

export function valueAt(settings: Settings, path: string[]): unknown {
  let value: unknown = settings
  for (const key of path) {
    if (!isPlainObject(value)) return undefined
    value = value[key]
  }
  return value
}

export function applyChanges(settings: Settings, changes: Change[]) {
  for (const change of changes) {
    if (change.kind === 'set') setPath(settings, change.path, structuredClone(change.value))
    if (change.kind === 'remove') setPath(settings, change.path, undefined)
    if (change.kind === 'add') {
      const current = valueAt(settings, change.path)
      const list = Array.isArray(current) ? current : []
      setPath(settings, change.path, [...list, ...change.items.filter((item) => !list.includes(item))])
    }
  }
}

function isDone(settings: Settings, change: Change) {
  const current = valueAt(settings, change.path)
  if (change.kind === 'remove') return current === undefined
  if (change.kind === 'add') return Array.isArray(current) && change.items.every((item) => current.includes(item))
  return equal(current, change.value) || (change.done?.(current) ?? false)
}

// The installed Claude Code must know the setting, and the value if it lists the allowed ones.
function fits(schema: JSONSchema, change: Change) {
  let node: JSONSchema | undefined = schema
  for (const key of change.path) {
    const next: JSONSchema | boolean | undefined = node?.properties?.[key] ?? node?.additionalProperties
    if (!next || next === true) return next === true
    node = next
  }
  if (change.kind !== 'set' || !node) return node !== undefined
  const allowed = [...(node.enum ?? []), ...(node.anyOf ?? []).flatMap((option) => option.enum ?? [])]
  return allowed.length === 0 || allowed.includes(change.value) || (node.anyOf ?? []).some((option) => !option.enum)
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => equal(item, b[i]))
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => equal(a[key], b[key]))
  }
  return false
}
