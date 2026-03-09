# Pi Pushover Extension

A [pi](https://github.com/mariozechner/pi-coding-agent) extension for sending Pushover notifications.

## Configuration

Set the following environment variables:

- `PUSHOVER_USER_KEY` - Your Pushover user key (found on your Pushover dashboard)
- `PUSHOVER_PI_KEY` - Your Pushover application API token (create one at https://pushover.net/apps)

You can set these in your shell profile (e.g., `~/.bashrc`, `~/.zshrc`) or in a `.env` file in your home directory.

## Usage

### Slash Command

Send a notification from the pi command line:

```
/pushover Hello from pi!
```

### Agent Tool

The extension provides a `pushover_notify` tool that agents can use to send notifications programmatically:

```json
{
  "message": "Task completed successfully",
  "title": "Pi Notification",
  "priority": 0,
  "sound": "pushover"
}
```

#### Parameters

| Parameter  | Type    | Required | Description                                                                                      |
|------------|---------|----------|--------------------------------------------------------------------------------------------------|
| message    | string  | Yes      | The message to send (max 1024 characters)                                                        |
| title      | string  | No       | Optional title for the notification (max 250 characters)                                         |
| priority   | integer | No       | Priority: -2 (no alert), -1 (quiet), 0 (normal), 1 (high), 2 (emergency, requires retry/expire) |
| sound      | string  | No       | Sound name (pushover, bike, bugle, cashregister, classical, etc.)                               |
| retry      | integer | No*      | For emergency priority: seconds between retries (minimum 30)                                     |
| expire     | integer | No*      | For emergency priority: seconds before stopping retries (max 10800 = 3 hours)                   |

*Required when priority is 2 (emergency).

## Installation

Add to your pi configuration or install as a local extension:

```bash
cd your-pi-extensions-directory
git clone <repo-url> pi-pushover
```

## Getting Pushover Credentials

1. Sign up at [pushover.net](https://pushover.net)
2. Find your user key on the dashboard
3. Create an application at [pushover.net/apps](https://pushover.net/apps) to get an API token
4. Set the environment variables as described above
