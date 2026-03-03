# Home Assistant Pi Extension - Implementation Plan

## Overview

A pi extension that enables control of Home Assistant (HA) from within pi. The initial MVP focuses on voice announcements via HA voice satellites and media players.

## Project Structure

```
pi-homeassistant/
├── index.ts          # Extension entry point
├── package.json      # npm manifest with dependencies
├── PLAN.md           # This file
└── package-lock.json # Generated after npm install
```

## Dependencies

- `@sinclair/typebox` - Schema definitions for tool parameters
- `@mariozechner/pi-coding-agent` - Extension types (built-in, no npm install needed)

## Configuration

### Environment Variables (Secrets)
Read from `process.env` first, then fallback to `~/.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `HA_URL` | Home Assistant URL | `https://myhome.nabu.casa` or `http://192.168.1.100:8123` |
| `HA_TOKEN` | Long-lived access token | `eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...` |

### Config File (Preferences)
Location: `~/.pi/agent/home-assistant.json`

```json
{
  "defaultAnnounceTarget": "assist_satellite.kitchen_voice"
}
```

## Extension Loading & Initialization

1. On extension load (once per pi session):
   - Read `HA_URL` and `HA_TOKEN` from environment, fallback to `~/.env`
   - If missing, disable HA tools and show warning
   - If present, read config file for `defaultAnnounceTarget`
   - Cache all configuration in module-level variables

2. Register tools and commands with access to cached config

## Commands

### `/ha connect`

Test connection to Home Assistant and display status.

**Flow:**
1. Check if `HA_URL` and `HA_TOKEN` are configured
2. Make a test API call to `GET /api/` (returns HA version info)
3. Display success with HA version, or error message with troubleshooting hints

**Error handling:**
- Missing config → "Set HA_URL and HA_TOKEN in environment or ~/.env"
- Connection refused → "Cannot reach Home Assistant at [URL]"
- Auth failure → "Invalid token. Generate a new long-lived access token in HA Profile settings."

### `/ha voice`

Interactively select the default announcement device.

**Flow:**
1. Check connection to HA (same as `/ha connect`)
2. Fetch announcement-capable devices:
   - `GET /api/states` with filter for `assist_satellite.*` and `media_player.*`
   - For each entity, get friendly name and entity_id
3. Show interactive select dialog using `ctx.ui.select()`
4. On selection, save to `~/.pi/agent/home-assistant.json`
5. Update in-memory cached config
6. Notify success

**Select dialog format:**
```
Select default announcement device:
  ○ Kitchen Voice PE (assist_satellite.kitchen_voice)
  ○ Living Room Speaker (media_player.living_room)
  ○ Bedroom Mini (media_player.bedroom_mini)
```

## Tools

### `ha_announce`

Announce a message via Home Assistant TTS.

**Parameters:**
```typescript
{
  message: string;           // The message to announce
  target?: string;           // Optional: entity_id to announce on
                             // If omitted, uses defaultAnnounceTarget from config
}
```

**Behavior:**
1. Determine target device:
   - If `target` param provided → use it
   - Else if `defaultAnnounceTarget` in config → use it
   - Else → return error: "No target specified. Run /ha voice to set a default."
2. Call HA API:
   - For `assist_satellite.*` entities → `POST /api/services/assist_satellite/announce`
   - For `media_player.*` entities → `POST /api/services/tts/speak` (or `media_player.play_media` with announce flag)
3. Return success or error

**API Calls:**

For voice satellites (assist_satellite):
```bash
POST /api/services/assist_satellite/announce
{
  "entity_id": "assist_satellite.kitchen_voice",
  "message": "Dinner is ready!",
  "preannounce": true
}
```

For media players (media_player):
```bash
POST /api/services/tts/speak
{
  "entity_id": "tts.cloud",
  "media_player_entity_id": "media_player.kitchen_speaker",
  "message": "Dinner is ready!"
}
```

Note: The TTS engine entity (e.g., `tts.cloud`, `tts.piper`) may need to be discovered or configured. For simplicity with Nabu Casa, use `tts.cloud`. Consider making this configurable in the future.

**Return format:**
```typescript
{
  content: [{ type: "text", text: "Announced on Kitchen Voice PE: \"Dinner is ready!\"" }],
  details: {
    message: string,
    target: string,
    targetName: string  // friendly name if available
  }
}
```

## Error Handling

All tools and commands should handle:
- Missing configuration (HA_URL/HA_TOKEN)
- Network errors (HA unreachable)
- Authentication errors (invalid token)
- Invalid entity_id (device not found)
- HA API errors (return error message from HA)

Use `ctx.ui.notify()` for user-facing messages and return clear error text to the LLM.

## Implementation Order

1. **Project setup**: Create directory, `package.json`, empty `index.ts`
2. **Config loading**: Implement environment variable reading with `~/.env` fallback
3. **Config file**: Implement reading/writing `~/.pi/agent/home-assistant.json`
4. **Connection test**: Implement `/ha connect` command
5. **Device discovery**: Implement fetching assist_satellite and media_player entities
6. **Voice selection**: Implement `/ha voice` command with interactive selection
7. **Announce tool**: Implement `ha_announce` tool with target resolution
8. **Testing**: Manual testing with real HA instance

## Future Enhancements (Out of Scope for MVP)

- `ha_get_state` tool - Get entity state
- `ha_list_entities` tool - List entities by domain
- `ha_call_service` tool - Generic service call
- Multiple named targets (e.g., "kitchen", "bedroom", "all")
- TTS engine configuration
- Entity auto-discovery injection into system prompt
- `/ha devices` command to list devices non-interactively
- Support for `media_player.play_media` with announce flag for better media player support

## References

- Home Assistant REST API: https://developers.home-assistant.io/docs/api/rest/
- HA TTS service: https://www.home-assistant.io/integrations/tts/
- HA Assist Satellite: https://www.home-assistant.io/integrations/assist_satellite/
- Pi extensions documentation: See `~/.nvm/versions/node/v24.13.1/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
