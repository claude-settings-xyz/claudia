import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { queries } from '@/lib/api'

export function VersionInfo() {
  const health = useQuery(queries.health())
  const schema = useQuery(queries.schema())
  const claudeCode = schema.data?.version || (schema.isError ? 'not found' : '…')

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Versions" />}
      >
        <Info />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-auto text-xs">
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
          <dt className="text-muted-foreground">Claudia</dt>
          <dd className="font-mono">{health.data?.version ?? '…'}</dd>
          <dt className="text-muted-foreground">Claude Code</dt>
          <dd className="font-mono">{claudeCode}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  )
}
