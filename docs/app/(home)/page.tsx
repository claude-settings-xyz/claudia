import type { Metadata } from 'next';
import { ClaudiaCard } from './claudia-card';
import { Configuration } from './configuration';
import { Hero } from './hero';
import { getBuilderOptions, getSettings } from './settings-data';

export const metadata: Metadata = {
  title: { absolute: 'Claude Code settings.json: every setting, in plain English' },
  description:
    'See what each Claude Code setting does, with an example. Or answer a few questions and get your own settings.json.',
};

export default function HomePage() {
  const { categories, count } = getSettings();

  return (
    <main className="flex flex-1 flex-col gap-20 pb-24">
      <Hero count={count} />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Configuration categories={categories} options={getBuilderOptions()} />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <ClaudiaCard />
      </div>
    </main>
  );
}
