'use client';

import { ArrowRight, Check, Copy } from 'lucide-react';
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
      className="scroll-mt-20 overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#c2553a,#86331d)] text-white shadow-xl"
    >
      <div className="grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:p-12">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold">Claudia</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Edit every setting with a form, not with JSON
          </h2>
          <p className="max-w-xl text-white/85">
            Claudia is a small tray app that shows your settings.json as a form, built from the Claude Code on your
            computer. Use it for all your projects or for one, with CLAUDE.md, skills, MCP servers and plugins next to
            it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-white/90">
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm font-semibold">
            <Link href="/docs" className="flex items-center gap-1 hover:underline">
              Read the docs
              <ArrowRight className="size-4" />
            </Link>
            <a href={githubUrl} className="text-white/80 hover:text-white hover:underline">
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* The app in a window frame, cut off by the bottom of the card. */}
      <div className="px-4 sm:px-10 lg:px-12">
        <div className="overflow-hidden rounded-t-xl bg-[#1a1a1a] shadow-2xl ring-1 ring-white/20">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 font-mono text-xs text-white/50">127.0.0.1:7377</span>
          </div>
          <div className="max-h-[26rem] overflow-hidden sm:max-h-[34rem]">
            {/* A plain img, because a static export cannot optimize images. */}
            <img
              src="/claudia.jpg"
              alt="Claudia, with the settings of a project as a form: a text field, a list of choices and switches"
              width={2400}
              height={1520}
              className="block w-full"
            />
          </div>
        </div>
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
