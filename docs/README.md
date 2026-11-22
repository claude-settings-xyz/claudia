# docs

The Claudia landing page and docs, made with [Fumadocs](https://fumadocs.dev) and Next.js.

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # static site in out/
npm run start   # serves out/ to check the build
```

The site is a [static export](https://nextjs.org/docs/app/guides/static-exports), so any file host can serve `out/`. Search runs in the browser from an index that the build writes to `/api/search`. The Markdown of each page is at `/llms.mdx/docs/<page>.md`, and `/llms.txt` and `/llms-full.txt` list all pages.

## Where things are

| Path                      | What it is                                                          |
| ------------------------- | ------------------------------------------------------------------- |
| `content/docs`            | The pages, in MDX. `meta.json` sets their order.                     |
| `app/(home)`              | The landing page.                                                   |
| `app/docs`                | The docs layout and pages.                                          |
| `lib/shared.ts`           | The app name, the routes, and the GitHub repository for the links.  |
| `lib/source.ts`           | Loads the pages, with the [Macro API](https://fumadocs.dev/docs/mdx/macro). |
| `lib/layout.shared.tsx`   | Options for all layouts, such as the title and the GitHub link.     |
