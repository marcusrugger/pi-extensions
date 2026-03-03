# Plan: Fix TLS Certificate Verification Scope

## Background

The pi-homeassistant extension currently uses a global environment variable to disable TLS certificate verification:

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

This is needed because Home Assistant runs on the local network with a self-signed certificate.

## Problem

Setting `NODE_TLS_REJECT_UNAUTHORIZED = "0"` is a **global setting that affects ALL TLS/HTTPS connections in the entire Node.js process**, not just connections to Home Assistant. This means:

- Any other pi extensions making HTTPS requests skip certificate verification
- Web searches via Perplexity/Gemini APIs skip verification
- All external API calls are vulnerable to MITM attacks

This is a significant security issue.

## Solution

Use undici's `Agent` with `connect: { rejectUnauthorized: false }` to disable certificate verification **only for Home Assistant requests**.

### Why undici?

1. Node's built-in `fetch` uses undici internally but doesn't expose the `Agent` API
2. Installing undici as a dependency gives us the `Agent` class for per-request TLS config
3. Keeps the modern, promise-based `fetch` API
4. The extension will grow, so keeping clean async/await code matters

## Implementation Steps

### 1. Update package.json

Add undici as a dependency in `pi-homeassistant/package.json`:

```json
{
  "name": "pi-homeassistant",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "undici": "^6.21.0"
  },
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

### 2. Run npm install

After updating package.json, run:

```bash
cd pi-homeassistant
npm install
```

### 3. Update index.ts

#### Remove the global TLS bypass

Delete this line near the top of the file:

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

#### Add undici imports

Add at the top of the file:

```typescript
import { Agent } from "undici";
```

#### Create a module-level agent for Home Assistant

Add after the imports, before the configuration types:

```typescript
// Agent for Home Assistant with TLS verification disabled
// This only affects requests that use this specific agent
const haAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});
```

#### Update the haApi function

Modify the `haApi` function to use the agent. The current code:

```typescript
const response = await fetch(url, {
  method,
  headers: {
    Authorization: `Bearer ${haConnection.token}`,
    "Content-Type": "application/json",
  },
  body: body ? JSON.stringify(body) : undefined,
});
```

Should become:

```typescript
const response = await fetch(url, {
  method,
  headers: {
    Authorization: `Bearer ${haConnection.token}`,
    "Content-Type": "application/json",
  },
  body: body ? JSON.stringify(body) : undefined,
  dispatcher: haAgent,
});
```

#### Add cleanup handler for session shutdown

Add a `session_shutdown` event handler inside the extension factory function to properly dispose of the Agent when pi exits or `/reload` is called. This ensures the Agent's connection pool and sockets are released cleanly.

In the `export default function (pi: ExtensionAPI)` block, add:

```typescript
// Clean up the Agent on shutdown/reload
pi.on("session_shutdown", () => {
  haAgent.destroy();
});
```

**Why this is needed:** The undici Agent maintains a connection pool with open sockets and possibly timers. Without explicit cleanup, these resources may not be released immediately when the extension is reloaded (via `/reload`) or when pi exits. This could lead to resource leaks, especially during rapid reload cycles.

## File Summary

After changes, the relevant parts of `index.ts` should look like:

```typescript
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Agent } from "undici";

// Agent for Home Assistant with TLS verification disabled
// This only affects requests that use this specific agent
const haAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

// ... configuration types and helper functions unchanged ...

/**
 * Extension entry point
 */
export default function (pi: ExtensionAPI) {
  // Load configuration on startup
  loadConfiguration();

  // Clean up the Agent on shutdown/reload
  pi.on("session_shutdown", () => {
    haAgent.destroy();
  });

  // Register /ha command
  pi.registerCommand("ha", {
    // ... rest unchanged ...
  });

  // Register ha_announce tool
  pi.registerTool({
    // ... rest unchanged ...
  });
}
```

The `haApi` function should include `dispatcher: haAgent` in the fetch options.

## Verification

After implementing:

1. Test that `ha_announce` still works with your Home Assistant
2. Verify that other HTTPS requests in pi (web search, etc.) are NOT affected by checking that they still verify certificates (you could test by trying to connect to a site with an invalid cert from another extension - it should fail)

## Security Notes

- **TLS encryption is still active** - data is encrypted in transit
- **Only certificate verification is skipped** - Node won't verify the cert is signed by a trusted CA
- **This is scoped to Home Assistant only** - all other HTTPS connections remain fully secure
- This is an acceptable tradeoff for a local network where you control both ends

## Reference

- Undici Agent docs: https://undici.nodejs.org/#/docs/api/Agent.md
- Node.js fetch docs (mentions dispatcher option): https://nodejs.org/api/globals.html#fetch
