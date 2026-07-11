---
title: 'Path-based API Guide'
description: 'Filesystem-like get/put/delete/list operations, cursor pagination, and the typed error contract.'
---

The path-based API provides filesystem-like operations for working with files and directories on S5. This guide covers the core methods for storing and retrieving data.

## Overview

Enhanced s5.js uses a clean, path-based interface similar to traditional filesystems:

```typescript
await s5.fs.put('home/documents/report.pdf', pdfData);
const data = await s5.fs.get('home/documents/report.pdf');
await s5.fs.delete('home/documents/old-file.txt');
```

**Under the Hood:**
- Uses [CBOR serialization](https://docs.sfive.net/spec/file-system.html) (DAG-CBOR) for deterministic encoding
- Implements DirV1 directory format
- Content stored in distributed [Blob](https://docs.sfive.net/spec/blobs.html) storage
- Metadata stored in [Registry](https://docs.sfive.net/spec/registry.html)

## Core Methods

### get(path, options?)

Retrieve data from a file at the specified path.

```typescript
async get(path: string, options?: GetOptions): Promise<any | undefined>
```

**Parameters:**
- `path` - File path (e.g., "home/documents/file.txt")
- `options` - Optional configuration:
  - `defaultMediaType` - Default media type for content interpretation

**Returns:**
- Decoded file data (string, object, or Uint8Array)
- `undefined` if file doesn't exist

**Throws:**
- `S5DirectoryLoadError` with `retryable: true` if a directory on the path is *known to exist* (has a registry entry) but its content is temporarily unavailable (e.g., a transient blob 404 during network propagation). Retry with backoff — do **not** treat this as "file doesn't exist". See [Error Handling](#error-handling).

> **Behavior change (beta.50):** previously a transient 404 of a known directory made `get()` silently return `undefined`, indistinguishable from a genuinely missing file. It now throws a retryable `S5DirectoryLoadError` instead. A genuinely absent path (no registry entry) still returns `undefined`.

**Automatic Decoding:**

The method automatically detects and decodes data:

1. Attempts CBOR decoding (for objects)
2. Falls back to JSON parsing
3. Then UTF-8 text decoding
4. Returns raw Uint8Array if all fail

**Examples:**

```typescript
// Get text file
const content = await s5.fs.get("home/readme.txt");
console.log(content); // "Hello, world!"

// Get JSON/CBOR data (objects automatically decoded)
const config = await s5.fs.get("home/config.json");
console.log(config.version); // "1.0"

// Get binary data (images, PDFs, etc.)
const image = await s5.fs.get("home/photo.jpg");
console.log(image instanceof Uint8Array); // true

// Handle non-existent files
const missing = await s5.fs.get("home/not-found.txt");
if (missing === undefined) {
  console.log('File does not exist');
}

// Handle temporarily unavailable directories (transient network 404)
import { isS5DirectoryLoadError } from '@julesl23/s5js';

try {
  const data = await s5.fs.get("home/documents/report.pdf");
} catch (error) {
  if (isS5DirectoryLoadError(error) && error.retryable) {
    // Known directory, blob temporarily unavailable — retry with backoff
  } else {
    throw error;
  }
}
```

### put(path, data, options?)

Store data at the specified path, creating intermediate directories as needed.

```typescript
async put(path: string, data: any, options?: PutOptions): Promise<void>
```

**Parameters:**
- `path` - File path where data will be stored
- `data` - Data to store (string, object, Uint8Array, or Blob)
- `options` - Optional configuration:
  - `mediaType` - MIME type for the file
  - `timestamp` - Custom timestamp (milliseconds since epoch)

**Automatic Encoding:**
- Objects → CBOR encoding
- Strings → UTF-8 encoding
- Uint8Array/Blob → stored as-is
- Media type auto-detected from file extension

**Examples:**

```typescript
// Store text
await s5.fs.put("home/notes.txt", "My notes here");

// Store JSON data (automatically CBOR-encoded)
await s5.fs.put("home/data.json", {
  name: "Test",
  values: [1, 2, 3],
});

// Store binary data
const imageBlob = new Blob([imageData], { type: 'image/jpeg' });
await s5.fs.put("home/photo.jpg", imageBlob);

// Store with custom media type
await s5.fs.put("home/styles.css", cssContent, {
  mediaType: "text/css",
});

// Store with custom timestamp
await s5.fs.put("home/backup.txt", "content", {
  timestamp: Date.now() - 86400000, // 1 day ago
});

// Nested paths (creates intermediate directories)
await s5.fs.put("home/projects/app/src/index.ts", "console.log('hi')");
```

### getMetadata(path)

Retrieve metadata about a file or directory without downloading the content.

```typescript
async getMetadata(path: string): Promise<FileMetadata | DirectoryMetadata | undefined>
```

**Parameters:**
- `path` - File or directory path

**Returns:**
- Metadata object
- `undefined` if path doesn't exist

**File Metadata:**

```typescript
{
  type: "file",
  name: "example.txt",
  size: 1234,              // Size in bytes
  mediaType: "text/plain",
  timestamp: 1705432100000 // Milliseconds since epoch
}
```

**Directory Metadata:**

```typescript
{
  type: "directory",
  name: "documents",
  fileCount: 10,       // Number of files
  directoryCount: 3    // Number of subdirectories
}
```

**Examples:**

```typescript
// Get file metadata
const fileMeta = await s5.fs.getMetadata("home/document.pdf");
if (fileMeta) {
  console.log(`Size: ${fileMeta.size} bytes`);
  console.log(`Type: ${fileMeta.mediaType}`);
  console.log(`Modified: ${new Date(fileMeta.timestamp)}`);
}

// Get directory metadata
const dirMeta = await s5.fs.getMetadata("home/photos");
if (dirMeta && dirMeta.type === 'directory') {
  console.log(`Contains ${dirMeta.fileCount} files`);
  console.log(`Contains ${dirMeta.directoryCount} subdirectories`);
}

// Check if path exists
const exists = await s5.fs.getMetadata("home/file.txt") !== undefined;
```

### delete(path)

Delete a file or empty directory.

```typescript
async delete(path: string): Promise<boolean>
```

**Parameters:**
- `path` - File or directory path to delete

**Returns:**
- `true` if successfully deleted
- `false` if path doesn't exist

**Constraints:**
- Only empty directories can be deleted
- Root directories ("home", "archive") cannot be deleted
- Parent directory must exist

**Examples:**

```typescript
// Delete a file
const deleted = await s5.fs.delete("home/temp.txt");
console.log(deleted ? "Deleted" : "Not found");

// Delete an empty directory
await s5.fs.delete("home/empty-folder");

// Returns false for non-existent paths
const result = await s5.fs.delete("home/ghost.txt"); // false

// Cannot delete non-empty directory (will throw error)
try {
  await s5.fs.delete("home/photos"); // Has files inside
} catch (error) {
  console.error('Cannot delete non-empty directory');
}
```

### list(path, options?)

List contents of a directory with optional cursor-based pagination.

```typescript
async *list(path: string, options?: ListOptions): AsyncIterableIterator<ListResult>
```

**Parameters:**
- `path` - Directory path
- `options` - Optional configuration:
  - `limit` - Maximum items to return per iteration
  - `cursor` - Resume from previous position (for pagination)

**Yields:**

```typescript
interface ListResult {
  name: string;
  type: "file" | "directory";
  size?: number;         // File size in bytes (for files)
  mediaType?: string;    // MIME type (for files)
  timestamp?: number;    // Milliseconds since epoch
  cursor?: string;       // Pagination cursor
}
```

**Examples:**

```typescript
// List all items
for await (const item of s5.fs.list("home")) {
  console.log(`${item.type}: ${item.name}`);
}

// List with limit
for await (const item of s5.fs.list("home/photos", { limit: 50 })) {
  if (item.type === 'file') {
    console.log(`${item.name} - ${item.size} bytes`);
  }
}

// Collect items into array
const items = [];
for await (const item of s5.fs.list("home/documents")) {
  items.push(item);
}
console.log(`Found ${items.length} items`);

// Filter files only
for await (const item of s5.fs.list("home")) {
  if (item.type === 'file' && item.mediaType?.startsWith('image/')) {
    console.log(`Image: ${item.name}`);
  }
}
```

## Cursor-Based Pagination

For large directories (especially those using [HAMT sharding](/performance/)), use cursor-based pagination:

```typescript
// Get first page
const firstPage = [];
let lastCursor;

for await (const item of s5.fs.list("home/large-folder", { limit: 100 })) {
  firstPage.push(item);
  lastCursor = item.cursor;
}

// Get next page
if (lastCursor) {
  const secondPage = [];
  for await (const item of s5.fs.list("home/large-folder", {
    cursor: lastCursor,
    limit: 100,
  })) {
    secondPage.push(item);
  }
}
```

**Cursor Properties:**
- Stateless (encoded in the cursor string itself)
- Deterministic (same cursor always returns same results)
- CBOR-encoded position data
- See [Cursor Pagination](/performance/#cursor-pagination) for details

## Path Resolution

Paths follow these rules:

- **Relative to root**: Paths start from the root directory
- **Case-sensitive**: `home/File.txt` ≠ `home/file.txt`
- **Forward slashes**: Use `/` as separator (not `\`)
- **No leading slash**: Write `home/docs` (not `/home/docs`)
- **Unicode support**: Full UTF-8 support for filenames

**Valid Paths:**
```typescript
"home/documents/report.pdf"
"archive/photos/2024/vacation.jpg"
"home/日本語/ファイル.txt"  // Unicode supported
```

**Invalid Paths:**
```typescript
"/home/file.txt"           // No leading slash
"home\\file.txt"           // Use forward slash
"../other/file.txt"        // No relative navigation
"home//file.txt"           // No empty path segments
```

## Common Patterns

### Check if File Exists

```typescript
const exists = await s5.fs.getMetadata("home/file.txt") !== undefined;
```

### Safe File Read

```typescript
const content = await s5.fs.get("home/config.json");
const config = content ?? { /* default config */ };
```

### Conditional Upload

```typescript
const existing = await s5.fs.getMetadata("home/cache.dat");
if (!existing || Date.now() - existing.timestamp > 3600000) {
  await s5.fs.put("home/cache.dat", newCacheData);
}
```

### Rename File (Copy + Delete)

```typescript
// S5 doesn't have native rename, so copy + delete
const data = await s5.fs.get("home/old-name.txt");
await s5.fs.put("home/new-name.txt", data);
await s5.fs.delete("home/old-name.txt");
```

### Copy File

```typescript
const data = await s5.fs.get("home/source.txt");
await s5.fs.put("archive/backup.txt", data);
```

## Error Handling

### S5DirectoryLoadError (beta.50+)

The core error type for directory availability. It distinguishes two situations that used to be conflated:

- **Genuinely absent** (no registry entry): reads return `undefined`, as before.
- **Temporarily unavailable** (registry entry exists but the directory blob can't be downloaded right now, e.g. a transient 404 during propagation): a `S5DirectoryLoadError` with `retryable: true` is thrown.

```typescript
import { S5DirectoryLoadError, isS5DirectoryLoadError } from '@julesl23/s5js';

class S5DirectoryLoadError extends Error {
  retryable: boolean;                 // true → retry with backoff may succeed
  code: "S5_DIRECTORY_LOAD_ERROR";    // stable, bundle-safe discriminator
}

function isS5DirectoryLoadError(e: unknown): e is S5DirectoryLoadError
```

Use the `isS5DirectoryLoadError()` guard (or check `error.code`) rather than `instanceof`, which is unreliable across bundler boundaries.

**All path operations honor this contract.** Reads (`get`, `getMetadata`, `list`) throw it when a known directory is temporarily unavailable, and writes (`put`, `delete`, `createDirectory`) reject with the same typed error — so a transient outage can never be mistaken for an empty directory and overwritten.

```typescript
import { isS5DirectoryLoadError } from '@julesl23/s5js';

async function getWithRetry(path: string, maxAttempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await s5.fs.get(path);
    } catch (error) {
      if (isS5DirectoryLoadError(error) && error.retryable && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.min(500 * 2 ** attempt, 10000)));
        continue;
      }
      throw error;
    }
  }
}
```

> **Never catch a retryable `S5DirectoryLoadError` and treat it as "empty" or "absent".** Doing so (and then writing) is exactly the pattern that can orphan data.

A `retryable: false` error signals a structural problem that retrying cannot fix (e.g., an identity root missing both `home` and `archive`) — see `ensureIdentityInitialized({ repair: true })` in the [API Reference](/api-reference/).

### General Error Handling

```typescript
try {
  await s5.fs.put("home/test.txt", "data");
} catch (error) {
  if (isS5DirectoryLoadError(error) && error.retryable) {
    console.error('Directory temporarily unavailable - retry with backoff');
  } else if (error.message.includes('No portals available')) {
    console.error('Register on a portal first');
  } else if (error.message.includes('Invalid path')) {
    console.error('Check path format');
  } else {
    throw error; // Unexpected error
  }
}
```

**Common Errors:**
- `S5DirectoryLoadError` (`retryable: true`) - Directory temporarily unavailable; retry with backoff
- `S5DirectoryLoadError` (`retryable: false`) - Structural problem; needs explicit repair
- `No portals available for upload` - Register on portal first
- `Invalid path` - Check path format
- `Cannot delete non-empty directory` - Delete contents first
- `Invalid cursor` - Cursor may be from different directory state

## Best Practices

1. **Use getMetadata() for existence checks** - Faster than `get()` for large files
2. **Implement pagination for large directories** - Essential when using HAMT (1000+ entries)
3. **Handle undefined returns** - Files may not exist or may have been deleted
4. **Retry on retryable `S5DirectoryLoadError`** - Transient unavailability is thrown, not returned as `undefined`; retry with backoff instead of treating it as absent
4. **Use appropriate data types** - Objects for structured data, Uint8Array for binary
5. **Set custom timestamps** - For import/migration scenarios
6. **Batch operations** - Use [BatchOperations](/utilities/) for multiple files

## Performance Considerations

- **Small directories**: List operations are O(n)
- **Large directories (1000+ entries)**: Automatic HAMT sharding makes list operations O(log n)
- **File retrieval**: Single network roundtrip for metadata + blob download
- **Cursor pagination**: Stateless, no server-side state maintained

See [Performance & Scaling](/performance/) for detailed benchmarks and optimization strategies.

## TypeScript Types

```typescript
interface PutOptions {
  mediaType?: string;
  timestamp?: number;
}

interface GetOptions {
  defaultMediaType?: string;
}

interface ListOptions {
  limit?: number;
  cursor?: string;
}

interface ListResult {
  name: string;
  type: "file" | "directory";
  size?: number;
  mediaType?: string;
  timestamp?: number;
  cursor?: string;
}
```

## Reading Another User's Data

The methods above all operate on **your own** filesystem. For reading files and subscribing to live updates under **another user's** public directory tree (e.g., a creator's or operator's shared storefront), see [Cross-Identity Public Directory Access](/cross-identity/) — the reader-side methods do not require identity.

## Next Steps

- **[Media Processing](/media/)** - Upload images with automatic thumbnails
- **[Directory Utilities](/utilities/)** - Recursive traversal and batch operations
- **[Identity & Signing API](/identity/)** - Portal registration with Ed25519 signing
- **[Cross-Identity Public Directory Access](/cross-identity/)** - Multi-user reads and live subscriptions
- **[Encryption](/encryption/)** - Encrypt files for privacy
- **[Performance](/performance/)** - HAMT sharding for large directories
