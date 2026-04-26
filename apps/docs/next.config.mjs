import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const repo = 'nest-auth';
const isProd = process.env.NODE_ENV === 'production';
const isUserSite = process.env.GITHUB_PAGES_USER_SITE === 'true';
const basePath = isProd && !isUserSite ? `/${repo}` : '';

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default withMDX(config);
