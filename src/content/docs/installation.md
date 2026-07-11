---
title: 'Installation & Setup'
description: 'Install @julesl23/s5js, configure TypeScript and bundlers, and enable debug logging.'
---

> **Beta Status**: Enhanced s5.js is currently in beta. Install with the `@beta` tag to get the latest release.

## Package Installation

Install Enhanced s5.js from npm:

```bash
npm install @julesl23/s5js@beta
```

## Requirements

### Node.js

- **Version**: Node.js 20 or higher
- **Check version**: `node --version`
- **Download**: [nodejs.org](https://nodejs.org/)

### Browser

Modern browsers with ES2022 support:
- Chrome 94+ / Edge 94+
- Firefox 93+
- Safari 15+

**Required Browser Features:**
- ES modules (`import`/`export`)
- WebAssembly (for media processing)
- IndexedDB (for local caching)
- Native fetch and WebSocket APIs

## Import Options

Enhanced s5.js provides modular exports for optimal bundle sizes:

### Full Bundle (Recommended for Getting Started)

```typescript
import { S5, generatePhrase } from '@julesl23/s5js';
```

**Size**: 61.14 KB (brotli)
**Includes**: All features (storage, media, CID utilities)

### Core Only (Optimized for Storage Apps)

```typescript
import { S5, FS5 } from '@julesl23/s5js/core';
```

**Size**: 59.58 KB (brotli)
**Includes**: Storage operations only (no media processing)

### Media Processing (Standalone or Lazy-Loaded)

```typescript
import { MediaProcessor } from '@julesl23/s5js/media';
```

**Size**: 9.79 KB (brotli)
**Includes**: Image thumbnails, metadata extraction

### Advanced CID API (Power Users)

```typescript
import { FS5Advanced, formatCID, parseCID } from '@julesl23/s5js/advanced';
```

**Size**: 60.60 KB (brotli)
**Includes**: Core + content-addressed storage utilities

## TypeScript Configuration

Enhanced s5.js is written in TypeScript and includes full type definitions.

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

### Type Imports

```typescript
import type {
  PutOptions,
  GetOptions,
  ListOptions,
  ListResult
} from '@julesl23/s5js';
```

## Bundler Configuration

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false
    }
  },
  experiments: {
    asyncWebAssembly: true
  }
};
```

### Vite

```javascript
// vite.config.js
export default {
  build: {
    target: 'es2022',
    rollupOptions: {
      external: []
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  }
};
```

### Rollup

```javascript
// rollup.config.js
export default {
  output: {
    format: 'es',
    generatedCode: {
      preset: 'es2015'
    }
  }
};
```

> **Note**: Enhanced s5.js uses native browser APIs (`globalThis.fetch`, `WebSocket`) and does not require Node.js-specific polyfills for browser builds.

## Environment-Specific Setup

### Browser Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>S5 App</title>
</head>
<body>
  <script type="module">
    import { S5 } from '@julesl23/s5js';

    const s5 = await S5.create();
    console.log('S5 initialized!');
  </script>
</body>
</html>
```

### Node.js Setup

```typescript
// main.ts or main.js
import { S5 } from '@julesl23/s5js';

async function main() {
  const s5 = await S5.create({
    initialPeers: [
      "wss://z2DWuPbL5pweybXnEB618pMnV58ECj2VPDNfVGm3tFqBvjF@s5.ninja/s5/p2p"
    ]
  });

  console.log('S5 initialized!');
}

main().catch(console.error);
```

Run with:
```bash
node --loader ts-node/esm main.ts  # TypeScript
node main.js                        # JavaScript
```

## Bundle Size Optimization

### Strategy 1: Import Only What You Need

```typescript
// ❌ Don't import everything if you only need storage
import { S5 } from '@julesl23/s5js';

// ✅ Import core only
import { S5 } from '@julesl23/s5js/core';
```

### Strategy 2: Lazy Load Media Features

```typescript
// Load core immediately
import { S5 } from '@julesl23/s5js/core';

// Lazy load media when needed
async function processImage(imageBlob: Blob) {
  const { MediaProcessor } = await import('@julesl23/s5js/media');
  await MediaProcessor.initialize();
  return await MediaProcessor.extractMetadata(imageBlob);
}
```

**Savings**: ~9 KB by lazy-loading media features

### Strategy 3: Tree Shaking

Ensure your bundler supports tree shaking:

```json
// package.json
{
  "sideEffects": false
}
```

Modern bundlers (Webpack 5, Rollup, esbuild) will automatically remove unused code.

## Verifying Installation

Create a test file to verify installation:

```typescript
// test.ts
import { S5 } from '@julesl23/s5js';

async function test() {
  console.log('Creating S5 instance...');
  const s5 = await S5.create();
  console.log('✅ S5.js installed correctly!');
}

test().catch(console.error);
```

Run it:
```bash
node --loader ts-node/esm test.ts
```

Expected output:
```
Creating S5 instance...
✅ S5.js installed correctly!
```

## Troubleshooting

### "Cannot find module '@julesl23/s5js'"

1. Ensure the package is installed: `npm install @julesl23/s5js@beta`
2. Check `package.json` dependencies
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### "globalThis.fetch is not a function"

- Ensure you're using Node.js 20+ which includes native fetch
- Upgrade Node.js: `nvm install 20` or download from [nodejs.org](https://nodejs.org/)

### Bundle Size Too Large

1. Use core-only import: `@julesl23/s5js/core`
2. Enable tree shaking in your bundler
3. Check for duplicate dependencies: `npm dedupe`
4. Analyze bundle: `npm run analyze-bundle` (if using webpack-bundle-analyzer)

### TypeScript Errors

1. Ensure `tsconfig.json` targets ES2022 or higher
2. Add `"types": ["node"]` to compilerOptions
3. Install type definitions: `npm install --save-dev @types/node`

## Debug Logging

Enhanced s5.js uses the standard [`debug`](https://www.npmjs.com/package/debug) package for runtime diagnostics. Enable it with the `DEBUG` environment variable (Node.js) or `localStorage.debug` (browser).

### Node.js

```bash
# All S5.js debug output
DEBUG=s5js:* node app.js

# Specific category only
DEBUG=s5js:registry node app.js
DEBUG=s5js:download node app.js

# Multiple categories
DEBUG=s5js:registry,s5js:download node app.js

# All except one
DEBUG=s5js:*,-s5js:cbor node app.js
```

### Browser

Set `localStorage.debug` in the DevTools console before the page loads S5.js:

```javascript
localStorage.debug = 's5js:*';
// Then reload the page.
```

### Available Categories

| Namespace | What it logs |
|-----------|--------------|
| `s5js:node` | P2P node lifecycle and peer connections |
| `s5js:registry` | Registry entry reads/writes (`registryGet`, `registrySet`, `registryListen`) |
| `s5js:api` | Core API calls (`S5APIWithIdentity` init, portal routing) |
| `s5js:fs5` | File system operations, directory metadata, transaction retries |
| `s5js:upload` | Blob upload path (portal selection, cache writes) |
| `s5js:download` | Blob download path (P2P discovery, portal fallback, cache hits) |
| `s5js:directory` | Directory load/update operations |
| `s5js:revision` | Registry revision tracking (useful for debugging "revision too low" errors) |
| `s5js:cbor` | CBOR serialization trace (verbose; usually not needed) |
| `s5js:cache` | Blob and registry cache operations |
| `s5js:batch` | `BatchOperations` progress and errors |
| `s5js:walker` | `DirectoryWalker` traversal |
| `s5js:identity` | Identity initialization, seed derivation, signing |
| `s5js:hidden_db` | Hidden DB reads/writes (internal storage layer) |

### Typical Troubleshooting Flows

- **"Directory does not exist" errors**: `DEBUG=s5js:fs5,s5js:registry` — shows registry lookups and directory load attempts.
- **Slow uploads**: `DEBUG=s5js:upload,s5js:api` — shows portal selection and blob upload timing.
- **Download failures / 404s**: `DEBUG=s5js:download,s5js:cache` — shows P2P discovery, portal fallback, and cache behavior.
- **Revision conflicts**: `DEBUG=s5js:revision,s5js:registry` — shows revision numbers and retry attempts.

## Next Steps

- **[Quick Start Tutorial](/quick-start/)** - Build your first S5 app in 5 minutes
- **[Path-based API](/path-api/)** - Learn core file operations
- **[Examples on GitHub](https://github.com/julesl23/s5.js/tree/main/demos)** - Working code examples
