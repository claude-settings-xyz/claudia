import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, List, ListTree, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/components/tiles'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from '@/components/ui/sidebar'
import { api, queries } from '@/lib/api'
import { navigate, shortPath, type Tab } from '@/lib/location'
import { notify } from '@/lib/notify'
import { parseSettings } from '@/lib/settings'
import { cn } from '@/lib/ui'
import { AddFolderDialog } from '@/projects/add-folder-dialog'
import { ProjectTree } from '@/projects/project-tree'
import { useStoredState } from '@/projects/stored-state'
import { sections } from '@/sections'

// Projects on top, the sections of the selected scope at the bottom. Without a
// selected project, the sections show the global configuration.
export function AppSidebar({ current, tab }: { current: string; tab: Tab }) {
  const { toggleSidebar } = useSidebar()

  return (
    <>
      <Sidebar className="ease-out">
        <SidebarHeader className={cn('h-12 flex-row items-center border-b border-sidebar-border bg-background px-2', materialize)}>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Hide sidebar (⌘B)"
            aria-label="Hide sidebar"
            className="flex h-9 items-center gap-2 rounded-xl px-2 transition-colors hover:bg-sidebar-accent"
          >
            <Logo className="size-5" />
            <span className="font-heading text-sm font-bold tracking-tight">claudia</span>
          </button>
        </SidebarHeader>
        <SidebarContent className={cn('gap-0', materialize)}>
          <Projects current={current} />
          <Sections dir={current} tab={tab} />
        </SidebarContent>
      </Sidebar>
      <FloatingLogo />
    </>
  )
}

// The panel slides while its contents fade in and come into focus.
const materialize =
  'transition-[opacity,filter] duration-300 ease-out group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:blur-sm'

// While the sidebar is hidden, the logo stays where it was and brings the sidebar back.
function FloatingLogo() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar()
  const visible = isMobile ? !openMobile : !open

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title="Show sidebar (⌘B)"
      aria-label="Show sidebar"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'fixed top-1.5 left-2 z-20 grid size-9 place-items-center transition-opacity duration-200 ease-out',
        !visible && 'pointer-events-none opacity-0',
      )}
    >
      <Logo className="size-5" />
    </button>
  )
}

function Projects({ current }: { current: string }) {
  const client = useQueryClient()
  const projects = useQuery(queries.projects())
  const health = useQuery(queries.health())
  const [filter, setFilter] = useState('')
  const [view, setView] = useStoredState<'list' | 'tree'>('claudia.projects.view', 'tree')
  const [adding, setAdding] = useState(false)
  const home = health.data?.home

  const remove = useMutation({
    mutationFn: api.removeProject,
    onSuccess: (_, path) => {
      client.invalidateQueries({ queryKey: queries.projects().queryKey })
      if (path === current) navigate({ dir: '' })
    },
    onError: (error) => notify.error('Could not remove the folder', error.message),
  })

  const query = filter.trim().toLowerCase()
  const visible = (projects.data ?? []).filter((project) => project.path.toLowerCase().includes(query))

  return (
    // Until you point at it, the background is close to the header color and the list is dim.
    <SidebarGroup className="group/projects min-h-0 flex-1 bg-[color-mix(in_oklab,var(--sidebar)_40%,var(--background))] transition-colors duration-150 focus-within:bg-sidebar hover:bg-sidebar">
      <SidebarGroupContent className="flex min-h-0 flex-1 flex-col gap-2 opacity-75 transition-opacity duration-150 group-focus-within/projects:opacity-100 group-hover/projects:opacity-100">
        <div className="flex items-center gap-2">
          <SidebarInput
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter projects"
            aria-label="Filter projects"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-sm" className="shrink-0" title="Projects" aria-label="Projects menu" />}
            >
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setAdding(true)}>
                <Plus />
                Add project…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={view} onValueChange={(value) => setView(value as typeof view)}>
                <DropdownMenuRadioItem value="list" closeOnClick>
                  <List />
                  List view
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="tree" closeOnClick>
                  <ListTree />
                  Tree view
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <AddFolderDialog open={adding} onOpenChange={setAdding} />
        </div>
        <SidebarMenu className="min-h-0 flex-1 overflow-y-auto">
          {projects.isPending &&
            Array.from({ length: 5 }, (_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}
          {projects.isError && <p className="px-2 text-sm text-destructive">{projects.error.message}</p>}
          {projects.isSuccess && visible.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">
              {query ? 'No matching projects.' : 'No folders with Claude files yet. To add one, use the ⋯ menu.'}
            </p>
          )}
          {view === 'tree' && projects.isSuccess && (
            <ProjectTree
              projects={visible}
              current={current}
              home={home}
              filtering={query !== ''}
              onRemove={(project) => remove.mutate(project.path)}
            />
          )}
          {view === 'list' && visible.map((project) => {
            const active = project.path === current
            return (
              <SidebarMenuItem key={project.path}>
                <SidebarMenuButton
                  isActive={active}
                  // Selecting the open project again goes back to the global view.
                  onClick={() => navigate({ dir: active ? '' : project.path })}
                  title={active ? 'Back to global' : project.path}
                  className="h-auto flex-col items-start gap-0 py-1.5"
                >
                  <span className="w-full truncate font-semibold">{project.name}</span>
                  <span className="w-full truncate text-[11px] text-dim">
                    {shortPath(project.path, home)}
                  </span>
                </SidebarMenuButton>
                {project.saved && (
                  <SidebarMenuAction showOnHover title="Remove from list" onClick={() => remove.mutate(project.path)}>
                    <X />
                    <span className="sr-only">Remove {project.name} from list</span>
                  </SidebarMenuAction>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function Sections({ dir, tab }: { dir: string; tab: Tab }) {
  const counts = useCounts(dir)
  return (
    <SidebarGroup className="shrink-0 border-t border-sidebar-border bg-background py-3">
      <SidebarMenu>
        {sections.map((section) => (
          <SidebarMenuItem key={section.tab}>
            <SidebarMenuButton
              isActive={section.tab === tab}
              onClick={() => navigate({ tab: section.tab })}
              className={cn('data-active:bg-transparent', section.color)}
            >
              <section.icon />
              <span>{section.label}</span>
            </SidebarMenuButton>
            {!!counts[section.tab] && (
              <SidebarMenuBadge className="text-dim tabular-nums">{counts[section.tab]}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function useCounts(dir: string): Partial<Record<Tab, number>> {
  const skills = useQuery(queries.skills(dir))
  const memory = useQuery(queries.memory(dir))
  const mcp = useQuery(queries.mcp(dir))
  const settings = useQuery(queries.file({ dir, kind: 'settings' }))
  const enabled = (settings.data && parseSettings(settings.data)?.enabledPlugins) ?? {}
  return {
    skills: skills.data?.length,
    plugins: Object.values(enabled).filter((on) => on === true).length,
    memory: memory.data?.notes.filter((note) => !note.index).length,
    mcp: mcp.data?.filter((server) => !dir || server.scope !== 'user').length,
  }
}
