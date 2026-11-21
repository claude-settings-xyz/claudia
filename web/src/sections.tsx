import { Brain, FileText, Puzzle, Server, SlidersHorizontal, Sparkles, Store, type LucideIcon } from 'lucide-react'

import type { Tab } from '@/lib/location'

export type Section = {
  tab: Tab
  label: string
  icon: LucideIcon
  // The color of the selected section, like the file colors in the Claude docs.
  color: string
  // Only in the global view. In a project, the section asks you to switch.
  globalOnly?: boolean
}

// The views of a scope, in the order of the sidebar.
export const sections: Section[] = [
  { tab: 'settings', label: 'Configuration', icon: SlidersHorizontal, color: 'data-active:text-file-settings' },
  { tab: 'claude-md', label: 'Instructions', icon: FileText, color: 'data-active:text-file-instructions' },
  { tab: 'skills', label: 'Skills', icon: Sparkles, color: 'data-active:text-file-skills' },
  { tab: 'plugins', label: 'Plugins', icon: Puzzle, color: 'data-active:text-file-plugins' },
  { tab: 'marketplaces', label: 'Marketplaces', icon: Store, color: 'data-active:text-file-marketplaces', globalOnly: true },
  { tab: 'memory', label: 'Memory', icon: Brain, color: 'data-active:text-file-memory' },
  { tab: 'mcp', label: 'MCP Servers', icon: Server, color: 'data-active:text-file-mcp' },
]
