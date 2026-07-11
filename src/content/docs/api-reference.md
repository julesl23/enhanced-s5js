---
title: 'API Reference'
description: 'Complete reference for classes, methods, types, constants, and error types.'
---

Complete API reference for Enhanced s5.js.

## Core Classes

### S5

Main entry point for the SDK.

```typescript
class S5 {
  static async create(options?: S5Options): Promise<S5>

  api: S5APIInterface
  fs: FS5   // memoized since beta.49 — s5.fs === s5.fs (stable instance sharing caches)

  generateSeedPhrase(): string
  async recoverIdentityFromSeedPhrase(seedPhrase: string): Promise<void>
  async registerOnNewPortal(portalUrl: string, inviteCode?: string): Promise<void>

  // Connection API
  getConnectionStatus(): ConnectionStatus
  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void
  async reconnect(): Promise<void>

  // Public Download API
  async downloadByCID(cid: string | Uint8Array): Promise<Uint8Array>

  // Identity & Signing API (see identity.md)
  getSigningPublicKey(seed?: Uint8Array): Uint8Array
  async sign(data: Uint8Array, seed?: Uint8Array): Promise<string>
  setPortalAuth(portalUrl: string, authToken: string): void
  async storePortalCredentials(
    portalUrl: string,
    seed: Uint8Array,
    authToken: string
  ): Promise<void>
}
```

### FS5

File system operations with path-based API.

```typescript
class FS5 {
  constructor(api: S5APIInterface, identity?: S5UserIdentity, options?: { directoryCacheTtlMs?: number })

  async get(path: string, options?: GetOptions): Promise<any | undefined>
  async put(path: string, data: any, options?: PutOptions): Promise<void>
  async delete(path: string): Promise<boolean>
  async getMetadata(path: string): Promise<Metadata | undefined>
  list(path: string, options?: ListOptions): AsyncIterableIterator<ListResult>

  // Identity root initialization. Creates home/archive only for a genuinely new
  // identity (no root registry entry); heals a partial root (one of the two
  // missing); throws a non-retryable S5DirectoryLoadError if the root exists but
  // has neither — pass { repair: true } to explicitly recreate them.
  async ensureIdentityInitialized(opts?: { repair?: boolean }): Promise<void>

  // Media operations
  async putImage(path: string, imageBlob: Blob, options?: ImageOptions): Promise<ImageResult>
  async getThumbnail(path: string, options?: GetThumbnailOptions): Promise<Blob>  // generates on-demand if absent
  async getImageMetadata(path: string): Promise<ImageMetadata>

  // Cross-Identity Public Directory Access (see cross-identity.md)
  async getPublicDirectoryKey(path: string): Promise<Uint8Array>
  async readFromPublicDirectory(
    remotePubKey: Uint8Array,
    subpath: string
  ): Promise<Uint8Array | undefined>
  async getPublicDirectoryKeyFrom(
    remotePubKey: Uint8Array,
    subpath: string
  ): Promise<Uint8Array | undefined>
}
```

## Advanced Classes

### FS5Advanced

Content-addressed storage operations.

```typescript
class FS5Advanced {
  constructor(fs: FS5)

  async pathToCID(path: string): Promise<Uint8Array>
  async cidToPath(cid: Uint8Array): Promise<string | null>
  async getByCID(cid: Uint8Array): Promise<any | undefined>
  async putByCID(data: any): Promise<Uint8Array>
  async putWithCID(path: string, data: any, options?: PutOptions): Promise<PutWithCIDResult>
  async getMetadataWithCID(path: string): Promise<MetadataWithCIDResult | undefined>
}
```

### DirectoryWalker

Recursive directory traversal.

```typescript
class DirectoryWalker {
  constructor(fs: FS5)

  walk(path: string, options?: WalkOptions): AsyncIterableIterator<WalkEntry>
}
```

### BatchOperations

Batch file operations with progress.

```typescript
class BatchOperations {
  constructor(fs: FS5)

  async copyDirectory(source: string, dest: string, options?: BatchOptions): Promise<BatchResult>
  async deleteDirectory(path: string, options?: BatchOptions): Promise<BatchResult>
}
```

### MediaProcessor

Image processing and metadata extraction.

```typescript
class MediaProcessor {
  static async initialize(options?: InitOptions): Promise<void>
  static async extractMetadata(blob: Blob): Promise<ImageMetadata>
  static getProcessingStrategy(): ProcessingStrategy
}
```

## Utility Functions

### CID Utilities

```typescript
function formatCID(cid: Uint8Array, format?: CIDFormat): string
function parseCID(cidString: string): Uint8Array
function verifyCID(cid: Uint8Array, data: Uint8Array, crypto: CryptoImplementation): Promise<boolean>
function cidToString(cid: Uint8Array): string
function detectCIDFormat(cid: string): CIDFormat
function cidStringToHash(cid: string): Uint8Array
function cidToDownloadFormat(cid: string | Uint8Array): string
```

### Seed Phrase

```typescript
function generatePhrase(crypto: CryptoImplementation): string
```

## Type Definitions

### Connection Types

```typescript
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
```

### Core Options

```typescript
interface S5Options {
  initialPeers?: string[];
  skipIdentityLoad?: boolean;     // skip loading a cached identity from IndexedDB
  directoryCacheTtlMs?: number;   // directory-metadata cache TTL (default: 30000)
}

interface PutOptions {
  mediaType?: string;
  timestamp?: number;
  encrypt?: boolean;
  encryptionKey?: Uint8Array;
}

interface GetOptions {
  defaultMediaType?: string;
  encryptionKey?: Uint8Array;
}

interface ListOptions {
  limit?: number;
  cursor?: string;
}
```

### Result Types

```typescript
interface ListResult {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mediaType?: string;
  timestamp?: number;
  cursor?: string;
}

interface Metadata {
  type: 'file' | 'directory';
  name: string;
  size?: number;
  mediaType?: string;
  timestamp?: number;
  fileCount?: number;        // directories only
  directoryCount?: number;   // directories only
}
```

### Media Types

```typescript
interface ImageOptions {
  generateThumbnail?: boolean;
  thumbnailMaxWidth?: number;
  thumbnailMaxHeight?: number;
  thumbnailQuality?: number;
  preserveAspectRatio?: boolean;
}

interface ImageResult {
  path: string;
  thumbnailPath?: string;
  metadata: ImageMetadata;
}

interface GetThumbnailOptions {
  thumbnailOptions?: ImageOptions;  // options if generating on-demand
  cache?: boolean;                  // cache the generated thumbnail (default: true)
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  dominantColors?: DominantColor[];
  aspectRatio?: 'landscape' | 'portrait' | 'square';
  commonAspectRatio?: string;
  aspectRatioValue?: number;
  isMonochrome?: boolean;
  processingTime?: number;
  processingSpeed?: 'fast' | 'normal' | 'slow';
  source: 'wasm' | 'canvas';
}

interface DominantColor {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
}
```

### Advanced Types

```typescript
interface PutWithCIDResult {
  cid: Uint8Array;
}

interface MetadataWithCIDResult extends Metadata {
  cid: Uint8Array;
}

type CIDFormat = 'base32' | 'base58btc' | 'hex';
type ProcessingStrategy = 'wasm-worker' | 'wasm-main' | 'canvas-worker' | 'canvas-main';
```

### Utility Types

```typescript
interface WalkOptions {
  recursive?: boolean;
  maxDepth?: number;
  filter?: (entry: WalkEntry) => boolean;
}

interface WalkEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  mediaType?: string;
  timestamp?: number;
}

interface BatchOptions {
  recursive?: boolean;
  onProgress?: (progress: BatchProgress) => void;
  onError?: 'stop' | 'continue' | ((error: Error, path: string) => 'stop' | 'continue');
}

interface BatchProgress {
  processed: number;
  total: number;
  currentPath: string;
  success: number;
  failed: number;
}

interface BatchResult {
  success: number;
  failed: number;
  errors: Array<{ path: string; error: Error }>;
}
```

### Browser Compatibility

```typescript
interface BrowserCapabilities {
  webAssembly: boolean;
  webAssemblyStreaming: boolean;
  sharedArrayBuffer: boolean;
  webWorkers: boolean;
  offscreenCanvas: boolean;
  createImageBitmap: boolean;
  webP: boolean;
  avif: boolean;
  webGL: boolean;
  webGL2: boolean;
  performanceAPI: boolean;
  memoryInfo: boolean;
  memoryLimit: number;
}
```

## Constants

```typescript
// Multicodec prefixes
const MULTIHASH_BLAKE3: number = 0x1e;

// Portal challenge types (used with s5.sign() — see identity.md)
const CHALLENGE_TYPE_REGISTER: number = 1;
const CHALLENGE_TYPE_LOGIN: number = 2;

// Default values
const DEFAULT_THUMBNAIL_MAX_WIDTH = 200;
const DEFAULT_THUMBNAIL_MAX_HEIGHT = 200;
const DEFAULT_THUMBNAIL_QUALITY = 0.8;
const DEFAULT_HAMT_THRESHOLD = 1000;
```

## Error Types

```typescript
// Exported from '@julesl23/s5js', '/core', and '/advanced' (beta.50+)
class S5DirectoryLoadError extends Error {
  readonly retryable: boolean;                // true → retry with backoff; false → needs explicit repair
  readonly code: "S5_DIRECTORY_LOAD_ERROR";   // stable discriminator (prefer over instanceof)
}

// Bundle-safe type guard (checks `code`, not the prototype chain)
function isS5DirectoryLoadError(e: unknown): e is S5DirectoryLoadError

class S5Error extends Error {
  constructor(message: string)
}

// Common error messages
'No portals available for upload'
'Invalid path'
'File not found'
'Cannot delete non-empty directory'
'Invalid cursor'
'Failed to decrypt'
'Unsupported format'
'Invalid CID size'
'No portals configured'
'All portals failed'
'Hash verification failed'
```

## Export Paths

```typescript
// Full bundle (61.14 KB brotli)
import { S5, FS5 } from '@julesl23/s5js';

// Core only (59.58 KB brotli)
import { S5, FS5 } from '@julesl23/s5js/core';

// Media only (9.79 KB brotli)
import { MediaProcessor } from '@julesl23/s5js/media';

// Advanced (60.60 KB brotli)
import { FS5Advanced, formatCID } from '@julesl23/s5js/advanced';
```

## Browser Support

- **Node.js**: 20.0.0 or higher
- **Chrome/Edge**: 94+
- **Firefox**: 93+
- **Safari**: 15+
- **WebAssembly**: Required for media processing (with Canvas fallback)
- **IndexedDB**: Required for local caching

## Next Steps

- **[Quick Start](/quick-start/)** - Get started in 5 minutes
- **[Path-based API](/path-api/)** - Core file operations
- **[Identity & Signing API](/identity/)** - Ed25519 signing for portal registration
- **[Cross-Identity Public Directory Access](/cross-identity/)** - Multi-user reads and live subscriptions
- **[Media Processing](/media/)** - Image processing
- **[Advanced CID API](/advanced-cid/)** - Content-addressed storage
- **[GitHub Repository](https://github.com/julesl23/s5.js)** - Source code and examples
