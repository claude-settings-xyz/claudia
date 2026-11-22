import { useQuery } from '@tanstack/react-query'
import { Puzzle } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/empty-state'
import { queries, type Plugin } from '@/lib/api'
import { parseSettings, setPath, useUpdateSettings } from '@/lib/settings'

// undefined removes the plugin from this scope, so the global choice applies.
type Choice = boolean | undefined

export function PluginsPanel({ dir }: { dir: string }) {
  const catalog = useQuery(queries.plugins())
  const scope = useQuery(queries.file({ dir, kind: 'settings' }))
  const global = useQuery(queries.file({ dir: '', kind: 'settings' }))
  const update = useUpdateSettings(dir)
  const [search, setSearch] = useState('')
  const [show, setShow] = useState<'installed' | 'all'>('installed')

  function choose(id: string, choice: Choice) {
    update.mutate((settings) => setPath(settings, ['enabledPlugins', id], choice))
  }

  if (catalog.isPending || scope.isPending || global.isPending) {
    return <Skeleton className="h-64" />
  }
  if (catalog.isError || scope.isError || global.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load plugins</AlertTitle>
        <AlertDescription>
          {(catalog.error ?? scope.error ?? global.error)?.message}
        </AlertDescription>
      </Alert>
    )
  }

  const scopeSettings = parseSettings(scope.data)
  const scopeEnabled = scopeSettings?.enabledPlugins ?? {}
  const globalEnabled = parseSettings(global.data)?.enabledPlugins ?? {}
  // The marketplace name only helps to tell plugins apart when there are several.
  const manyMarketplaces = new Set(catalog.data.map((plugin) => plugin.marketplace)).size > 1
  const plugins = listPlugins(catalog.data, { ...globalEnabled, ...scopeEnabled }, show, search)

  return (
    <div className="flex flex-col gap-4">
      {!scopeSettings && (
        <Alert variant="destructive">
          <AlertTitle>settings.json is not valid JSON</AlertTitle>
          <AlertDescription>Fix it in the Settings tab before you change plugins.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search plugins"
          className="max-w-xs"
        />
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[show]}
          onValueChange={([value]) => value && setShow(value as typeof show)}
        >
          <ToggleGroupItem value="installed">Installed</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {plugins.length === 0 ? (
        <EmptyState icon={<Puzzle />} title="No plugins found" />
      ) : (
        <ul className="divide-y divide-border/60 rounded-3xl bg-card px-5 shadow-panel">
          {plugins.map((plugin) => (
            <li key={plugin.id} className="flex items-start gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{plugin.name}</span>
                  {manyMarketplaces && plugin.marketplace && (
                    <span className="text-xs text-muted-foreground">{plugin.marketplace}</span>
                  )}
                  <InstallStatus plugin={plugin} dir={dir} />
                </div>
                {plugin.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {plugin.description}
                  </p>
                )}
              </div>

              {dir ? (
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  disabled={!scopeSettings || update.isPending}
                  value={[choiceValue(scopeEnabled[plugin.id])]}
                  onValueChange={([value]) => value && choose(plugin.id, parseChoice(value))}
                  aria-label={`${plugin.name} in this folder`}
                >
                  <ToggleGroupItem value="inherit">
                    Inherit ({globalEnabled[plugin.id] ? 'on' : 'off'})
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="on"
                    className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
                  >
                    On
                  </ToggleGroupItem>
                  <ToggleGroupItem value="off">Off</ToggleGroupItem>
                </ToggleGroup>
              ) : (
                <Switch
                  disabled={!scopeSettings || update.isPending}
                  checked={scopeEnabled[plugin.id] === true}
                  onCheckedChange={(checked) => choose(plugin.id, checked)}
                  aria-label={plugin.name}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Only the unusual states get a word. An installed plugin just shows its version.
function InstallStatus({ plugin, dir }: { plugin: Plugin; dir: string }) {
  if (plugin.installs.length === 0) return <Badge variant="outline">Not installed</Badge>

  const here = plugin.installs.some(
    (install) => install.scope === 'user' || (dir && install.projectPath === dir),
  )
  const version = plugin.installs.find((install) => install.version)?.version
  return (
    <span className="text-xs text-muted-foreground">
      {!here && 'Installed in another folder'}
      {!here && version && ' · '}
      {version}
    </span>
  )
}

function listPlugins(
  catalog: Plugin[],
  referenced: Record<string, boolean>,
  show: 'installed' | 'all',
  search: string,
) {
  const byID = new Map(catalog.map((plugin) => [plugin.id, plugin]))

  // Settings can mention plugins that are not in any catalog, such as built-in ones.
  for (const id of Object.keys(referenced)) {
    if (byID.has(id)) continue
    const [name, marketplace = ''] = id.split('@')
    byID.set(id, { id, name, marketplace, installs: [] })
  }

  const query = search.trim().toLowerCase()
  return [...byID.values()].filter((plugin) => {
    if (show === 'installed' && plugin.installs.length === 0 && !(plugin.id in referenced)) {
      return false
    }
    if (!query) return true
    return [plugin.name, plugin.marketplace, plugin.description, plugin.category].some((text) =>
      text?.toLowerCase().includes(query),
    )
  })
}

function choiceValue(choice: Choice) {
  if (choice === undefined) return 'inherit'
  return choice ? 'on' : 'off'
}

function parseChoice(value: string): Choice {
  if (value === 'inherit') return undefined
  return value === 'on'
}
