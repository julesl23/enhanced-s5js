---
title: 'Connection API'
description: 'Monitor and manage P2P connections — essential for mobile apps and PWAs.'
---

The Connection API provides methods for monitoring and managing WebSocket connections to the S5 peer-to-peer network. This is essential for mobile applications where connections can be interrupted by background tabs, network switching, or device sleep.

## Why Connection Management Matters

Mobile browsers and PWAs face unique challenges with persistent WebSocket connections:

- **Background tabs**: Browsers throttle or close WebSocket connections when tabs are backgrounded
- **Network switching**: Moving between WiFi and cellular networks can silently drop connections
- **Device sleep**: Connections often don't survive device sleep/wake cycles
- **Silent failures**: WebSocket connections can die without triggering error events

The Connection API addresses these issues by providing:
- Real-time connection status monitoring
- Event-driven status change notifications
- Manual reconnection with timeout handling

## ConnectionStatus Type

```typescript
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
```

| Status | Description |
|--------|-------------|
| `connected` | At least one peer has completed the handshake protocol |
| `connecting` | At least one peer socket is open but handshake not yet complete |
| `disconnected` | No peers connected or all sockets are closed |

## getConnectionStatus()

Get the current connection status to the S5 network.

```typescript
getConnectionStatus(): ConnectionStatus
```

### Returns

- `'connected'` if at least one peer has completed handshake
- `'connecting'` if at least one peer socket is open but handshake not complete
- `'disconnected'` if no peers or all sockets closed

### Example

```typescript
const s5 = await S5.create({ initialPeers: [...] });

const status = s5.getConnectionStatus();
console.log(`Current status: ${status}`);

if (status === 'disconnected') {
  console.log('Not connected to network');
} else if (status === 'connecting') {
  console.log('Connection in progress...');
} else {
  console.log('Connected and ready');
}
```

## onConnectionChange(callback)

Subscribe to connection status changes. The callback is called immediately with the current status upon subscription, then again whenever the status changes.

```typescript
onConnectionChange(callback: (status: ConnectionStatus) => void): () => void
```

### Parameters

- **callback** `(status: ConnectionStatus) => void`: Function called when connection status changes

### Returns

- Unsubscribe function that removes the listener when called

### Example

```typescript
const s5 = await S5.create({ initialPeers: [...] });

// Subscribe to changes
const unsubscribe = s5.onConnectionChange((status) => {
  console.log(`Connection status: ${status}`);

  if (status === 'disconnected') {
    showOfflineIndicator();
  } else if (status === 'connected') {
    hideOfflineIndicator();
  }
});

// Later: stop listening
unsubscribe();
```

### Multiple Listeners

Multiple listeners can subscribe independently:

```typescript
// UI listener
const unsubscribe1 = s5.onConnectionChange((status) => {
  updateStatusBadge(status);
});

// Analytics listener
const unsubscribe2 = s5.onConnectionChange((status) => {
  trackConnectionEvent(status);
});

// Cleanup both when done
unsubscribe1();
unsubscribe2();
```

### Error Isolation

Listener errors are isolated - one failing callback won't break others:

```typescript
s5.onConnectionChange((status) => {
  throw new Error('This error is caught internally');
});

s5.onConnectionChange((status) => {
  // This still runs even if the above listener throws
  console.log(status);
});
```

## reconnect()

Force reconnection to the S5 network. Closes all existing connections and re-establishes them to the initial peer URIs.

```typescript
async reconnect(): Promise<void>
```

### Throws

- `Error` if reconnection fails after 10 second timeout

### Example

```typescript
const s5 = await S5.create({ initialPeers: [...] });

// Detect disconnection and reconnect
s5.onConnectionChange(async (status) => {
  if (status === 'disconnected') {
    try {
      await s5.reconnect();
      console.log('Reconnected successfully');
    } catch (error) {
      console.error('Reconnection failed:', error.message);
    }
  }
});
```

### Concurrent Calls

Concurrent `reconnect()` calls are handled safely - subsequent calls wait for the first to complete rather than creating duplicate connections:

```typescript
// These don't create duplicate connections
const promise1 = s5.reconnect();
const promise2 = s5.reconnect();

await Promise.all([promise1, promise2]); // Both resolve when first completes
```

## Mobile App Example

Complete example for handling connection in a mobile web app or PWA:

```typescript
import { S5, ConnectionStatus } from '@julesl23/s5js';

class S5ConnectionManager {
  private s5: S5;
  private unsubscribe?: () => void;

  async initialize() {
    this.s5 = await S5.create({
      initialPeers: [
        'wss://z2Das8aEF7oNoxkcrfvzerZ1iBPWfm6D7gy3hVE4ALGSpVB@node.sfive.net/s5/p2p'
      ]
    });

    // Monitor connection status
    this.unsubscribe = this.s5.onConnectionChange((status) => {
      this.handleStatusChange(status);
    });

    // Handle app lifecycle events
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
  }

  private handleStatusChange(status: ConnectionStatus) {
    switch (status) {
      case 'connected':
        this.showOnline();
        break;
      case 'connecting':
        this.showConnecting();
        break;
      case 'disconnected':
        this.showOffline();
        break;
    }
  }

  private async handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // App came to foreground - check and restore connection
      if (this.s5.getConnectionStatus() === 'disconnected') {
        try {
          await this.s5.reconnect();
        } catch (error) {
          this.showReconnectionFailed();
        }
      }
    }
  }

  private showOnline() { /* Update UI to show connected state */ }
  private showConnecting() { /* Update UI to show connecting state */ }
  private showOffline() { /* Update UI to show offline state */ }
  private showReconnectionFailed() { /* Show error to user */ }

  destroy() {
    this.unsubscribe?.();
  }
}

// Usage
const manager = new S5ConnectionManager();
await manager.initialize();
```

## Best Practices

### 1. Always Handle Visibility Changes

Mobile browsers often disconnect WebSockets when backgrounded. Always check connection status when the app returns to foreground:

```typescript
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    if (s5.getConnectionStatus() === 'disconnected') {
      await s5.reconnect();
    }
  }
});
```

### 2. Implement Retry Logic with Backoff

For production apps, implement exponential backoff for reconnection attempts:

```typescript
async function reconnectWithBackoff(s5: S5, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await s5.reconnect();
      return; // Success
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

### 3. Queue Operations During Disconnection

Don't attempt network operations when disconnected:

```typescript
async function safePut(s5: S5, path: string, data: any) {
  if (s5.getConnectionStatus() !== 'connected') {
    // Queue for later or throw user-friendly error
    throw new Error('Currently offline. Please try again when connected.');
  }
  return s5.fs.put(path, data);
}
```

### 4. Clean Up Listeners

Always unsubscribe when components are destroyed to prevent memory leaks:

```typescript
// React example
useEffect(() => {
  const unsubscribe = s5.onConnectionChange(setStatus);
  return () => unsubscribe(); // Cleanup on unmount
}, [s5]);
```

## Next Steps

- **[Quick Start](/quick-start/)** - Get started with S5
- **[Path-based API](/path-api/)** - File operations
- **[API Reference](/api-reference/)** - Complete API documentation
