import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { ClaudiaCard } from './claudia-card';
import { Configuration } from './configuration';
import { getBuilderOptions, getSettings } from './settings-data';

export const metadata: Metadata = {
  title: { absolute: 'Claude Code settings.json: every setting, explained' },
  description:
    'Every setting that Claude Code reads from settings.json, grouped and explained, and a builder that writes your settings.json for you.',
};

export default function HomePage() {
  const { categories, count, version } = getSettings();

  return (
    <main className="flex flex-1 flex-col gap-20 pb-24">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-20 text-center sm:pt-28">
        <p className="mb-5 rounded-full border bg-fd-card px-3 py-1 font-mono text-xs text-fd-muted-foreground">
          ~/.claude/settings.json
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">Every Claude Code setting, explained</h1>
        <p className="mt-5 max-w-2xl text-lg text-balance text-fd-muted-foreground">
          The {count} settings that Claude Code reads from settings.json, grouped by what they do. Or answer a few
          questions, and get a settings.json that is ready to use.
        </p>
        <a
          href="#builder"
          className="mt-9 flex items-center gap-2 rounded-xl bg-fd-primary px-6 py-3 font-semibold text-fd-primary-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          Build your settings.json
          <ArrowRight className="size-4" />
        </a>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Configuration categories={categories} options={getBuilderOptions()} count={count} version={version} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <ClaudiaCard version={version} />
      </div>
    </main>
  );
}
