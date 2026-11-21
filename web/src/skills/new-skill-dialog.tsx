import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, api, queries } from '@/lib/api'

const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

type Props = { dir: string; onCreated: (name: string) => void }

export function NewSkillDialog({ dir, onCreated }: Props) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const create = useMutation({
    mutationFn: () =>
      // An empty version means the file must not exist yet.
      api.saveFile({ dir, kind: 'skill', name }, template(name, description.trim()), ''),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queries.skills(dir).queryKey })
      onCreated(name)
      setOpen(false)
      setName('')
      setDescription('')
    },
  })

  const nameError =
    name && !namePattern.test(name) ? 'Use lowercase letters, numbers and hyphens.' : null
  const saveError =
    create.error instanceof ApiError && create.error.status === 409
      ? 'A skill with this name already exists.'
      : create.error?.message

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name && !nameError) create.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        create.reset()
      }}
    >
      <DialogTrigger
        render={
          <Button size="icon" variant="outline" className="shrink-0" title="New skill" aria-label="New skill" />
        }
      >
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New skill</DialogTitle>
            <DialogDescription>
              {dir
                ? 'Claudia creates the skill in .claude/skills in this project.'
                : 'Claudia creates the skill in ~/.claude/skills. It is available in every project.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="review-pull-request"
              maxLength={64}
              aria-invalid={!!nameError}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              You run the skill as /{name || 'name'}.
            </p>
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skill-description">Description</Label>
            <Textarea
              id="skill-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What the skill does, and when Claude should use it."
            />
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!name || !!nameError || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function template(name: string, description: string) {
  const title = name.charAt(0).toUpperCase() + name.slice(1).replaceAll('-', ' ')
  return `---
name: ${name}
description: ${yamlString(description)}
---

# ${title}

Write the instructions that Claude follows when it uses this skill.
`
}

// Plain YAML breaks on characters such as ": " and "#", so quote anything unusual.
function yamlString(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 .,;()'/-]*$/.test(value) ? value : JSON.stringify(value)
}
