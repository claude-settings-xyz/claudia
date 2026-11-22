import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { queries, type JSONSchema, type Kind } from '@/lib/api'
import { parseSettings, setPath, useUpdateSettings } from '@/lib/settings'
import { SettingRow } from '@/settings/controls'
import { isInternal, isManagedOnly } from '@/settings/fields'

// The Plugins and Skills tabs edit these.
const hidden = new Set(['$schema', 'enabledPlugins', 'skillOverrides'])

// toolbar is where the search field goes. null hides it.
type Props = { dir: string; kind: Kind; toolbar: Element | null; onShowJSON: () => void }

export function SettingsForm({ dir, kind, toolbar, onShowJSON }: Props) {
  const schema = useQuery(queries.schema())
  const file = useQuery(queries.file({ dir, kind }))
  const update = useUpdateSettings(dir, kind)
  const [search, setSearch] = useState('')
  const [showManaged, setShowManaged] = useState(false)

  if (schema.isPending || file.isPending) return <Skeleton className="h-64" />
  if (file.isError) {
    return <Problem title="Could not load the file" description={file.error.message} />
  }
  if (schema.isError) {
    return (
      <Problem
        title="Could not read the settings schema"
        description="Claudia reads the list of settings from the Claude Code on this computer. You can still edit the file as JSON."
        onShowJSON={onShowJSON}
      />
    )
  }

  const settings = parseSettings(file.data)
  if (!settings) {
    return (
      <Problem
        title="This file is not valid JSON"
        description="Fix it in the JSON view to use the form."
        onShowJSON={onShowJSON}
      />
    )
  }

  const properties = schema.data.schema.properties ?? {}
  const query = search.trim().toLowerCase()
  const matches = (key: string) =>
    !query ||
    key.toLowerCase().includes(query) ||
    (properties[key]?.description ?? '').toLowerCase().includes(query)

  const inFile = Object.keys(settings).filter((key) => !hidden.has(key) && matches(key))
  const available = Object.keys(properties)
    .filter((key) => !hidden.has(key) && !(key in settings) && !isInternal(properties[key]) && matches(key))
    .sort((a, b) => a.localeCompare(b))
  const others = available.filter((key) => !isManagedOnly(properties[key]))
  const managed = available.filter((key) => isManagedOnly(properties[key]))

  function change(path: string[], value: unknown) {
    update.mutate((current) => setPath(current, path, value))
  }

  const rows = (keys: string[]) =>
    keys.map((key) => (
      <SettingRow
        key={key}
        path={[key]}
        schema={properties[key] as JSONSchema | undefined}
        value={settings[key]}
        onChange={change}
      />
    ))

  return (
    <div className="flex flex-col gap-8 pb-8">
      {toolbar &&
        createPortal(
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="max-w-sm"
          />,
          toolbar,
        )}

      {/* Titles only help when both groups have settings. */}
      {inFile.length > 0 && others.length > 0 ? (
        <>
          <Section title="In this file" count={inFile.length}>
            {rows(inFile)}
          </Section>
          <Section title="More settings">{rows(others)}</Section>
        </>
      ) : (
        inFile.length + others.length > 0 && <Section>{rows([...inFile, ...others])}</Section>
      )}
      {managed.length > 0 && (
        <Section
          title="Organization settings"
          description="These settings only work when an administrator deploys them as managed settings."
          action={
            !query && (
              <Button variant="ghost" size="sm" onClick={() => setShowManaged(!showManaged)}>
                {showManaged ? 'Hide' : `Show ${managed.length}`}
              </Button>
            )
          }
        >
          {(showManaged || query) && rows(managed)}
        </Section>
      )}
      {inFile.length === 0 && available.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No settings match your search.</p>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  description,
  action,
  children,
}: {
  title?: string
  count?: number
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <h2 className="text-xs font-bold tracking-wider text-dim uppercase">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[11px] leading-4 font-semibold text-link tabular-nums">
              {count}
            </span>
          )}
          {action}
        </div>
      )}
      {description && <p className="px-1 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">{children}</div>}
    </section>
  )
}

function Problem({
  title,
  description,
  onShowJSON,
}: {
  title: string
  description: string
  onShowJSON?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onShowJSON && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onShowJSON}>
            Edit as JSON
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
