import Link from 'next/link';
import { FileText, FolderCog, Puzzle, Sparkles } from 'lucide-react';

const features = [
  {
    icon: FolderCog,
    title: 'Global and per-project settings',
    description:
      'Change settings with a form that matches your installed Claude Code, globally or for one project.',
  },
  {
    icon: FileText,
    title: 'CLAUDE.md editor',
    description: 'Write the instructions that Claude Code reads, for all projects or for one folder.',
  },
  {
    icon: Sparkles,
    title: 'Skills',
    description: 'Write skills, and choose which ones Claude sees, globally or for one project.',
  },
  {
    icon: Puzzle,
    title: 'Plugins on or off per scope',
    description: 'Turn installed and marketplace plugins on or off, globally or for one project.',
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-24 pb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Claudia</h1>
        <p className="mb-8 max-w-xl text-lg text-fd-muted-foreground">
          A small tray app that lets you manage your Claude Code settings, CLAUDE.md files,
          skills and plugins from the browser.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/installation"
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border bg-fd-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Read the docs
          </Link>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-xl border bg-fd-card p-5 text-fd-card-foreground">
            <Icon className="mb-3 size-5 text-fd-primary" />
            <h2 className="mb-1 font-semibold">{title}</h2>
            <p className="text-sm text-fd-muted-foreground">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
