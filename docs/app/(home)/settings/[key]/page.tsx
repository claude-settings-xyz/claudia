import { ArrowRight, Download } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/lib/json-ld';
import { lastModified } from '@/lib/last-modified';
import { absoluteUrl } from '@/lib/shared';
import { highlightJSON } from '../../json-view';
import { isManagedKey } from '../../settings-data';
import { Prose } from '../prose';
import { count, describe, entries, exampleOf, findEntry, neighbors, settingUrl, summary } from '../reference';
import { Child, Fact, Facts } from './details';

export const dynamicParams = false;

const updated = lastModified('app/(home)/settings-schema.json');

export function generateStaticParams() {
  return entries.map(({ setting }) => ({ key: setting.key }));
}

async function entryOf(params: Promise<{ key: string }>) {
  const entry = findEntry((await params).key);
  if (!entry) notFound();
  return entry;
}

export async function generateMetadata({ params }: PageProps<'/settings/[key]'>): Promise<Metadata> {
  const { setting } = await entryOf(params);
  const url = settingUrl(setting.key);
  return {
    title: { absolute: `${setting.key} | Claude Code settings.json` },
    description: describe(setting),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      siteName: 'settings.json',
      images: { url: `og/settings/${setting.key}.png`, width: 1200, height: 630, alt: setting.key },
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function SettingPage({ params }: PageProps<'/settings/[key]'>) {
  const entry = await entryOf(params);
  const { setting, category } = entry;
  const example = exampleOf(setting);
  const managed = isManagedKey(setting.key);
  const url = absoluteUrl(settingUrl(setting.key));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-24 sm:px-6 sm:pt-14">
      <JsonLd
        data={{
          '@graph': [
            {
              '@type': 'TechArticle',
              headline: `${setting.key}: a Claude Code setting`,
              description: describe(setting),
              url,
              image: absoluteUrl(`/og/settings/${setting.key}.png`),
              dateModified: updated?.toISOString(),
              inLanguage: 'en',
              about: { '@type': 'SoftwareApplication', name: 'Claude Code', applicationCategory: 'DeveloperApplication' },
              isPartOf: { '@type': 'WebSite', name: 'settings.json', url: absoluteUrl('/') },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Claude Code settings', item: absoluteUrl('/settings') },
                { '@type': 'ListItem', position: 2, name: category.label, item: absoluteUrl(`/settings#${category.id}`) },
                { '@type': 'ListItem', position: 3, name: setting.key, item: url },
              ],
            },
          ],
        }}
      />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
        <Link href="/settings" className="hover:text-fd-foreground">
          Settings
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/settings#${category.id}`} className="hover:text-fd-foreground">
          {category.label}
        </Link>
      </nav>

      <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight break-all sm:text-4xl">{setting.key}</h1>
      {setting.description ? (
        <Prose text={setting.description} className="mt-5 text-lg leading-relaxed" />
      ) : (
        setting.field.kind === 'object' && (
          <p className="mt-5 text-lg leading-relaxed">
            A group of {setting.field.settings.length} settings, which this page explains one by one.
          </p>
        )
      )}

      <div className="mt-8 rounded-xl border bg-fd-card p-5">
        <Facts setting={setting}>
          <Fact term="Group">
            <Link href={`/settings#${category.id}`} className="underline-offset-4 hover:underline">
              {category.label}
            </Link>
          </Fact>
        </Facts>
      </div>

      {example && (
        <>
          <h2 className="mt-12 text-xl font-bold tracking-tight">Example</h2>
          <p className="mt-2 text-fd-muted-foreground">In your settings.json:</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border bg-fd-card p-4 font-mono text-[13px] leading-6">
            <code>{highlightJSON(example)}</code>
          </pre>
        </>
      )}

      {setting.field.kind === 'object' && (
        <>
          <h2 className="mt-12 text-xl font-bold tracking-tight">Settings in {setting.key}</h2>
          <div className="mt-2 divide-y">
            {setting.field.settings.map((child) => (
              <Child key={child.key} setting={child} path={`${setting.key}.${child.key}`} depth={0} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-12 text-xl font-bold tracking-tight">Where it goes</h2>
      {managed ? (
        <p className="mt-3 leading-relaxed text-fd-muted-foreground">
          Claude Code reads this setting only from managed settings, which an administrator deploys to the computers of an
          organization. In your own settings files, it does nothing.
        </p>
      ) : (
        <>
          <p className="mt-3 leading-relaxed text-fd-muted-foreground">
            Claude Code reads its settings from these files. When a setting is in more than one, the more specific file wins.
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border bg-fd-card p-5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <Fact term="Your settings">
              <code className="font-mono text-[13px]">~/.claude/settings.json</code>, for all of your projects
            </Fact>
            <Fact term="Project">
              <code className="font-mono text-[13px]">.claude/settings.json</code>, shared with your team in git
            </Fact>
            <Fact term="Project, only you">
              <code className="font-mono text-[13px]">.claude/settings.local.json</code>, which stays out of git
            </Fact>
          </dl>
        </>
      )}
      <p className="mt-3 text-sm text-fd-muted-foreground">
        More in{' '}
        <Link href="/docs/scopes" className="underline underline-offset-4 hover:text-fd-foreground">
          Scopes and files
        </Link>{' '}
        and in the{' '}
        <a href="https://code.claude.com/docs/en/settings" className="underline underline-offset-4 hover:text-fd-foreground">
          Claude Code settings docs
        </a>
        .
      </p>

      <section className="mt-12 rounded-2xl border bg-linear-to-br from-[#d9623f]/12 via-fd-card to-fd-card p-6">
        <h2 className="text-lg font-bold tracking-tight">Set it without writing JSON</h2>
        <p className="mt-1.5 text-fd-muted-foreground">
          Pick a value in the settings browser, and copy your settings.json. Or edit the files on your computer with Claudia.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/#settings-${category.id}`}
            className="group flex items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#e0703f] to-[#b4482a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-white/20 transition hover:brightness-110"
          >
            Open the settings browser
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/#claudia"
            className="flex items-center justify-center gap-2 rounded-xl border bg-fd-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-fd-accent"
          >
            <Download className="size-4" />
            Get Claudia
          </Link>
        </div>
      </section>

      <h2 className="mt-12 text-xl font-bold tracking-tight">More {category.label} settings</h2>
      <ul className="mt-4 divide-y rounded-xl border bg-fd-card">
        {neighbors(entry).map((other) => (
          <li key={other.key}>
            <Link href={settingUrl(other.key)} className="block px-5 py-3.5 transition-colors hover:bg-fd-accent/50">
              <code className="font-mono text-sm font-semibold break-all">{other.key}</code>
              {other.description && (
                <span className="mt-0.5 block text-sm text-fd-muted-foreground">{summary(other.description, 120)}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#b4482a] hover:underline dark:text-[#f5936a]"
      >
        All {count} settings
        <ArrowRight className="size-3.5" />
      </Link>
    </main>
  );
}
