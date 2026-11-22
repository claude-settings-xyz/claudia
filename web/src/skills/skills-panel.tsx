import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FileEditor } from '@/files/file-editor'
import { api, queries, type FileRef, type Skill } from '@/lib/api'
import { confirmDiscard, fileKey } from '@/lib/location'
import { notify } from '@/lib/notify'
import { parseSettings, setPath, useUpdateSettings, type SkillVisibility } from '@/lib/settings'
import { EmptyState } from '@/components/empty-state'
import { ScopeBadge } from '@/components/scope-badge'
import { cn } from '@/lib/ui'
import { removeFrontmatterKey } from '@/skills/frontmatter'
import { NewSkillForm } from '@/skills/new-skill-form'
import { VisibilitySelect, visibilities } from '@/skills/visibility-select'

// A project shows its own skills and the global ones. dir is where the skill lives.
type Entry = Skill & { dir: string }

export function SkillsPanel({ dir, actions }: { dir: string; actions: Element | null }) {
  const own = useQuery(queries.skills(dir))
  const global = useQuery(queries.skills(''))
  const scopeFile = useQuery(queries.file({ dir, kind: 'settings' }))
  const globalFile = useQuery(queries.file({ dir: '', kind: 'settings' }))
  const update = useUpdateSettings(dir)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  // Changes when Claudia edits the open SKILL.md, so that the editor shows the new text.
  const [revision, setRevision] = useState(0)
  const unlock = useUnlock(() => setRevision((each) => each + 1))

  if (own.isPending || global.isPending || scopeFile.isPending || globalFile.isPending) {
    return <Skeleton className="h-64" />
  }
  if (own.isError || global.isError || scopeFile.isError || globalFile.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load skills</AlertTitle>
        <AlertDescription>
          {(own.error ?? global.error ?? scopeFile.error ?? globalFile.error)?.message}
        </AlertDescription>
      </Alert>
    )
  }

  const scopeSettings = parseSettings(scopeFile.data)
  const scopeOverrides = scopeSettings?.skillOverrides ?? {}
  const globalOverrides = parseSettings(globalFile.data)?.skillOverrides ?? {}

  const ownEntries = own.data.map((skill) => ({ ...skill, dir }))
  const globalEntries = dir ? global.data.map((skill) => ({ ...skill, dir: '' })) : []
  const all = [...ownEntries, ...globalEntries]
  const current = all.find((entry) => entryKey(entry) === selected) ?? all[0]

  // In a project, a missing override falls back to the global one.
  function inherited(name: string): SkillVisibility {
    return known((dir && globalOverrides[name]) || 'on')
  }
  function effective(name: string): SkillVisibility {
    return known(scopeOverrides[name] ?? inherited(name))
  }

  function select(entry: Entry) {
    if (current && !confirmDiscard([fileKey(skillRef(current))])) return
    setCreating(false)
    setSelected(entryKey(entry))
  }

  function removeLock(entry: Entry, key: string, title: string) {
    if (!confirmDiscard([fileKey(skillRef(entry))])) return
    unlock.mutate({ ref: skillRef(entry), key, title })
  }

  function choose(name: string, value: SkillVisibility | undefined) {
    // Absent means on, so the global scope removes the entry instead of writing "on".
    const stored = !dir && value === 'on' ? undefined : value
    update.mutate((settings) => setPath(settings, ['skillOverrides', name], stored))
  }

  const query = filter.trim().toLowerCase()
  const matches = (entry: Entry) =>
    !query || entry.name.includes(query) || entry.description.toLowerCase().includes(query)

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex min-h-0 w-80 shrink-0 flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter skills"
            aria-label="Filter skills"
          />
          <Button
            size="icon"
            variant="outline"
            className="shrink-0"
            title="New skill"
            aria-label="New skill"
            onClick={() => setCreating(true)}
          >
            <Plus />
          </Button>
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {dir && <GroupLabel>This project</GroupLabel>}
          <SkillList
            entries={ownEntries.filter(matches)}
            empty={dir ? 'No skills in this project yet.' : 'No skills yet.'}
            current={current}
            onSelect={select}
            visibility={(entry) => effective(entry.name)}
          />
          {dir && (
            <>
              <GroupLabel className="mt-4">Global</GroupLabel>
              <SkillList
                entries={globalEntries.filter(matches)}
                empty="No global skills."
                current={current}
                onSelect={select}
                visibility={(entry) => effective(entry.name)}
              />
            </>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {creating ? (
          <NewSkillForm
            dir={dir}
            actions={actions}
            onCreated={(name, created) => {
              setCreating(false)
              setSelected(entryKey({ name, dir: created }))
            }}
            onCancel={() => setCreating(false)}
          />
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-lg font-semibold">/{current.name}</h2>
              {dir && !current.dir && <ScopeBadge scope="global" />}
              <VisibilitySelect
                value={dir ? scopeOverrides[current.name] : effective(current.name)}
                locks={{ model: current.modelInvocable === false, user: current.userInvocable === false }}
                inherited={dir ? { value: inherited(current.name), global: current.name in globalOverrides } : undefined}
                disabled={!scopeSettings || update.isPending}
                onChange={(value) => choose(current.name, value)}
              />
            </div>
            {current.modelInvocable === false && (
              <LockNotice
                title="Only you can run this skill"
                flag="disable-model-invocation: true"
                text="so Claude never starts it on its own. The visibility setting cannot change that."
                action="Let Claude use it"
                busy={unlock.isPending}
                onAction={() => removeLock(current, 'disable-model-invocation', 'Claude can use it now')}
              />
            )}
            {current.userInvocable === false && (
              <LockNotice
                title="Only Claude can use this skill"
                flag="user-invocable: false"
                text="so it is not in your / menu. The visibility setting cannot change that."
                action="Let me run it"
                busy={unlock.isPending}
                onAction={() => removeLock(current, 'user-invocable', 'You can run it now')}
              />
            )}
            <div className="min-h-0 flex-1">
              <FileEditor key={`${entryKey(current)}:${revision}`} {...skillRef(current)} toolbar={actions} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Sparkles />} title="No skills yet">
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Add a skill
            </Button>
          </EmptyState>
        )}
      </section>
    </div>
  )
}

function SkillList({
  entries,
  empty,
  current,
  onSelect,
  visibility,
}: {
  entries: Entry[]
  empty: string
  current?: Entry
  onSelect: (entry: Entry) => void
  visibility: (entry: Entry) => SkillVisibility
}) {
  if (entries.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const state = visibility(entry)
        const active = current !== undefined && entryKey(current) === entryKey(entry)
        return (
          <li key={entryKey(entry)}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              aria-current={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:bg-muted/60',
                active && 'bg-card shadow-panel hover:bg-card',
              )}
            >
              <span className={cn('min-w-0 flex-1 truncate font-medium', state === 'off' && 'text-muted-foreground')}>
                {entry.name}
              </span>
              <StateBadge entry={entry} state={state} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// The SKILL.md can lock a skill to one side. Off still wins, because it hides the skill from both.
// Only an explicit false is a lock: older servers do not send the flags.
function StateBadge({ entry, state }: { entry: Entry; state: SkillVisibility }) {
  const label =
    state === 'off'
      ? visibilities.off.label
      : entry.modelInvocable === false
        ? visibilities['user-invocable-only'].label
        : entry.userInvocable === false
          ? 'Claude only'
          : state === 'on'
            ? null
            : visibilities[state].label
  if (!label) return null
  const locked = state !== 'off' && (entry.modelInvocable === false || entry.userInvocable === false)
  return (
    <Badge variant="outline" className="shrink-0" title={locked ? 'Set in its SKILL.md' : undefined}>
      {locked && <Lock data-icon="inline-start" />}
      {label}
    </Badge>
  )
}

function LockNotice({
  title,
  flag,
  text,
  action,
  busy,
  onAction,
}: {
  title: string
  flag: string
  text: string
  action: string
  busy: boolean
  onAction: () => void
}) {
  return (
    <Alert className="has-data-[slot=alert-action]:pr-40">
      <Lock />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        Its SKILL.md sets <code className="font-mono">{flag}</code>, {text}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" disabled={busy} onClick={onAction}>
          {action}
        </Button>
      </AlertAction>
    </Alert>
  )
}

// Removes a lock from the frontmatter of a SKILL.md. Undo puts the old text back.
function useUnlock(onChanged: () => void) {
  const client = useQueryClient()

  async function write(ref: FileRef, change: (text: string) => string) {
    const file = await client.fetchQuery({ ...queries.file(ref), staleTime: 0 })
    const saved = await api.saveFile(ref, change(file.content), file.version)
    client.setQueryData(queries.file(ref).queryKey, saved)
    client.invalidateQueries({ queryKey: ['skills'] })
    onChanged()
    return file.content
  }

  return useMutation({
    mutationFn: ({ ref, key }: { ref: FileRef; key: string; title: string }) =>
      write(ref, (text) => removeFrontmatterKey(text, key)),
    onSuccess: (before, { ref, title }) =>
      notify.done(title, 'Removed the line from its SKILL.md.', () =>
        write(ref, () => before).catch((error: Error) => notify.error('Could not undo', error.message)),
      ),
    onError: (error) => notify.error('Could not change the skill', error.message),
  })
}

function GroupLabel({ className, children }: { className?: string; children: string }) {
  return (
    <h3 className={cn('px-3 pb-2 text-xs font-bold tracking-wider text-dim uppercase', className)}>
      {children}
    </h3>
  )
}

// Settings edited by hand can hold any value. Show unknown ones as on.
function known(value: string): SkillVisibility {
  return value in visibilities ? (value as SkillVisibility) : 'on'
}

function entryKey(entry: { name: string; dir: string }) {
  return `${entry.dir}:${entry.name}`
}

function skillRef(entry: Entry): FileRef {
  return { dir: entry.dir, kind: 'skill', name: entry.name }
}
