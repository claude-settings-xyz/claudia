import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SkillVisibility } from '@/lib/settings'

// The values of skillOverrides in Claude Code settings.
export const visibilities: Record<SkillVisibility, { label: string; hint: string }> = {
  on: { label: 'On', hint: 'Claude can use it. You can run it.' },
  'name-only': { label: 'Name only', hint: 'Claude sees the name only.' },
  'user-invocable-only': { label: 'Only as command', hint: 'Hidden from Claude. You can run it.' },
  off: { label: 'Off', hint: "Hidden from Claude. You can't run it." },
}

// What the SKILL.md of the skill does not allow. Options that need it are turned off.
export type Locks = { model: boolean; user: boolean }

type Props = {
  value: SkillVisibility | undefined
  locks?: Locks
  // Set in a project: what applies when the project has no override. That is
  // the global choice if there is one, or else the default.
  inherited?: { value: SkillVisibility; global: boolean }
  disabled?: boolean
  onChange: (value: SkillVisibility | undefined) => void
}

export function VisibilitySelect({ value, locks, inherited, disabled, onChange }: Props) {
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
    ...Object.entries(visibilities).map(([key, option]) => {
      const needsModel = key === 'on' || key === 'name-only'
      const needsUser = key === 'user-invocable-only'
      if (locks?.model && needsModel) return { value: key, ...option, hint: 'Its SKILL.md does not let Claude use it.', locked: true }
      if (locks?.user && needsUser) return { value: key, ...option, hint: 'Its SKILL.md does not let you run it.', locked: true }
      return { value: key, ...option, locked: false }
    }),
  ]
  // The closed select shows only the label.
  const items = options.map((option) => ({ value: option.value, label: option.label }))

  // A lock in SKILL.md wins over the setting, so the select shows what applies.
  const stored = value ?? (inherited ? 'inherit' : 'on')
  const resolved = stored === 'inherit' ? inherited!.value : stored
  let shown = stored
  if (locks?.model && (resolved === 'on' || resolved === 'name-only')) shown = 'user-invocable-only'
  if (locks?.user && resolved === 'user-invocable-only') shown = 'off'

  return (
    <Select
      items={items}
      value={shown}
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
          <SelectItem key={option.value} value={option.value} disabled={'locked' in option && option.locked}>
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
