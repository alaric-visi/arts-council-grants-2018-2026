import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://grants.mikehiggins.me.uk',
  adapter: netlify({ devFeatures: false }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    envPrefix: ['VITE_', 'PUBLIC_'],
    build: {
      chunkSizeWarningLimit: 2000
    }
  }
});
