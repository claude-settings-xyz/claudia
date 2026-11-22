import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SkillVisibility } from '@/lib/settings'

// The values of skillOverrides in Claude Code settings.
export const visibilities: Record<SkillVisibility, { label: string; hint: string }> = {
  on: { label: 'On', hint: 'Claude can use it. You can run it.' },
  'name-only': { label: 'Name only', hint: 'Claude sees the name only.' },
  'user-invocable-only': { label: 'Only as command', hint: 'Hidden from Claude. You can run it.' },
  off: { label: 'Off', hint: "Hidden from Claude. You can't run it." },
}

type Props = {
  value: SkillVisibility | undefined
  // Set in a project: what applies when the project has no override. That is
  // the global choice if there is one, or else the default.
  inherited?: { value: SkillVisibility; global: boolean }
  disabled?: boolean
  onChange: (value: SkillVisibility | undefined) => void
}

export function VisibilitySelect({ value, inherited, disabled, onChange }: Props) {
  const options = [
    ...(inherited
      ? [
          {
            value: 'inherit',
            label: `${inherited.global ? 'Inherit' : 'Default'} (${visibilities[inherited.value].label})`,
            hint: inherited.global ? 'Uses the global choice.' : 'No override is set.',
          },
        ]
      : []),
    ...Object.entries(visibilities).map(([key, option]) => ({ value: key, ...option })),
  ]
  // The closed select shows only the label.
  const items = options.map((option) => ({ value: option.value, label: option.label }))

  return (
    <Select
      items={items}
      value={value ?? (inherited ? 'inherit' : 'on')}
      disabled={disabled}
      onValueChange={(next) =>
        onChange(next === 'inherit' ? undefined : (next as SkillVisibility))
      }
    >
      <SelectTrigger size="sm" className="w-52" aria-label="Visibility">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-(--anchor-width)">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{option.hint}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
