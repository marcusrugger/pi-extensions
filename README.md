# Pi Extensions

A collection of custom extensions for [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), the coding agent harness. These extensions add new tools and capabilities to your pi agents.

## Available Extensions

### 📋 pi-clipboard

Copy text to the system clipboard directly from your agent.

**Tool provided:** `copy_to_clipboard`

**Use case:** When you want the agent to copy something so you can paste it elsewhere—into a git commit message, another application, a document, etc.

**Example:** "Copy the function you just wrote to my clipboard so I can paste it into Slack."

## Installation

Each extension is self-contained in its own directory with its own dependencies.

1. Copy the extension directory to your pi extensions folder:

   **Global (available in all projects):**
   ```bash
   cp -r pi-clipboard ~/.pi/agent/extensions/
   ```

   **Project-local (only for this project):**
   ```bash
   cp -r pi-clipboard .pi/extensions/
   ```

2. Install the extension's dependencies:
   ```bash
   cd ~/.pi/agent/extensions/pi-clipboard  # or .pi/extensions/pi-clipboard
   npm install
   ```

3. Restart pi or run `/reload` to load the extension.

## Usage with Pi

Once installed, the extensions are automatically loaded by pi. The agent will have access to the new tools and can use them based on your requests.

For example, with pi-clipboard installed:

```
You: Copy that error message to my clipboard
Agent: [uses copy_to_clipboard tool] Done! The error message is now in your clipboard.
```

## Creating Your Own Extension

Each extension follows a simple pattern:

```
my-extension/
├── index.ts        # Extension code
├── package.json    # Manifest with pi.extensions field
└── package-lock.json
```

The `package.json` needs:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "type": "module",
  "dependencies": { ... },
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

See the [pi documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#extensions) for details on creating extensions.

## License

MIT