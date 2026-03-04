# Pi Home Assistant

A pi extension that enables Home Assistant integration for voice announcements.

## What it does

Adds Home Assistant control capabilities to pi agents:

- **`ha_announce` tool** - Make voice announcements through HA voice satellites (like Assist devices) or media players
- **`/ha connect`** - Test connection to your Home Assistant instance
- **`/ha voice`** - Interactively select a default announcement device from your HA entities
- **`/ha say <message>`** - Announce a message on the default device (set via `/ha voice`)

Useful for hands-free notifications, reminders, or integrating your coding workflow with your smart home.

## Prerequisites

1. A running Home Assistant instance
2. A long-lived access token from Home Assistant (generate in Profile → Long-Lived Access Tokens)
3. An announcement-capable device (assist_satellite or media_player entity)

## Installation

1. Copy this extension directory to your pi extensions folder:

   **Global (available in all projects):**
   ```bash
   cp -r pi-homeassistant ~/.pi/agent/extensions/
   ```

   **Project-local (only for this project):**
   ```bash
   cp -r pi-homeassistant .pi/extensions/
   ```

2. Install dependencies:
   ```bash
   cd ~/.pi/agent/extensions/pi-homeassistant  # or .pi/extensions/pi-homeassistant
   npm install
   ```

3. Restart pi or run `/reload` to load the extension.

## Configuration

Set your Home Assistant connection details in either:

**Option 1: Environment variables**
```bash
export HA_URL="http://homeassistant.local:8123"
export HA_TOKEN="your-long-lived-access-token"
```

**Option 2: ~/.env file**
```
HA_URL=http://homeassistant.local:8123
HA_TOKEN=your-long-lived-access-token
```

Then run `/ha connect` to verify the connection.

## Usage

### Set a default announcement device
```
/ha voice
```
This opens an interactive selector showing all your assist_satellite and media_player entities. Choose one to set as the default target.

### Announce a message from the command line
```
/ha say "Hello world!"
/ha say Build complete
```
Announces the message on your default device (set via `/ha voice`). Quotes are optional for single-word messages.

### Make an announcement (via agent tool)
```
You: Announce "Build complete" on my kitchen satellite
Agent: [uses ha_announce] Announced on assist_satellite.kitchen_voice: "Build complete"
```

### Announce to a specific device
```
You: Tell the living room speaker that the tests passed
Agent: [uses ha_announce with target media_player.living_room] Done!
```

## Dependencies

- `undici` - HTTP client with custom TLS agent support
