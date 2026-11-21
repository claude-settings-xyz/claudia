import { useQuery } from '@tanstack/react-query'
import { Brain, FileText, Globe, Puzzle, Server, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconTile, LetterTile } from '@/components/tiles'
import { FileEditor } from '@/files/file-editor'
import { queries } from '@/lib/api'
import { navigate, shortPath, useLocation, type Tab } from '@/lib/location'
import { parseSettings } from '@/lib/settings'
import { MCPPanel } from '@/mcp/mcp-panel'
import { MemoryPanel } from '@/memory/memory-panel'
import { PluginsPanel } from '@/plugins/plugins-panel'
import { AppSidebar } from '@/projects/app-sidebar'
import { SettingsPanel } from '@/settings/settings-panel'
import { SkillsPanel } from '@/skills/skills-panel'

export default function App() {
  const { dir, tab } = useLocation()
  const health = useQuery(queries.health())
  const skills = useQuery(queries.skills(dir))
  const memory = useQuery(queries.memory(dir))
  const mcp = useQuery(queries.mcp(dir))
  const settings = useQuery(queries.file({ dir, kind: 'settings' }))
  const name = dir ? (dir.split(/[\\/]/).filter(Boolean).pop() ?? dir) : 'Global'
  const pluginsOn = Object.values((settings.data && parseSettings(settings.data)?.enabledPlugins) ?? {}).filter(
    (on) => on === true,
  ).length

  return (
    <SidebarProvider>
      <AppSidebar current={dir} />
      <SidebarInset className="relative h-svh min-h-0 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_20%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
        />

        <header className="relative flex shrink-0 items-center gap-4 px-6 pt-5 pb-5">
          <SidebarTrigger className="-ml-2 text-muted-foreground" />
          {dir ? (
            <LetterTile name={name} size="lg" />
          ) : (
            <IconTile size="lg">
              <Globe />
            </IconTile>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {dir ? shortPath(dir, health.data?.home) : 'Applies to every folder'}
            </p>
          </div>
        </header>

        {/* key resets editors and their drafts when the folder changes */}
        <Tabs
          key={dir}
          value={tab}
          onValueChange={(value) => navigate({ tab: value as Tab })}
          className="relative min-h-0 flex-1 gap-0"
        >
          <div className="px-6 pb-4">
            <TabsList>
              <TabTrigger value="settings" icon={<SlidersHorizontal />} label="Settings" />
              <TabTrigger value="claude-md" icon={<FileText />} label="CLAUDE.md" />
              <TabTrigger
                value="memory"
                icon={<Brain />}
                label="Memory"
                count={memory.data?.notes.filter((note) => !note.index).length}
              />
              <TabTrigger
                value="mcp"
                icon={<Server />}
                label="MCP"
                count={mcp.data?.filter((server) => (dir ? server.scope !== 'user' : true)).length}
              />
              <TabTrigger value="skills" icon={<Sparkles />} label="Skills" count={skills.data?.length} />
              <TabTrigger value="plugins" icon={<Puzzle />} label="Plugins" count={pluginsOn} />
            </TabsList>
          </div>
          {/* keepMounted keeps unsaved edits when you switch tabs */}
          <TabsContent value="settings" keepMounted className={panelClass}>
            <SettingsPanel dir={dir} />
          </TabsContent>
          <TabsContent value="claude-md" keepMounted className={panelClass}>
            <FileEditor dir={dir} kind="claude-md" />
          </TabsContent>
          <TabsContent value="memory" keepMounted className={panelClass}>
            <MemoryPanel dir={dir} />
          </TabsContent>
          <TabsContent value="mcp" keepMounted className={panelClass}>
            <MCPPanel dir={dir} />
          </TabsContent>
          <TabsContent value="skills" keepMounted className={panelClass}>
            <SkillsPanel dir={dir} />
          </TabsContent>
          <TabsContent value="plugins" keepMounted className={`${panelClass} overflow-y-auto`}>
            <PluginsPanel dir={dir} />
          </TabsContent>
        </Tabs>
      </SidebarInset>
    </SidebarProvider>
  )
}

function TabTrigger({ value, icon, label, count }: { value: Tab; icon: ReactNode; label: string; count?: number }) {
  return (
    <TabsTrigger value={value} className="gap-2 px-3 data-active:[&>svg]:text-link">
      {icon}
      {label}
      {!!count && (
        <span className="rounded-full bg-primary/15 px-1.5 text-[11px] leading-4 font-semibold text-link tabular-nums">
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}

// Showing a panel replays the fade, so switching tabs feels smooth.
const panelClass = 'min-h-0 flex-1 px-6 pb-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-200'
