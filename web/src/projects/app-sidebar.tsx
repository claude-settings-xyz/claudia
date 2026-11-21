import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, X } from 'lucide-react'
import { useState } from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { IconTile, Logo } from '@/components/tiles'
import { api, queries } from '@/lib/api'
import { navigate, shortPath } from '@/lib/location'
import { notify } from '@/lib/notify'
import { AddFolderDialog } from '@/projects/add-folder-dialog'
import { VersionInfo } from '@/projects/version-info'

export function AppSidebar({ current }: { current: string }) {
  const client = useQueryClient()
  const projects = useQuery(queries.projects())
  const health = useQuery(queries.health())
  const [filter, setFilter] = useState('')
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
  const visible = (projects.data ?? []).filter((project) =>
    project.path.toLowerCase().includes(query),
  )

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center gap-2.5 px-4 pt-5 pb-3">
        <Logo />
        <span className="font-heading text-lg font-semibold tracking-tight">Claudia</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={current === ''}
                onClick={() => navigate({ dir: '' })}
                className="h-auto gap-3 py-2"
              >
                <IconTile size="sm">
                  <Globe />
                </IconTile>
                <span className="font-medium">Global</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <AddFolderDialog />
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarInput
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter projects"
              aria-label="Filter projects"
            />
            <SidebarMenu>
              {projects.isPending &&
                Array.from({ length: 5 }, (_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))}
              {projects.isError && (
                <p className="px-2 text-sm text-destructive">{projects.error.message}</p>
              )}
              {projects.isSuccess && visible.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">
                  {query
                    ? 'No matching projects.'
                    : 'No folders with Claude files yet. Use + to add one.'}
                </p>
              )}
              {visible.map((project) => (
                <SidebarMenuItem key={project.path}>
                  <SidebarMenuButton
                    isActive={project.path === current}
                    onClick={() => navigate({ dir: project.path })}
                    title={project.path}
                    className="h-auto flex-col items-start gap-0 py-2"
                  >
                    <span className="w-full truncate font-medium">{project.name}</span>
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {shortPath(project.path, home)}
                    </span>
                  </SidebarMenuButton>
                  {project.saved && (
                    <SidebarMenuAction
                      showOnHover
                      title="Remove from list"
                      onClick={() => remove.mutate(project.path)}
                    >
                      <X />
                      <span className="sr-only">Remove {project.name} from list</span>
                    </SidebarMenuAction>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3">
        <VersionInfo />
      </SidebarFooter>
    </Sidebar>
  )
}
