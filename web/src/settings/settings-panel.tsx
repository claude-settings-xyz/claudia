import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileEditor } from '@/files/file-editor'
import { queries, type Kind } from '@/lib/api'
import { cn } from '@/lib/ui'
import { SettingsForm } from '@/settings/settings-form'

type View = 'visual' | 'json'

const files: Record<string, { label: string; name: string; tone: string }> = {
  settings: { label: 'Shared', name: 'settings.json', tone: 'aria-pressed:border-committed aria-pressed:text-committed' },
  'settings-local': { label: 'Local', name: 'settings.local.json', tone: 'aria-pressed:border-gitignored aria-pressed:text-gitignored' },
}

// Every file and view stays mounted, so that switching keeps unsaved JSON edits.
// The active one puts its search field or buttons into the toolbar.
export function SettingsPanel({ dir }: { dir: string }) {
  const shared = useQuery(queries.file({ dir, kind: 'settings' }))
  const local = useQuery({ ...queries.file({ dir, kind: 'settings-local' }), enabled: dir !== '' })
  const [chosen, setChosen] = useState<Kind>('settings')
  const [creating, setCreating] = useState<Kind | null>(null)
  const [view, setView] = useState<View>('visual')
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)

  // A project shows the files that exist, and the one you chose to create.
  // Without any, it edits the shared file, which is created on the first change.
  const exists: Partial<Record<Kind, boolean>> = {
    settings: shared.data?.exists,
    'settings-local': local.data?.exists,
  }
  const all: Kind[] = dir ? ['settings', 'settings-local'] : ['settings']
  let kinds = all.filter((each) => exists[each] || each === creating)
  if (kinds.length === 0) kinds = ['settings']
  const missing = all.filter((each) => !kinds.includes(each))
  const kind = kinds.includes(chosen) ? chosen : kinds[0]

  const client = useQueryClient()
  const fileKeys = ['file', dir]
  const schema = queries.schema().queryKey
  const refreshing = useIsFetching({ queryKey: fileKeys }) + useIsFetching({ queryKey: schema }) > 0

  // Reads the files and the schema again, for example after Claude Code changed them.
  function refresh() {
    client.invalidateQueries({ queryKey: fileKeys })
    client.invalidateQueries({ queryKey: schema })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {kinds.length > 1 && (
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[kind]}
            onValueChange={([value]) => value && setChosen(value as Kind)}
          >
            {kinds.map((each) => (
              <Tooltip key={each}>
                <TooltipTrigger render={<ToggleGroupItem value={each} className={files[each].tone} />}>{files[each].label}</TooltipTrigger>
                <TooltipContent className="font-mono">{files[each].name}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        )}
        <div ref={setToolbar} className="flex min-w-0 flex-1 items-center gap-2" />
        <div className="flex items-center gap-1">
          <ToggleGroup
            variant="outline"
            size="sm"
            className="mr-2"
            value={[view]}
            onValueChange={([value]) => value && setView(value as View)}
          >
            <ToggleGroupItem value="visual">Visual</ToggleGroupItem>
            <ToggleGroupItem value="json">JSON</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Reload from disk"
            aria-label="Reload from disk"
            onClick={refresh}
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
          </Button>
          {missing.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" title="More" aria-label="More" />}>
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                {missing.map((each) => (
                  <DropdownMenuItem
                    key={each}
                    onClick={() => {
                      setCreating(each)
                      setChosen(each)
                    }}
                  >
                    Create <span className="font-mono">{files[each].name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {kinds.map((each) => {
        const active = each === kind
        return (
          <div key={each} className={active ? 'min-h-0 flex-1' : 'hidden'}>
            <div className={view === 'visual' ? 'h-full overflow-y-auto rounded-lg' : 'hidden'}>
              <SettingsForm
                dir={dir}
                kind={each}
                toolbar={active && view === 'visual' ? toolbar : null}
                onShowJSON={() => setView('json')}
              />
            </div>
            <div className={view === 'json' ? 'h-full' : 'hidden'}>
              <FileEditor dir={dir} kind={each} toolbar={active && view === 'json' ? toolbar : null} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
