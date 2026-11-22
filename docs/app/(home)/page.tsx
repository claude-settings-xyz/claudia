import type { Metadata } from 'next';
import { ClaudiaCard } from './claudia-card';
import { ConfigNote } from './config-note';
import { Configuration } from './configuration';
import { Hero } from './hero';
import { getSettings } from './settings-data';

export const metadata: Metadata = {
  title: { absolute: 'Claude Code settings.json: every setting, in plain English' },
  description:
    'See what each Claude Code setting does, and set the ones you want. Then copy your settings.json, or paste your own to check it.',
};

export default function HomePage() {
  const { categories, count, known } = getSettings();

  return (
    <main className="flex flex-1 flex-col gap-20 pb-24">
      <Hero count={count} />

      <div className="relative mx-auto mt-8 w-full max-w-6xl px-4 sm:mt-56 sm:px-6">
        <ConfigNote />
        <Configuration categories={categories} known={known} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <ClaudiaCard />
      </div>
    </main>
  );
}
