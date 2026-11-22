import { useQuery } from '@tanstack/react-query'
import { Store } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { queries, type Marketplace } from '@/lib/api'
import { isPlainObject, parseSettings } from '@/lib/settings'

type Entry = { name: string; source?: Record<string, unknown> }

// The marketplaces that global settings declare in extraKnownMarketplaces, and
// the ones that Claude Code downloaded. All projects share the downloads.
export function MarketplacesPanel() {
  const downloaded = useQuery(queries.marketplaces())
  const settings = useQuery(queries.file({ dir: '', kind: 'settings' }))

  if (downloaded.isPending || settings.isPending) return <Skeleton className="h-48" />
  if (downloaded.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load marketplaces</AlertTitle>
        <AlertDescription>{downloaded.error.message}</AlertDescription>
      </Alert>
    )
  }

  const value = settings.data && parseSettings(settings.data)?.extraKnownMarketplaces
  const declared: Entry[] = isPlainObject(value)
    ? Object.entries(value).map(([name, entry]) => ({
        name,
        source: isPlainObject(entry) && isPlainObject(entry.source) ? entry.source : undefined,
      }))
    : []
  const names = new Set(declared.map((entry) => entry.name))
  const entries = [
    ...declared,
    ...downloaded.data.filter((market) => !names.has(market.name)).map(({ name, source }) => ({ name, source })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const byName = new Map(downloaded.data.map((market) => [market.name, market]))

  if (entries.length === 0) {
    return (
      <EmptyState icon={<Store />} title="No marketplaces">
        Add one in Claude Code with <code>/plugin marketplace add</code>.
      </EmptyState>
    )
  }

  return (
    <ul className="divide-y divide-border/60 rounded-3xl bg-card shadow-panel">
      {entries.map((entry) => (
        <Row key={entry.name} entry={entry} download={byName.get(entry.name)} />
      ))}
    </ul>
  )
}

function Row({ entry, download }: { entry: Entry; download?: Marketplace }) {
  const plugins = download && `${download.plugins} ${download.plugins === 1 ? 'plugin' : 'plugins'}`
  const updated = download?.lastUpdated && `updated ${download.lastUpdated.slice(0, 10)}`
  const details = download ? [plugins, updated].filter(Boolean).join(' · ') : 'Not downloaded yet'

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
      <span className="font-semibold">{entry.name}</span>
      <span className="text-muted-foreground">{describe(entry.source ?? download?.source)}</span>
      <span className="ml-auto text-xs text-muted-foreground">{details}</span>
    </li>
  )
}

// Sources look like {source: "github", repo: "owner/name"} or {source: "url", url: "…"}.
function describe(source?: Record<string, unknown>) {
  if (!source) return ''
  const kind = String(source.source ?? '')
  const where = source.repo ?? source.url ?? source.path ?? ''
  return where ? `${kind}:${where}` : JSON.stringify(source)
}
