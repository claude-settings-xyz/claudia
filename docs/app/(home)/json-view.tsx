import type { ReactNode } from 'react';

const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

// Colors JSON text: keys, strings, and numbers or literals.
export function highlightJSON(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [whole, string, colon, literal] = match;
    if (string && colon) {
      parts.push(
        <span key={index} className="text-sky-700 dark:text-sky-300">
          {string}
        </span>,
        colon,
      );
    } else if (string) {
      parts.push(
        <span key={index} className="text-emerald-700 dark:text-emerald-300">
          {string}
        </span>,
      );
    } else {
      parts.push(
        <span key={index} className={literal ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}>
          {whole}
        </span>,
      );
    }
    last = index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
