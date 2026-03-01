# Pi Extensions Repository

This repository contains custom extensions for [pi](https://github.com/mariozechner/pi-coding-agent), a coding agent harness. Each extension is a self-contained TypeScript module that provides additional tools and capabilities to pi agents.

## Repository Structure

```
pi-extensions/
├── AGENTS.md           # This file - documentation for AI agents
├── .gitignore          # Git ignore rules (node_modules, .pi/, etc.)
├── .pi/                # Pi local state (git-ignored)
├── pi-clipboard/       # Clipboard extension
│   ├── index.ts        # Extension source code
│   ├── package.json    # Extension manifest and dependencies
│   └── package-lock.json
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

### pi-clipboard

Provides a `copy_to_clipboard` tool that allows agents to copy text to the system clipboard. Useful when users want to paste content elsewhere (git commit editors, other applications, documents).

**Dependencies:** `clipboardy`

## Adding a New Extension

1. Create a new directory: `mkdir <extension-name>`
2. Create `package.json` with required fields (see pi-clipboard as template)
3. Create `index.ts` with extension implementation
4. Run `npm install` in the extension directory
5. The extension will be auto-discovered by pi when the directory is in pi's extension path

## Development Notes

- Extensions are written in TypeScript and loaded directly by pi (no build step required)
- Pi handles TypeScript compilation internally
- Use `ctx.ui.notify()` for user feedback in tools
- Return `{ content: [{ type: "text", text: "..." }] }` from tool execution
- Set `isError: true` in the return object for error conditions