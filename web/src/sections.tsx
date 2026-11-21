import { Brain, FileText, Puzzle, Server, SlidersHorizontal, Sparkles, Store, type LucideIcon } from 'lucide-react'

import type { Tab } from '@/lib/location'

export type Section = {
  tab: Tab
  label: string
  icon: LucideIcon
  // Only in the global view. In a project, the section asks you to switch.
  globalOnly?: boolean
}

// The views of a scope, in the order of the sidebar.
export const sections: Section[] = [
  { tab: 'settings', label: 'Configuration', icon: SlidersHorizontal },
  { tab: 'claude-md', label: 'Instructions', icon: FileText },
  { tab: 'skills', label: 'Skills', icon: Sparkles },
  { tab: 'plugins', label: 'Plugins', icon: Puzzle },
  { tab: 'marketplaces', label: 'Marketplaces', icon: Store, globalOnly: true },
  { tab: 'memory', label: 'Memory', icon: Brain },
  { tab: 'mcp', label: 'MCP Servers', icon: Server },
]
