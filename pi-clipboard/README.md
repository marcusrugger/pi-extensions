# Pi Clipboard

A pi extension that provides clipboard access to agents.

## What it does

Adds a `copy_to_clipboard` tool that allows the agent to copy text to your system clipboard. Useful when you want to easily paste agent output elsewhere—into a git commit editor, another application, or a document.

## Installation

1. Copy this extension directory to your pi extensions folder:

   **Global (available in all projects):**
   ```bash
   cp -r pi-clipboard ~/.pi/agent/extensions/
   ```

   **Project-local (only for this project):**
   ```bash
   cp -r pi-clipboard .pi/extensions/
   ```

2. Install dependencies:
   ```bash
   cd ~/.pi/agent/extensions/pi-clipboard  # or .pi/extensions/pi-clipboard
   npm install
   ```

3. Restart pi or run `/reload` to load the extension.

## Usage

Once installed, the agent can copy text to your clipboard:

```
You: Copy that error message to my clipboard
Agent: [uses copy_to_clipboard] Done! The error message is in your clipboard.
```

## Dependencies

- `clipboardy` - Cross-platform clipboard access