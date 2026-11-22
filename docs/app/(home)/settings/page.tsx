import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/lib/json-ld';
import { absoluteUrl } from '@/lib/shared';
import { categories, count, settingUrl, summary } from './reference';

const description = `All ${count} settings that Claude Code reads from settings.json, by group, in plain English. Open one to see its values and an example.`;

export const metadata: Metadata = {
  title: { absolute: `All ${count} Claude Code settings: the settings.json reference` },
  description,
  alternates: { canonical: '/settings' },
  openGraph: {
    type: 'website',
    url: '/settings',
    siteName: 'settings.json',
    images: { url: 'og.jpg', width: 1200, height: 600, alt: 'Claudia: edit every Claude Code setting with a form, not with JSON' },
  },
  twitter: { card: 'summary_large_image' },
};

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <JsonLd
        data={{
          '@type': 'CollectionPage',
          name: 'Claude Code settings',
          description,
          url: absoluteUrl('/settings'),
          isPartOf: { '@type': 'WebSite', name: 'settings.json', url: absoluteUrl('/') },
          about: { '@type': 'SoftwareApplication', name: 'Claude Code', applicationCategory: 'DeveloperApplication' },
        }}
      />

      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Claude Code settings</h1>
      <p className="mt-5 max-w-2xl text-lg text-pretty text-fd-muted-foreground">
        All {count} settings that Claude Code reads from settings.json, by group. Open a setting to see its values and an
        example, or{' '}
        <Link href="/#settings" className="font-medium text-fd-foreground underline underline-offset-4">
          build your settings.json
        </Link>{' '}
        with a form.
      </p>

      <nav aria-label="Groups of settings" className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <a
            key={category.id}
            href={`#${category.id}`}
            className="flex items-center gap-2 rounded-lg border bg-fd-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {category.label}
            <span className="text-xs text-fd-muted-foreground tabular-nums">{category.settings.length}</span>
          </a>
        ))}
      </nav>

      {categories.map((category) => (
        <section key={category.id} id={category.id} className="mt-14 scroll-mt-20">
          <h2 className="text-2xl font-bold tracking-tight">{category.label}</h2>
          <p className="mt-2 text-fd-muted-foreground">{category.intro}</p>
          <ul className="mt-5 divide-y rounded-xl border bg-fd-card">
            {category.settings.map((setting) => (
              <li key={setting.key}>
                <Link
                  href={settingUrl(setting.key)}
                  className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-fd-accent/50"
                >
                  <span className="min-w-0 flex-1">
                    <code className="font-mono text-sm font-semibold break-all">{setting.key}</code>
                    {setting.description && (
                      <span className="mt-1 block text-sm leading-relaxed text-fd-muted-foreground">
                        {summary(setting.description, 200)}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
