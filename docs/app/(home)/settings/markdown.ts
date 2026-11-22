import { absoluteUrl } from '@/lib/shared';
import type { Setting } from '../fields';
import { claudeCodeVersion, isManagedKey } from '../settings-data';
import { categories, count, exampleOf, rangeOf, settingUrl, typeOf, valuesOf } from './reference';

// The settings reference as one Markdown file, for agents and AI search.
export function settingsMarkdown(): string {
  const out = [
    '# Claude Code settings',
    '',
    `All ${count} settings that Claude Code ${claudeCodeVersion} reads from settings.json, by group. Each setting also has a page at ${absoluteUrl('/settings')}/<name>.`,
    '',
    'Claude Code reads settings from `~/.claude/settings.json` (all of your projects), `.claude/settings.json` (a project, shared in git) and `.claude/settings.local.json` (a project, only for you). The more specific file wins. Managed settings, which an administrator deploys, win over all of them.',
  ];

  for (const category of categories) {
    out.push('', `## ${category.label}`, '', category.intro);
    for (const setting of category.settings) {
      out.push('', `### ${setting.key}`, '');
      if (setting.description) out.push(setting.description, '');
      out.push(...facts(setting));
      if (isManagedKey(setting.key)) out.push('- Where: only in managed settings');
      const example = exampleOf(setting);
      if (example) out.push(`- Example: \`${JSON.stringify(JSON.parse(example))}\``);
      out.push(`- Page: ${absoluteUrl(settingUrl(setting.key))}`);
      if (setting.field.kind === 'object') out.push('', ...children(setting.field.settings, setting.key, 0));
    }
  }
  return out.join('\n') + '\n';
}

function facts(setting: Setting): string[] {
  const lines = [`- Type: ${typeOf(setting.field)}`];
  const range = rangeOf(setting.field);
  if (range) lines.push(`- Range: ${range}`);
  const { values, complete } = valuesOf(setting);
  if (values.length > 0) {
    const list = values.map(({ value, hint }) => `\`${value}\`${hint ? ` (${hint})` : ''}`).join(', ');
    lines.push(`- ${complete ? 'Values' : 'Common values'}: ${list}`);
  }
  if (setting.fallback !== undefined) lines.push(`- Default: \`${setting.fallback}\``);
  return lines;
}

function children(settings: Setting[], parent: string, depth: number): string[] {
  const indent = '  '.repeat(depth);
  return settings.flatMap((setting) => {
    const path = `${parent}.${setting.key}`;
    const details = [typeOf(setting.field), setting.description].filter(Boolean).join('. ');
    const lines = [`${indent}- \`${path}\`: ${details}`];
    if (setting.field.kind === 'object') lines.push(...children(setting.field.settings, path, depth + 1));
    return lines;
  });
}
