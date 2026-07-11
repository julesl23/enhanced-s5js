---
title: 'Cross-Identity Public Directory Access'
description: 'Read another user''s public directory tree and subscribe to live updates — no identity required.'
---

Enhanced s5.js supports reading files from another user's public directory tree and subscribing to live updates — without needing their identity. This powers multi-user workflows such as creator/operator platforms, follower fan-out, public content indexes, and reactive UIs that receive push updates without polling.

## Overview

FS5 child directories are stored **unencrypted** — only the root directory is encrypted. The barrier to cross-identity access is that outsiders cannot compute the directory's registry public key (derived from the owner's identity). Three methods solve this:

1. **Owner** extracts a directory's 32-byte Ed25519 public key via `getPublicDirectoryKey()` and shares it
2. **Reader** uses that key to read file content via `readFromPublicDirectory()` (no identity required)
3. **Reader** resolves sub-directory pubkeys via `getPublicDirectoryKeyFrom()` and subscribes to push updates via `api.registryListen(pk)`

Together, these enable genuine multi-identity app architectures on S5.

## getPublicDirectoryKey()

Extract the 32-byte Ed25519 public key for one of your own directories. Requires an initialized identity.

```typescript
async getPublicDirectoryKey(path: string): Promise<Uint8Array>
```

**Parameters:**
- `path` — Path to a directory in your own filesystem (e.g., `"home/storefront"`)

**Returns:** 32-byte `Uint8Array` (Ed25519 public key without the 0xed multikey prefix)

**Throws:** If the directory doesn't exist or doesn't use an Ed25519 registry key.

```typescript
// Owner: extract and share
const pubKey = await s5.fs.getPublicDirectoryKey("home/storefront");
const keyString = base64url(pubKey); // Share with readers via your app
```

## readFromPublicDirectory()

Read a file from another user's unencrypted directory tree. Does **not** require identity — only needs network access through `s5.api`.

```typescript
async readFromPublicDirectory(
  remotePubKey: Uint8Array,
  subpath: string
): Promise<Uint8Array | undefined>
```

**Parameters:**
- `remotePubKey` — 32-byte Ed25519 public key (from the owner's `getPublicDirectoryKey()`)
- `subpath` — Path within the remote directory (e.g., `"config/brand.json"`)

**Returns:** Raw file bytes as `Uint8Array`, or `undefined` if the file is not found, the path is invalid, or the file is encrypted.

**Throws:** If `remotePubKey` is not exactly 32 bytes.

```typescript
// Reader: no identity required
const viewerFs = new FS5(api);

const data = await viewerFs.readFromPublicDirectory(
  remotePubKey,
  "config/brand.json"
);
if (data) {
  const config = JSON.parse(new TextDecoder().decode(data));
}
```

## getPublicDirectoryKeyFrom()

Resolve the 32-byte Ed25519 registry public key for any sub-directory under another user's tree. Does **not** require identity. The returned pubkey is ready to pass directly to `api.registryListen(pk)` for live push subscriptions.

```typescript
async getPublicDirectoryKeyFrom(
  remotePubKey: Uint8Array,
  subpath: string
): Promise<Uint8Array | undefined>
```

**Parameters:**
- `remotePubKey` — 32-byte Ed25519 public key (from `getPublicDirectoryKey()` or a shared root pubkey)
- `subpath` — Path within the remote directory (e.g., `"followers/alice/follow"`). Empty string (`""`) or `"/"` returns the input `remotePubKey` unchanged (pass-through).

**Returns:** 32-byte `Uint8Array` (Ed25519 public key without the 0xed multikey prefix), or `undefined` if any segment is missing, the final segment is a file, the link is immutable (`fixed_hash_blake3`), or an intermediate directory is encrypted.

**Throws:** If `remotePubKey` is not exactly 32 bytes.

```typescript
// Reader: subscribe to live updates under another user's sub-directory
const newsPk = await viewerFs.getPublicDirectoryKeyFrom(
  remotePubKey,
  "home/platform/acme/news"
);
if (newsPk) {
  // Push updates — no polling
  for await (const entry of api.registryListen(newsPk)) {
    refreshNewsFeed(entry);
  }
}
```

## Behavior Details

### `readFromPublicDirectory()` return values

| Scenario | Result |
|----------|--------|
| File found | `Uint8Array` (raw bytes) |
| File not found | `undefined` |
| Directory segment missing | `undefined` |
| No registry entry for key | `undefined` |
| Encrypted file | `undefined` (reader cannot decrypt) |
| Encrypted intermediate directory | `undefined` (defensive; child dirs are unencrypted in practice) |
| Empty subpath | `undefined` |
| Invalid key length | Throws `Error` |

### `getPublicDirectoryKeyFrom()` return values

| Scenario | Result |
|----------|--------|
| Directory found on a mutable-registry (Ed25519) link | 32-byte `Uint8Array` pubkey |
| Empty subpath (`""` or `"/"`) | input `remotePubKey` unchanged (pass-through) |
| Any segment missing | `undefined` |
| Final segment is a file, not a directory | `undefined` |
| Any segment is a `fixed_hash_blake3` (immutable) link | `undefined` (no registry entry to subscribe to) |
| No registry entry for remote pubkey | `undefined` |
| Encrypted intermediate directory | `undefined` (defensive) |
| Invalid key length | Throws `Error` |

### Transient Unavailability (beta.50+)

"Missing" in the tables above means *genuinely absent* (no registry entry). If a directory along the subpath is known to exist but its content is **temporarily unavailable** (a transient blob 404 during network propagation), both methods throw a retryable `S5DirectoryLoadError` instead of returning `undefined` — so a momentary outage is never mistaken for deleted content. Retry with backoff. A 404 of the final *file's content* in `readFromPublicDirectory()` still returns `undefined` (best-effort read). See [Error Handling](/path-api/#error-handling).

## End-to-End Example

A storefront operator publishes content; viewers read it and subscribe to a news feed for live updates.

```typescript
import { S5, FS5 } from '@julesl23/s5js';

// === Operator (one-time setup) ===
const operatorS5 = await S5.create({ initialPeers: [...] });
await operatorS5.recoverIdentityFromSeedPhrase(seedPhrase);

// Publish content
await operatorS5.fs.put("home/storefront/catalogue.json", catalogueData);
await operatorS5.fs.put("home/storefront/news/latest.json", latestNews);

// Extract and share the root storefront public key
const storefrontPubKey = await operatorS5.fs.getPublicDirectoryKey(
  "home/storefront"
);
// Share storefrontPubKey with viewers (platform config, URL param, etc.)

// === Viewer (reading files — no identity required) ===
const viewerS5 = await S5.create({ initialPeers: [...] });
// Note: no recoverIdentityFromSeedPhrase() call

const data = await viewerS5.fs.readFromPublicDirectory(
  storefrontPubKey,
  "catalogue.json"
);
const catalogue = JSON.parse(new TextDecoder().decode(data!));

// === Viewer (live subscribing to news updates) ===
const newsPk = await viewerS5.fs.getPublicDirectoryKeyFrom(
  storefrontPubKey,
  "news"
);
if (newsPk) {
  // Iterator yields RegistryEntry on every update to the news directory
  for await (const entry of viewerS5.api.registryListen(newsPk)) {
    console.log("News updated, refreshing…");
    await refreshNewsFeed(viewerS5.fs, storefrontPubKey);
  }
}
```

## Use Cases

- **Creator / operator platforms** — operators publish storefronts; viewers read them without needing operator credentials.
- **Follower fan-out** — a creator subscribes to each follower's `follow` record for push updates, replacing polling.
- **Cross-persona data sharing** — in apps with multiple personas per user, one persona publishes while another reads.
- **Public content indexes** — a service maintains a public index of resources that clients read and subscribe to.
- **Reactive UIs** — replace polling with `registryListen()` subscriptions over cross-identity pubkeys.

## Security & Privacy Considerations

- **Access control**: Once you share a directory's public key, anyone with it can read every file in that directory tree. Only share pubkeys for data you genuinely want to be public.
- **Encryption**: FS5 child directories are unencrypted; only the root is encrypted. Don't put private data in child directories and then share a public key for them.
- **Identity leakage**: The returned 32-byte pubkeys do not leak the owner's identity seed or signing keys — they're derived public values. Safe to share.
- **No write access**: These methods are read-only. A reader cannot modify the owner's data. Multi-writer is not supported.
- **Length validation**: Both methods throw on `remotePubKey.length !== 32` to prevent accidental misuse with prefixed (33-byte) keys.

## Compatibility

- `getPublicDirectoryKey()` — beta.46+
- `readFromPublicDirectory()` — beta.46+
- `getPublicDirectoryKeyFrom()` — beta.47+
- Retryable `S5DirectoryLoadError` on transient directory 404s (instead of `undefined`) — beta.50+

All three methods are fully additive with no breaking changes to earlier APIs.

## Next Steps

- **[Path-based API](/path-api/)** — core file operations used by owners to publish content
- **[Connection API](/connection/)** — managing the network connection used for cross-identity reads
- **[API Reference](/api-reference/)** — complete method signatures
