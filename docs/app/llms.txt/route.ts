import { count } from '@/app/(home)/settings/reference';
import { docsLlms } from '@/lib/source';
import { absoluteUrl } from '@/lib/shared';

export const revalidate = false;

export async function GET() {
  // The docs index starts with its own title, which this file replaces.
  const docs = (await docsLlms.index()).replace(/^# .*\n+/, '');
  const text = `# Claude Code settings and Claudia

> ${absoluteUrl('/')} explains each of the ${count} Claude Code settings in plain English. It also makes Claudia, a small open-source app that edits your Claude Code settings.json, CLAUDE.md, MCP servers, skills and plugins.

## Claude Code settings

- [All Claude Code settings](${absoluteUrl('/settings.md')}): every setting in settings.json, with its type, values, default and an example.

## Claudia docs

${docs}

## Optional

- [Everything in one file](${absoluteUrl('/llms-full.txt')}): the Claudia docs and the settings reference.
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
