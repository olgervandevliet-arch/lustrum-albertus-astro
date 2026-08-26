import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';

import sanity from '@sanity/astro';

// TODO: update to the final production domain once this Astro site gets its own deployment.
const SITE_URL = 'https://lustrum-albertus-astro.vercel.app';

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
);

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [sitemap({
    filter: (page) => !page.includes('/inloggen') && !page.includes('/login'),
  }), sanity({
    projectId: PUBLIC_SANITY_PROJECT_ID,
    dataset: PUBLIC_SANITY_DATASET,
    useCdn: false,
  })],
});