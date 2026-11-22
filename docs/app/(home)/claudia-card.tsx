'use client';

import { ArrowRight, Check, Copy, FolderTree, Layers, RefreshCw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { githubUrl } from '@/lib/shared';

const installs = [
  {
    id: 'unix',
    label: 'macOS and Linux',
    command: 'curl -fsSL https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.sh | sh',
  },
  {
    id: 'windows',
    label: 'Windows',
    command: 'irm https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.ps1 | iex',
  },
];

const features = [
  {
    icon: RefreshCw,
    title: 'In sync with your Claude Code',
    text: 'The form comes from the Claude Code on your computer, so it shows the settings that your version reads.',
  },
  {
    icon: FolderTree,
    title: 'Global and per project',
    text: 'Your global settings, and the shared and local settings of each project.',
  },
  {
    icon: Layers,
    title: 'More than settings',
    text: 'CLAUDE.md, skills, MCP servers, plugins, marketplaces and memory, in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'Stays on your computer',
    text: 'It only listens on 127.0.0.1, and it never sends your files anywhere.',
  },
];

export function ClaudiaCard() {
  const [system, setSystem] = useState('unix');
  const [copied, setCopied] = useState(false);
  const install = installs.find((each) => each.id === system) ?? installs[0];

  useEffect(() => {
    if (/windows/i.test(navigator.userAgent)) setSystem('windows');
  }, []);

  async function copy() {
    await navigator.clipboard.writeText(install.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section
      id="claudia"
      className="scroll-mt-20 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#b94e30,#86331d)] text-white shadow-xl"
    >
      <div className="grid grid-cols-1 gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:p-12">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold">Claudia</span>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Edit every setting with a form, not with JSON</h2>
            <p className="text-white/85">
              Claudia is a small app for your menu bar or tray. It opens in your browser and shows each setting of
              Claude Code as a form. Change settings for all your projects or for one, and keep the rest of your Claude
              Code setup in the same place.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-white/80" />
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <div role="tablist" aria-label="Your system" className="flex gap-1">
              {installs.map((each) => (
                <button
                  key={each.id}
                  type="button"
                  role="tab"
                  aria-selected={each.id === system}
                  onClick={() => setSystem(each.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                    each.id === system ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white',
                  )}
                >
                  {each.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-black/30 p-1.5 pl-4 ring-1 ring-white/15">
              <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-white/90 sm:text-[13px]">
                {install.command}
              </code>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy the install command"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#86331d] transition-opacity hover:opacity-90"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-white/70">Run it in a terminal. It installs Claudia and opens it in your browser.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#86331d] transition-opacity hover:opacity-90"
            >
              Read the docs
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={githubUrl}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/10"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* A plain img, because a static export cannot optimize images. */}
        <img
          src="/claudia.jpg"
          alt="Claudia, with the settings of a project open"
          width={1440}
          height={900}
          className="w-full rounded-xl shadow-2xl ring-1 ring-white/20"
        />
      </div>
    </section>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-8">
      <rect width="64" height="64" rx="16" fill="#fff" />
      <rect x="11" y="19.5" width="42" height="25" rx="12.5" fill="none" stroke="#b94e30" strokeWidth="4.5" />
      <circle cx="41" cy="32" r="6.5" fill="#b94e30" />
    </svg>
  );
}
