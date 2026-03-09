# Pi Extensions Repository

This repository contains custom extensions for [pi](https://github.com/mariozechner/pi-coding-agent), a coding agent harness. Each extension is a self-contained TypeScript module that provides additional tools and capabilities to pi agents.

## Repository Structure

```
pi-extensions/
├── AGENTS.md           # This file - documentation for AI agents
├── .gitignore          # Git ignore rules (node_modules, .pi/, etc.)
├── .pi/                # Pi local state (git-ignored)
├── pi-clipboard/       # Clipboard extension
│   ├── README.md       # Readme for extension
│   ├── index.ts        # Extension source code
│   ├── package.json    # Extension manifest and dependencies
│   └── package-lock.json
├── pi-homeassistant/   # Home Assistant extension
│   ├── README.md       # Readme for extension
│   ├── index.ts        # Extension source code
│   ├── package.json    # Extension manifest and dependencies
└── <future-extension>/ # Additional extensions follow the same pattern
    ├── index.ts
    └── package.json
```

## Extension Pattern

Each extension is a standalone npm package in its own directory with:

1. **`package.json`** - Manifest with:
   - `name`, `version` - Standard npm fields
   - `type: "module"` - Required for ESM imports
   - `dependencies` - Any npm packages the extension needs
   - `pi.extensions` - Array of TypeScript entry points (e.g., `["./index.ts"]`)

2. **`index.ts`** - Extension entry point that:
   - Imports `Type` from `@sinclair/typebox` for schema validation
   - Imports `ExtensionAPI` from `@mariozechner/pi-coding-agent` for types
   - Exports a default function accepting `pi: ExtensionAPI`
   - Registers tools via `pi.registerTool()`

## Current Extensions

See each extensions README.md for more information about the extension.
- pi-clipboard - provides agent with a clipboard tool
- pi-homeassistant - provides user and agent with tools for Home Assistant
- pi-pushover - provides user and agent with tools to push PushOver notifications

## Development Notes

- Extensions are written in TypeScript and loaded directly by pi (no build step required)
- Pi handles TypeScript compilation internally
- Use `ctx.ui.notify()` for user feedback in tools
- Return `{ content: [{ type: "text", text: "..." }] }` from tool execution
- Set `isError: true` in the return object for error conditions
