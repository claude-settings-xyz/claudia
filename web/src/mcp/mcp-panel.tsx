import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Server } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { EmptyState } from '@/components/empty-state'
import { FormChoice, FormRow } from '@/components/form-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api, queries, type MCPScope, type MCPServer } from '@/lib/api'
import { notify } from '@/lib/notify'
import { isPlainObject } from '@/lib/settings'
import { cn } from '@/lib/ui'
import { ListControl, MapControl } from '@/settings/controls'

const scopeLabels: Record<MCPScope, string> = { user: 'Global', local: 'Local', project: 'Shared' }

const types = ['stdio', 'http', 'sse']

const serverKey = (server: { scope: string; name: string }) => `${server.scope}:${server.name}`

export function MCPPanel({ dir, actions }: { dir: string; actions: Element | null }) {
  const servers = useQuery(queries.mcp(dir))
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (servers.isPending) return <Skeleton className="h-64" />
  if (servers.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load MCP servers</AlertTitle>
        <AlertDescription>{servers.error.message}</AlertDescription>
      </Alert>
    )
  }

  const own = servers.data.filter((server) => !dir || server.scope !== 'user')
  const global = dir ? servers.data.filter((server) => server.scope === 'user') : []
  const current = creating ? undefined : (servers.data.find((s) => serverKey(s) === selected) ?? servers.data[0])

  const addButton = (
    <Button
      size="icon"
      variant="outline"
      className="shrink-0"
      title="New server"
      aria-label="New server"
      onClick={() => setCreating(true)}
    >
      <Plus />
    </Button>
  )

  if (servers.data.length === 0 && !creating) {
    return (
      <EmptyState icon={<Server />} title="No MCP servers">
        <div className="flex flex-col items-center gap-4">
          MCP servers give Claude tools, such as a database or an issue tracker.
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add a server
          </Button>
        </div>
      </EmptyState>
    )
  }

  function open(server: MCPServer) {
    setCreating(false)
    setSelected(serverKey(server))
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {dir ? 'This project' : 'Servers'}
          </span>
          {addButton}
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <ServerList servers={own} current={current} onOpen={open} showScope={!!dir} empty="None yet." />
          {dir && global.length > 0 && (
            <>
              <h3 className="mt-4 px-3 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Global
              </h3>
              <ServerList servers={global} current={current} onOpen={open} />
            </>
          )}
        </div>
      </aside>

      <section className="min-h-0 min-w-0 flex-1">
        <ServerForm
          key={creating ? 'new' : current && serverKey(current)}
          dir={dir}
          actions={actions}
          server={current}
          onSaved={(saved) => {
            setCreating(false)
            setSelected(serverKey(saved))
          }}
          onCancel={() => setCreating(false)}
          onDeleted={() => setSelected(null)}
        />
      </section>
    </div>
  )
}

function ServerList({
  servers,
  current,
  onOpen,
  showScope,
  empty,
}: {
  servers: MCPServer[]
  current?: MCPServer
  onOpen: (server: MCPServer) => void
  showScope?: boolean
  empty?: string
}) {
  if (servers.length === 0) return empty ? <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p> : null
  return (
    <ul className="flex flex-col gap-1">
      {servers.map((server) => {
        const active = current !== undefined && serverKey(current) === serverKey(server)
        return (
          <li key={serverKey(server)}>
            <button
              type="button"
              onClick={() => onOpen(server)}
              aria-current={active}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:bg-muted/60',
                active && 'bg-card shadow-panel hover:bg-card',
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{server.name}</span>
              {showScope && (
                <Badge variant="outline" className="shrink-0">
                  {scopeLabels[server.scope]}
                </Badge>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

type FormProps = {
  dir: string
  actions: Element | null
  server?: MCPServer
  onSaved: (server: MCPServer) => void
  onCancel: () => void
  onDeleted: () => void
}

// Edits the common fields. Other fields in the config, such as timeouts, are kept.
function ServerForm({ dir, actions, server, onSaved, onCancel, onDeleted }: FormProps) {
  const client = useQueryClient()
  const [name, setName] = useState(server?.name ?? '')
  const [scope, setScope] = useState<MCPScope>(server?.scope ?? (dir ? 'local' : 'user'))
  const [config, setConfig] = useState<Record<string, unknown>>(server?.config ?? {})
  const type = typeof config.type === 'string' ? config.type : config.url ? 'http' : 'stdio'
  const isNew = !server
  const dirty =
    isNew || name !== server.name || scope !== server.scope || JSON.stringify(config) !== JSON.stringify(server.config)
  const nameError = name.trim() === '' || name.startsWith('-')

  const save = useMutation({
    mutationFn: () => api.saveMCP({ dir, scope, name: name.trim(), config, previous: server }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['mcp'] })
      onSaved({ name: name.trim(), scope, config })
    },
    onError: (error) => notify.error('Could not save the server', error.message),
  })

  // Empty values are left out of the config, like Claude Code does.
  function set(key: string, value: unknown) {
    setConfig((old) => {
      const next = { ...old }
      const empty =
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (isPlainObject(value) && Object.keys(value).length === 0)
      if (empty) delete next[key]
      else next[key] = value
      return next
    })
  }

  function setType(next: string) {
    setConfig((old) => {
      const { type: _type, command: _command, args: _args, env: _env, url: _url, headers: _headers, ...rest } = old
      return next === 'stdio' ? rest : { ...rest, type: next }
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">{isNew ? 'New server' : server.name}</h2>
        {!isNew && <Badge variant="secondary">{scopeLabels[server.scope]}</Badge>}
        {!isNew && <DeleteServer dir={dir} server={server} onDeleted={onDeleted} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
        <div className="divide-y rounded-3xl bg-card px-5 shadow-panel">
          <FormRow label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-server"
              aria-invalid={name !== '' && nameError}
              autoFocus={isNew}
              className="font-mono"
            />
          </FormRow>
          {dir && (
            <FormRow label="Scope">
              <FormChoice
                value={scope}
                options={[
                  { value: 'local', label: 'Local: only you, in this project' },
                  { value: 'project', label: 'Shared: in .mcp.json, for everyone' },
                  { value: 'user', label: 'Global: you, in every project' },
                ]}
                onChange={(value) => setScope(value as MCPScope)}
              />
            </FormRow>
          )}
          <FormRow label="Type">
            <FormChoice
              value={type}
              options={types.map((each) => ({ value: each, label: each === 'stdio' ? 'Command (stdio)' : each.toUpperCase() }))}
              onChange={setType}
            />
          </FormRow>
          {type === 'stdio' ? (
            <>
              <FormRow label="Command">
                <Input
                  value={(config.command as string) ?? ''}
                  onChange={(event) => set('command', event.target.value)}
                  placeholder="npx"
                  className="font-mono"
                />
              </FormRow>
              <FormRow label="Arguments">
                <ListControl
                  items={(config.args as string[]) ?? []}
                  options={[]}
                  onChange={(items) => set('args', items)}
                  label="arguments"
                />
              </FormRow>
              <FormRow label="Environment">
                <MapControl
                  entries={(config.env as Record<string, string>) ?? {}}
                  onChange={(entries) => set('env', entries)}
                  label="environment"
                />
              </FormRow>
            </>
          ) : (
            <>
              <FormRow label="URL">
                <Input
                  value={(config.url as string) ?? ''}
                  onChange={(event) => set('url', event.target.value)}
                  placeholder="https://example.com/mcp"
                  className="font-mono"
                />
              </FormRow>
              <FormRow label="Headers">
                <MapControl
                  entries={(config.headers as Record<string, string>) ?? {}}
                  onChange={(entries) => set('headers', entries)}
                  label="headers"
                />
              </FormRow>
            </>
          )}
        </div>
      </div>

      {dirty &&
        actions &&
        createPortal(
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isNew) return onCancel()
                setName(server.name)
                setScope(server.scope)
                setConfig(server.config)
              }}
            >
              {isNew ? 'Cancel' : 'Discard'}
            </Button>
            <Button size="sm" disabled={nameError || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : isNew ? 'Add' : 'Save'}
            </Button>
          </>,
          actions,
        )}
    </div>
  )
}

function DeleteServer({ dir, server, onDeleted }: { dir: string; server: MCPServer; onDeleted: () => void }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () => api.deleteMCP(dir, server),
    onSuccess: () => {
      setOpen(false)
      onDeleted()
      client.invalidateQueries({ queryKey: ['mcp'] })
    },
    onError: (error) => notify.error('Could not delete the server', error.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="ml-auto text-muted-foreground hover:text-destructive" />}
      >
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {server.name}?</DialogTitle>
          <DialogDescription>
            Claude Code stops using this server
            {server.scope === 'project' ? ' for everyone who uses .mcp.json' : ''}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
