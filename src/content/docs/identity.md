---
title: 'Identity & Signing API'
description: 'Ed25519 signing primitives for backend-mediated portal registration.'
---

Enhanced s5.js provides Ed25519 signing primitives on top of identity seeds, enabling **backend-mediated portal registration** where master authentication tokens stay server-side while browsers handle signing. This is the recommended pattern for multi-user apps that need to register users on S5 portals without exposing portal master tokens to clients.

## Overview

A portal registration flow requires the user to prove ownership of an S5 identity by signing a challenge. Enhanced s5.js exposes this signing primitive directly — along with a few helpers for persisting portal authentication — so you can keep master tokens server-side and delegate only signing to the browser.

Five methods and two constants cover this area:

- `s5.getSigningPublicKey(seed?)` — derive the Ed25519 public key for a seed
- `s5.sign(data, seed?)` — sign arbitrary bytes with a seed
- `s5.setPortalAuth(url, authToken)` — attach an auth token for the current session (no persistence)
- `s5.storePortalCredentials(url, seed, authToken)` — persist credentials for reuse across sessions
- `CHALLENGE_TYPE_REGISTER` / `CHALLENGE_TYPE_LOGIN` — portal challenge-type constants

## getSigningPublicKey()

Derive the 33-byte Ed25519 public key (including the `0xed` multikey prefix) from an identity seed.

```typescript
getSigningPublicKey(seed?: Uint8Array): Uint8Array
```

**Parameters:**
- `seed` — Optional 32-byte identity seed. If omitted, uses the currently initialized identity (the one recovered via `recoverIdentityFromSeedPhrase()`).

**Returns:** 33-byte `Uint8Array` (Ed25519 public key with `0xed` multikey prefix — this is the format portals expect).

```typescript
// With currently initialized identity
const pubKey = s5.getSigningPublicKey();

// With a different seed
const pubKey = s5.getSigningPublicKey(mySeedBytes);
```

## sign()

Sign arbitrary bytes using an Ed25519 identity seed. Returns a base64url-encoded signature string.

```typescript
async sign(data: Uint8Array, seed?: Uint8Array): Promise<string>
```

**Parameters:**
- `data` — Bytes to sign (typically a portal-issued challenge).
- `seed` — Optional 32-byte identity seed. If omitted, uses the currently initialized identity.

**Returns:** Base64url-encoded signature string (64-byte Ed25519 signature, base64url-unpadded).

```typescript
const challenge = base64urlDecode(portalChallengeString);
const signature = await s5.sign(challenge);
// signature is ready to POST back to the portal
```

## setPortalAuth()

Attach an auth token to a portal URL for the current session. Does **not** persist — useful for server-issued short-lived tokens.

```typescript
setPortalAuth(portalUrl: string, authToken: string): void
```

**Parameters:**
- `portalUrl` — The portal's base URL (e.g., `"https://s5.example.com"`).
- `authToken` — The auth token returned by the portal after successful registration or login.

```typescript
// After backend exchanges a signed challenge for an auth token:
s5.setPortalAuth("https://s5.example.com", authToken);
// Subsequent s5.fs operations use this token for portal requests.
```

## storePortalCredentials()

Persist portal credentials so they survive across sessions. Unlike `setPortalAuth`, this also stores the identity seed (encrypted) for future reuse.

```typescript
async storePortalCredentials(
  portalUrl: string,
  seed: Uint8Array,
  authToken: string
): Promise<void>
```

**Parameters:**
- `portalUrl` — The portal's base URL.
- `seed` — 32-byte identity seed (the same one used to register/login on the portal).
- `authToken` — The auth token returned by the portal.

```typescript
// After successful registration on the portal:
await s5.storePortalCredentials(
  "https://s5.example.com",
  identitySeed,
  authToken
);
// Next session: S5.create() picks up stored credentials automatically.
```

### Login Failures Surface at Startup (beta.48+)

When an identity has a portal account but no valid cached auth token, storage-service initialization performs a portal login. Since beta.48, a **failed login throws** instead of being silently swallowed (which previously left a half-configured portal — reads worked over P2P, but every authenticated upload returned 401 and retries hit `"User already has an account on this service!"`). Catch the error and re-run your login flow:

```typescript
try {
  await s5.recoverIdentityFromSeedPhrase(seedPhrase); // runs initStorageServices()
} catch (error) {
  // Portal login failed — obtain a fresh authToken (e.g., via your backend's
  // challenge/response flow) and store it:
  s5.setPortalAuth("https://s5.example.com", freshAuthToken);
}
```

## Challenge Type Constants

Portals issue challenges tagged with a type byte indicating whether they're for registration or login. Constants are exported from the package:

```typescript
import { CHALLENGE_TYPE_REGISTER, CHALLENGE_TYPE_LOGIN } from '@julesl23/s5js';

CHALLENGE_TYPE_REGISTER === 1
CHALLENGE_TYPE_LOGIN === 2
```

Most application code won't need to reference these directly — your backend typically handles challenge-type validation. They're exported for advanced use cases where you're implementing the challenge/response protocol manually.

## Backend-Mediated Registration Flow

This is the recommended integration pattern. Master portal tokens stay server-side; the browser only handles Ed25519 signing.

```typescript
// === CLIENT ===

// 1. User provides or generates seed phrase
const seedPhrase = generatePhrase(crypto);
await s5.recoverIdentityFromSeedPhrase(seedPhrase);

// 2. Get public key (with 0xed prefix) for backend request
const publicKey = s5.getSigningPublicKey();

// 3. Request registration challenge from your backend
const { challenge } = await fetch("/api/s5/register-challenge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ publicKey: base64url(publicKey) }),
}).then(r => r.json());

// 4. Sign the challenge
const challengeBytes = base64urlDecode(challenge);
const signature = await s5.sign(challengeBytes);

// 5. Send the signature back; backend forwards to portal and returns authToken
const { authToken } = await fetch("/api/s5/register-complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ publicKey: base64url(publicKey), signature }),
}).then(r => r.json());

// 6. Persist credentials for next session
await s5.storePortalCredentials(
  "https://s5.example.com",
  seedBytes,
  authToken
);

// You're now registered and authenticated. s5.fs.put / s5.fs.get just work.
```

### Backend responsibilities

Your backend (which holds the portal master token) should:

1. **`/api/s5/register-challenge`** — call the portal's `/s5/account/register` endpoint with the master token to obtain a challenge for the user's public key. Return the challenge to the browser.

2. **`/api/s5/register-complete`** — receive the user's signature; POST it to the portal's `/s5/account/register` completion endpoint (again with the master token). Receive the user's `authToken` back and return it to the browser.

Never ship the master portal token to the browser. The browser only needs to sign challenges; everything privileged stays server-side.

## Security Considerations

- **Seed handling**: Treat the 32-byte seed like a private key. Store encrypted (the `storePortalCredentials` method handles this internally via IndexedDB). Never log, transmit, or persist in plaintext.
- **Signature scope**: Ed25519 signatures produced by `s5.sign()` prove control of the seed. Only sign data you trust (e.g., challenges from your own backend or a trusted portal).
- **authToken lifetime**: Auth tokens are portal-specific and may expire. Handle 401 responses by re-running the challenge/response flow.
- **Public key format**: `getSigningPublicKey()` returns the **33-byte** prefixed form (with `0xed` multikey prefix), which is what portals expect. This is different from the raw 32-byte form used by the Cross-Identity Public Directory API — don't mix them up.

## Compatibility

- All five methods — beta.32+ / beta.34+ / beta.35+ (see CHANGELOG for exact version-per-method)
- `CHALLENGE_TYPE_REGISTER` / `CHALLENGE_TYPE_LOGIN` constants — beta.35+
- Portal login failures during initialization propagate to the caller (instead of leaving broken auth) — beta.48+

## Next Steps

- **[Installation & Setup](/installation/)** — configuring S5 and getting an identity set up
- **[API Reference](/api-reference/)** — complete signatures and types
- **[Cross-Identity Public Directory Access](/cross-identity/)** — a different use of public keys (32-byte, no prefix) for public content sharing
