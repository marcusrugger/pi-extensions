# Pi Extensions

My personal collection of custom extensions for [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), the coding agent harness. Made open source for anyone to use.

## Extensions

- **[pi-brave-search](./pi-brave-search/README.md)** - Lets your agent search the web and news via Brave Search API.
- **[pi-clipboard](./pi-clipboard/README.md)** - Lets your agent copy text to the clipboard.
- **[pi-homeassistant](./pi-homeassistant/README.md)** - Lets your agent control Home Assistant and make voice announcements.
- **[pi-pushover](./pi-pushover/README.md)** - Lets your agent send Pushover notifications.

## Prerequisites

You must have the [Pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

A recent version of [Node.js](https://nodejs.org/) (≥18.17) is required, which you should already have to run pi.

[Just](https://github.com/casey/just) is optional and only needed if you want to use the provided justfile for initialization. It is not required to use the extensions.

## Installation

### Cloning

This is the method I use since these are my extension.

``` bash
cd ~/.pi/agent
git clone git@github.com:marcusrugger/pi-extensions.git extensions
```

### A la carte

Clone the repo some where and follow Pi's instructions for adding
the extension to the [settings.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md) file.

## Initialization

### Entire repo

Some extensions may require initialization prior to use in pi. To initialize them, run this command:

``` bash
just init
```

### Individual extensions

If you are going the a la carte route and only want to initialize an individual
extension, then run `just` with `init-extension` where 'extension' is the name of the extension minus 'pi-'. For example:

``` bash
just init-homeassistant
```

