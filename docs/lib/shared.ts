import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Claudia';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsMarkdownRoute = '/llms.mdx';

export const gitConfig = {
  user: 'claude-settings-xyz',
  repo: 'claudia',
  branch: 'main',
  // The docs live in a folder of the repository.
  contentDir: 'docs/content/docs',
};

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

// The source of a page on GitHub.
export function getPageGithubUrl(page: { path: string }) {
  return `${githubUrl}/blob/${gitConfig.branch}/${gitConfig.contentDir}/${page.path}`;
}

// The Markdown of a page, as a file that the static build writes.
export function getPageMarkdownUrl(page: { url: string }) {
  return `${docsMarkdownRoute}${page.url}.md`;
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
