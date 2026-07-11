---
title: 'Overview'
description: 'What Enhanced s5.js is: key features, architecture, bundle sizes, and project status.'
---

Enhanced s5.js is a comprehensive TypeScript SDK for building S5 applications in browsers and Node.js environments.

## Key Features

- **Path-based API** - Familiar filesystem-like operations (`get`, `put`, `delete`, `list`)
- **Connection API** - Monitor and manage P2P connections for mobile apps
- **Identity & Signing API** - Ed25519 signing for backend-mediated portal registration
- **Cross-Identity Public Directory Access** - Read another user's public tree and live-subscribe to updates, no identity required on the reader side
- **Public Download by CID** - Share content between users via CID strings with BLAKE3 verification
- **Media Processing** - Client-side thumbnail generation and metadata extraction
- **HAMT Sharding** - Efficient handling of directories with millions of entries
- **Built-in Caching** - Directory-metadata, registry, and blob caches for fast repeated reads
- **Typed Error Contract** - `S5DirectoryLoadError` with a `retryable` flag distinguishes "temporarily unavailable" from "genuinely absent"
- **Advanced CID API** - Content-addressed storage for power users
- **Bundle Optimization** - Modular imports for optimal bundle sizes (61 KB compressed)
- **TypeScript Support** - Full type definitions and IDE autocomplete
- **Dual Environment** - Works in both browser and Node.js 20+

## Package Information

- **npm**: [@julesl23/s5js](https://www.npmjs.com/package/@julesl23/s5js)
- **GitHub**: [julesl23/s5.js](https://github.com/julesl23/s5.js)
- **Author**: Jules Lai, founder of [Fabstir](https://fabstir.com)
- **License**: MIT OR Apache-2.0
- **Version**: 0.9.0-beta.50

## Architecture

Enhanced s5.js implements the [S5 Protocol Specifications](https://docs.sfive.net/spec/index.html) with developer-friendly abstractions:

- **CBOR Serialization** - Uses DAG-CBOR for deterministic cross-implementation compatibility
- **DirV1 Format** - Clean directory format with optional HAMT sharding for large directories
- **XChaCha20-Poly1305** - Modern encryption for private data
- **Cursor Pagination** - Stateless iteration through large directories

## Quick Example

```typescript
import { S5 } from '@julesl23/s5js';

// Create instance and connect to network
const s5 = await S5.create({
  initialPeers: [
    "wss://z2DWuPbL5pweybXnEB618pMnV58ECj2VPDNfVGm3tFqBvjF@s5.ninja/s5/p2p"
  ]
});

// Generate or recover identity
await s5.recoverIdentityFromSeedPhrase(seedPhrase);

// Store and retrieve data
await s5.fs.put('home/hello.txt', 'Hello, S5!');
const content = await s5.fs.get('home/hello.txt');
```

## Documentation Structure

- **[Installation & Setup](/installation/)** - Get started with npm installation and configuration
- **[Quick Start](/quick-start/)** - 5-minute tutorial from setup to first upload
- **[Connection API](/connection/)** - Monitor and manage P2P connections for mobile apps
- **[Path-based API](/path-api/)** - File operations with filesystem-like interface
- **[Identity & Signing API](/identity/)** - Ed25519 signing for backend-mediated portal registration
- **[Cross-Identity Public Directory Access](/cross-identity/)** - Read and subscribe to another user's public directory tree
- **[Media Processing](/media/)** - Image thumbnails and metadata extraction
- **[Advanced CID API](/advanced-cid/)** - Content-addressed storage utilities
- **[Performance & Scaling](/performance/)** - HAMT sharding for large directories
- **[Directory Utilities](/utilities/)** - Batch operations and recursive traversal
- **[Encryption](/encryption/)** - Secure your data with XChaCha20-Poly1305
- **[API Reference](/api-reference/)** - Complete API documentation

## Browser and Node.js Support

### Browser

- Modern browsers with ES2022 support (Chrome 94+, Firefox 93+, Safari 15+)
- WebAssembly support (for media processing)
- IndexedDB for local caching
- Native fetch and WebSocket APIs

### Node.js

- **Version**: Node.js 20 or higher required
- Uses native `globalThis.fetch` (no external HTTP client needed)
- Memory-level storage for development
- Full TypeScript support

## Bundle Sizes

Enhanced s5.js uses modular exports for optimal bundle sizes:

| Import Path | Size (brotli) | Use Case |
|-------------|--------------|----------|
| `@julesl23/s5js` | 61.14 KB | Full functionality |
| `@julesl23/s5js/core` | 59.58 KB | Storage only (no media) |
| `@julesl23/s5js/media` | 9.79 KB | Media processing standalone |
| `@julesl23/s5js/advanced` | 60.60 KB | Core + CID utilities |

> **Bundle Size Achievement**: At 61 KB compressed, Enhanced s5.js is 10× under the 700 KB grant requirement, making it suitable for production web applications.

## Next Steps

1. **[Install the package](/installation/)** - npm installation and setup
2. **[Follow the Quick Start](/quick-start/)** - Build your first S5 app
3. **[Explore the API](/path-api/)** - Learn the core operations
4. **[Join the Community](https://discord.gg/Pdutsp5jqR)** - Get help and share feedback

## Implementation Status

Enhanced s5.js is currently in **beta** (v0.9.0-beta.50):

- ✅ All grant milestones completed (Months 1-8)
- ✅ 581 tests passing
- ✅ Real S5 portal integration validated
- ✅ Production-ready bundle size (61 KB brotli, 10× under the 700 KB grant target)
- ✅ Production-validated via the Fabstir platform
- 🔄 Continued post-grant development (cross-identity access, concurrency hardening, identity signing, directory-metadata caching, typed error contract, data-loss hardening)
- 📅 Upstream PR submission in progress

Found a bug or have feedback? [Open an issue on GitHub](https://github.com/julesl23/s5.js/issues).
