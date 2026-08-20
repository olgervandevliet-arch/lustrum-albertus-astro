import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO: update to the final production domain once this Astro site gets its own deployment.
const SITE_URL = 'https://lustrum-albertus-astro.vercel.app';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
});
