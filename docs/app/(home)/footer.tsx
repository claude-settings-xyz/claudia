import Link from 'next/link';
import type { ReactNode } from 'react';
import { githubUrl } from '@/lib/shared';
import { source } from '@/lib/source';
import { getSettings } from './settings-data';

// Links to every group of settings and every docs page, so that search engines find them all.
export function Footer() {
  const { categories, count } = getSettings();
  const docs = source.pageTree.children.flatMap((node) => (node.type === 'page' ? [node] : []));

  return (
    <footer className="border-t bg-fd-card/40">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
          <Link href="/" className="font-mono text-lg font-semibold">
            settings.json
          </Link>
          <p className="max-w-xs text-sm text-fd-muted-foreground">
            All {count} Claude Code settings in plain English, with an editor that writes your settings.json.
          </p>
          <p className="mt-auto max-w-xs pt-4 text-xs text-fd-muted-foreground">
            Open source under the{' '}
            <a href={`${githubUrl}/blob/main/LICENSE`} className="underline-offset-4 hover:text-fd-foreground hover:underline">
              MIT License
            </a>
            . It is not made by or affiliated with{' '}
            <a href="https://www.anthropic.com" className="underline-offset-4 hover:text-fd-foreground hover:underline">
              Anthropic
            </a>
            . Claude and Claude Code are trademarks of Anthropic.
          </p>
        </div>

        <Column title="Claude Code settings">
          {categories.map((category) => (
            <Item key={category.id} href={`/#settings-${category.id}`}>
              {category.label}
            </Item>
          ))}
          <Item href="/#json">Check your settings.json</Item>
        </Column>

        <Column title="Claudia docs">
          {docs.map((page) => (
            <Item key={page.url} href={page.url}>
              {page.name}
            </Item>
          ))}
        </Column>

        <Column title="Claude">
          <Item href="https://code.claude.com/docs/en/settings">Claude Code settings docs</Item>
          <Item href="https://code.claude.com/docs/en/overview">Claude Code docs</Item>
          <Item href="https://claude.com/product/claude-code">Claude Code</Item>
          <Item href="https://claude.com">Claude</Item>
          <Item href="https://www.anthropic.com">Anthropic</Item>
        </Column>

        <Column title="Resources">
          <Item href="/#claudia">Install Claudia</Item>
          <Item href={githubUrl}>Claudia on GitHub</Item>
          <Item href={`${githubUrl}/releases`}>Releases</Item>
          <Item href={`${githubUrl}/issues`}>Report a problem</Item>
          <Item href="https://json.schemastore.org/claude-code-settings.json">settings.json schema</Item>
          <Item href="/llms.txt">llms.txt</Item>
        </Column>
      </div>
    </footer>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wider text-fd-muted-foreground uppercase">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </nav>
  );
}

// Links to a part of this page are plain links, so that the page sees the new hash.
function Item({ href, children }: { href: string; children: ReactNode }) {
  const plain = href.startsWith('http') || href.startsWith('/#');
  return (
    <li>
      {plain ? (
        <a href={href} className="text-fd-muted-foreground transition-colors hover:text-fd-foreground">
          {children}
        </a>
      ) : (
        <Link href={href} className="text-fd-muted-foreground transition-colors hover:text-fd-foreground">
          {children}
        </Link>
      )}
    </li>
  );
}
