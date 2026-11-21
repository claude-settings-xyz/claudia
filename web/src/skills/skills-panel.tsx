import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FileEditor } from '@/files/file-editor'
import { queries, type FileRef, type Skill } from '@/lib/api'
import { confirmDiscard, fileKey } from '@/lib/location'
import { parseSettings, setPath, useUpdateSettings, type SkillVisibility } from '@/lib/settings'
import { EmptyState } from '@/components/empty-state'
import { LetterTile } from '@/components/tiles'
import { cn } from '@/lib/ui'
import { NewSkillDialog } from '@/skills/new-skill-dialog'
import { VisibilitySelect, visibilities } from '@/skills/visibility-select'

// A project shows its own skills and the global ones. dir is where the skill lives.
type Entry = Skill & { dir: string }

export function SkillsPanel({ dir }: { dir: string }) {
  const own = useQuery(queries.skills(dir))
  const global = useQuery(queries.skills(''))
  const scopeFile = useQuery(queries.file({ dir, kind: 'settings' }))
  const globalFile = useQuery(queries.file({ dir: '', kind: 'settings' }))
  const update = useUpdateSettings(dir)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

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
    setSelected(entryKey(entry))
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
          <NewSkillDialog
            dir={dir}
            onCreated={(name) => setSelected(entryKey({ name, dir }))}
          />
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
        {current ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-lg font-semibold">/{current.name}</h2>
              {dir && !current.dir && <Badge variant="secondary">Global</Badge>}
              <VisibilitySelect
                value={dir ? scopeOverrides[current.name] : effective(current.name)}
                inherited={dir ? inherited(current.name) : undefined}
                disabled={!scopeSettings || update.isPending}
                onChange={(value) => choose(current.name, value)}
              />
            </div>
            <div className="min-h-0 flex-1">
              <FileEditor key={entryKey(current)} {...skillRef(current)} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Sparkles />} title="No skills yet">
            Create one with the + button.
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
              <LetterTile name={entry.name} size="sm" className={cn(state === 'off' && 'opacity-50')} />
              <span className={cn('min-w-0 flex-1 truncate font-medium', state === 'off' && 'text-muted-foreground')}>
                {entry.name}
              </span>
              {state !== 'on' && (
                <Badge variant="outline" className="shrink-0">
                  {visibilities[state].label}
                </Badge>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function GroupLabel({ className, children }: { className?: string; children: string }) {
  return (
    <h3 className={cn('px-3 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase', className)}>
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
