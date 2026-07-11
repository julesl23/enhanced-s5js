# Enhanced s5.js — Documentation Website

The documentation website for [Enhanced s5.js](https://github.com/julesl23/s5.js), built with
[Astro Starlight](https://starlight.astro.build/).

## Development

Requires Node.js 20.3+ (Astro 5).

```bash
npm install
npm run dev        # local dev server at http://localhost:5523
npm run build      # production build into ./dist
npm run preview    # serve the production build locally (also port 5523)
```

The dev/preview server runs on **port 5523** bound to `0.0.0.0` (configured in
`astro.config.mjs`) because that is the only port mapped out of the s5.js dev container
(`docker-compose.yml`). If you ever work outside the container, it's just
http://localhost:5523 all the same.

## Project Structure

```
.
├── astro.config.mjs           # site config: title, sidebar, site URL
├── src/
│   ├── content/docs/          # all pages (Markdown/MDX)
│   │   ├── index.mdx          # landing page (hero + feature cards)
│   │   ├── overview.md        # docs pages...
│   │   └── changelog.md       # ported from the repo's CHANGELOG.md
│   └── styles/custom.css      # brand accent colors
├── public/favicon.svg
└── .github/workflows/deploy.yml   # GitHub Pages deployment
```

Pages are plain Markdown with a `title`/`description` frontmatter block. The sidebar is
configured explicitly in `astro.config.mjs`.

## Deploying

The site lives at **https://enhanced-s5js.org** (set as `site` in `astro.config.mjs`),
hosted for free on GitHub Pages.

### GitHub Pages (workflow included)

1. Push this repo to GitHub (**public** repo — required for free Pages), branch `main`.
2. In the repo settings: **Settings → Pages → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push
   to `main` (or manually via the Actions tab, `workflow_dispatch`).

### Custom Domain (enhanced-s5js.org)

1. **Settings → Pages → Custom domain**: enter `enhanced-s5js.org`, save.
2. At the domain registrar, create these DNS records (apex domains need `A` records,
   not a `CNAME`):

   | Type  | Name | Value                  |
   |-------|------|------------------------|
   | A     | @    | 185.199.108.153        |
   | A     | @    | 185.199.109.153        |
   | A     | @    | 185.199.110.153        |
   | A     | @    | 185.199.111.153        |
   | CNAME | www  | julesl23.github.io     |

3. Wait for DNS to propagate and GitHub's certificate check to pass, then tick
   **Enforce HTTPS** in the Pages settings. `www.enhanced-s5js.org` will redirect to the
   apex automatically.

### Cloudflare Pages / Netlify (alternative)

Connect the repo and use build command `npm run build`, output directory `dist`,
Node version 20. Set `site` in `astro.config.mjs` to the final URL.

## Content Maintenance

- **Docs pages** were ported from the mdBook at `s5.js/docs/grant/s5-docs-sdk-js/` (kept for a
  potential upstream PR to the S5 docs site). **This site is now the canonical public
  documentation** — update pages here on each release; only sync back to the mdBook if the
  upstream integration is revived.
- **Changelog**: `src/content/docs/changelog.md` mirrors the repo's `CHANGELOG.md` — copy new
  release entries over when publishing a release. Keeping this page fresh (dated, versioned
  entries) is the site's strongest "actively maintained" signal.
- Links between pages use site-absolute paths (`/path-api/#error-handling`); links to the S5
  protocol specification point at https://docs.sfive.net/.
