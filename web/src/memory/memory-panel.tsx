import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Skeleton } from '@/components/ui/skeleton'
import { FileEditor } from '@/files/file-editor'
import { api, queries, type FileRef, type Memory } from '@/lib/api'
import { confirmDiscard, fileKey } from '@/lib/location'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/ui'

type Note = Memory['notes'][number]

export function MemoryPanel({ dir, actions }: { dir: string; actions: Element | null }) {
  const memory = useQuery(queries.memory(dir))
  const [selected, setSelected] = useState<string | null>(null)

  if (memory.isPending) return <Skeleton className="h-64" />
  if (memory.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load memory</AlertTitle>
        <AlertDescription>{memory.error.message}</AlertDescription>
      </Alert>
    )
  }

  const { notes, enabled } = memory.data
  if (notes.length === 0) {
    return (
      <EmptyState icon={<Brain />} title="No memories yet">
        {enabled
          ? 'Claude saves notes here as it learns about this folder.'
          : 'Auto memory is off, so Claude does not save notes.'}
      </EmptyState>
    )
  }

  const current = notes.find((note) => note.name === selected) ?? notes[0]
  const ref = (name: string): FileRef => ({ dir, kind: 'memory-note', name })

  function select(name: string) {
    if (!confirmDiscard([fileKey(ref(current.name))])) return
    setSelected(name)
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex min-h-0 w-72 shrink-0 flex-col gap-3">
        {(!dir || !enabled) && (
          <p className="px-3 text-xs text-muted-foreground">
            {!dir && 'From sessions started in your home folder. '}
            {!enabled && 'Auto memory is off.'}
          </p>
        )}
        <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
          {notes.map((note) => (
            <li key={note.name}>
              <button
                type="button"
                onClick={() => select(note.name)}
                aria-current={note.name === current.name}
                title={note.name}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all hover:bg-muted/60',
                  note.name === current.name && 'bg-card shadow-panel hover:bg-card',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{label(note)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-lg font-semibold">{label(current)}</h2>
          {!current.index && <DeleteNote dir={dir} name={current.name} onDeleted={() => setSelected(null)} />}
        </div>
        <div className="min-h-0 flex-1">
          <FileEditor key={current.name} {...ref(current.name)} toolbar={actions} />
        </div>
      </section>
    </div>
  )
}

// MEMORY.md is the index that Claude reads first. It lists the other notes.
function label(note: Note) {
  return note.index ? 'Index' : note.name.replace(/\.md$/, '')
}

function DeleteNote({ dir, name, onDeleted }: { dir: string; name: string; onDeleted: () => void }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)

  const remove = useMutation({
    mutationFn: () => api.deleteFile({ dir, kind: 'memory-note', name }),
    onSuccess: () => {
      setOpen(false)
      onDeleted()
      client.invalidateQueries({ queryKey: queries.memory(dir).queryKey })
    },
    onError: (error) => notify.error('Could not delete the note', error.message),
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
          <DialogTitle>Delete this note?</DialogTitle>
          <DialogDescription>
            Claude forgets what it saved in {name}. The index may still mention it until Claude updates
            the index.
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
