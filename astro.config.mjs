// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://enhanced-s5js.org',

  // Dev/preview server: port 5523 is the only port mapped out of the dev
  // container (see docker-compose.yml), and host: true binds 0.0.0.0 so the
  // server is reachable through that mapping.
  server: { port: 5523, host: true },

  integrations: [
    starlight({
      title: 'Enhanced s5.js',
      description:
        'TypeScript SDK for the S5 decentralized storage network — path-based file API, media processing, HAMT-scaled directories, and content-addressed storage.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/julesl23/s5.js',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Overview', slug: 'overview' },
            { label: 'Installation & Setup', slug: 'installation' },
            { label: 'Quick Start', slug: 'quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Path-based API', slug: 'path-api' },
            { label: 'Connection API', slug: 'connection' },
            { label: 'Identity & Signing', slug: 'identity' },
            { label: 'Cross-Identity Access', slug: 'cross-identity' },
            { label: 'Media Processing', slug: 'media' },
            { label: 'Advanced CID API', slug: 'advanced-cid' },
            { label: 'Encryption', slug: 'encryption' },
            { label: 'Performance & Scaling', slug: 'performance' },
            { label: 'Directory Utilities', slug: 'utilities' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API Reference', slug: 'api-reference' },
            { label: 'Changelog', slug: 'changelog' },
          ],
        },
      ],
    }),
  ],
});
