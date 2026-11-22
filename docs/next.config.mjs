import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // A static site in out/, so that any file host can serve it.
  output: 'export',
  reactStrictMode: true,
};

export default withMDX(config);
