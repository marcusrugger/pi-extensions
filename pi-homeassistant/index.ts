/**
 * Home Assistant Extension for pi
 *
 * Enables control of Home Assistant from within pi, including voice announcements
 * via HA voice satellites and media players.
 */

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

// Configuration types
interface HAConfig {
	defaultAnnounceTarget?: string;
}

interface HAConnection {
	url: string;
	token: string;
}

// Module-level cached configuration
let haConnection: HAConnection | null = null;
let haConfig: HAConfig = {};

// Paths
const ENV_FILE = join(homedir(), ".env");
const CONFIG_DIR = join(homedir(), ".pi", "agent");
const CONFIG_FILE = join(CONFIG_DIR, "home-assistant.json");

/**
 * Load configuration on extension initialization
 */
function loadConfiguration(): void {
	// Load HA_URL and HA_TOKEN from environment or ~/.env
	haConnection = loadConnectionConfig();

	// Load config file
	haConfig = loadConfigFile();

	if (!haConnection) {
		console.warn("[pi-homeassistant] HA_URL and HA_TOKEN not configured. Run /ha connect for setup instructions.");
	}
}

/**
 * Load HA connection config from environment, falling back to ~/.env
 */
function loadConnectionConfig(): HAConnection | null {
	// Try environment first
	let url = process.env.HA_URL;
	let token = process.env.HA_TOKEN;

	// Fallback to ~/.env file
	if (!url || !token) {
		const envConfig = parseEnvFile(ENV_FILE);
		url = url || envConfig.HA_URL;
		token = token || envConfig.HA_TOKEN;
	}

	if (url && token) {
		return { url: url.replace(/\/$/, ""), token };
	}

	return null;
}

/**
 * Parse a .env file into key-value pairs
 */
function parseEnvFile(path: string): Record<string, string> {
	const result: Record<string, string> = {};
	if (!existsSync(path)) return result;

	try {
		const content = readFileSync(path, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex > 0) {
				const key = trimmed.slice(0, eqIndex).trim();
				let value = trimmed.slice(eqIndex + 1).trim();
				// Remove surrounding quotes
				if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}
				result[key] = value;
			}
		}
	} catch (error) {
		console.warn(`[pi-homeassistant] Failed to read ${path}: ${error}`);
	}

	return result;
}

/**
 * Load config file from ~/.pi/agent/home-assistant.json
 */
function loadConfigFile(): HAConfig {
	if (!existsSync(CONFIG_FILE)) return {};

	try {
		const content = readFileSync(CONFIG_FILE, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		console.warn(`[pi-homeassistant] Failed to read config file: ${error}`);
		return {};
	}
}

/**
 * Save config file to ~/.pi/agent/home-assistant.json
 */
function saveConfigFile(config: HAConfig): void {
	try {
		if (!existsSync(CONFIG_DIR)) {
			mkdirSync(CONFIG_DIR, { recursive: true });
		}
		writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
		haConfig = config;
	} catch (error) {
		throw new Error(`Failed to save config: ${error}`);
	}
}

/**
 * Make an API call to Home Assistant
 */
async function haApi<T>(
	method: "GET" | "POST",
	endpoint: string,
	body?: unknown,
	signal?: AbortSignal
): Promise<{ data: T | null; error: string | null; status?: number }> {
	if (!haConnection) {
		return { data: null, error: "Home Assistant not configured. Set HA_URL and HA_TOKEN in environment or ~/.env" };
	}

	try {
		const url = `${haConnection.url}/api${endpoint}`;
		const response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${haConnection.token}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
			dispatcher: haAgent,
			signal,
		});

		if (!response.ok) {
			if (response.status === 401) {
				return { data: null, error: "Invalid token. Generate a new long-lived access token in HA Profile settings.", status: 401 };
			}
			const errorText = await response.text();
			return { data: null, error: `API error: ${response.status} - ${errorText}`, status: response.status };
		}

		const data = await response.json();
		return { data: data as T, error: null };
	} catch (error) {
		// Handle abort gracefully
		if (error instanceof Error && error.name === "AbortError") {
			return { data: null, error: "Request was cancelled" };
		}
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
			return { data: null, error: `Cannot reach Home Assistant at ${haConnection.url}` };
		}
		return { data: null, error: `Connection error: ${message}` };
	}
}

/**
 * Test connection to Home Assistant
 * Calls /api/config which returns version info and other configuration details
 */
async function testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
	const result = await haApi<{ version?: string }>("GET", "/config");
	if (result.error) {
		return { success: false, error: result.error };
	}
	return { success: true, version: result.data?.version };
}

/**
 * Entity with state information from HA
 */
interface HAEntity {
	entity_id: string;
	state: string;
	attributes: {
		friendly_name?: string;
		[key: string]: unknown;
	};
}

/**
 * Fetch announcement-capable devices (assist_satellite and media_player entities)
 */
async function fetchAnnouncementDevices(): Promise<{ devices: HAEntity[]; error: string | null }> {
	const result = await haApi<HAEntity[]>("GET", "/states");

	if (result.error) {
		return { devices: [], error: result.error };
	}

	const devices = (result.data || []).filter(
		(entity) =>
			entity.entity_id.startsWith("assist_satellite.") || entity.entity_id.startsWith("media_player.")
	);

	return { devices, error: null };
}

/**
 * Handle /ha connect command
 */
async function handleConnect(_args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!haConnection) {
		ctx.ui.notify("Set HA_URL and HA_TOKEN in environment or ~/.env", "error");
		return;
	}

	ctx.ui.notify("Connecting to Home Assistant...", "info");

	const result = await testConnection();

	if (result.success) {
		const versionInfo = result.version ? ` (v${result.version})` : "";
		ctx.ui.notify(`Connected to Home Assistant${versionInfo}`, "success");
	} else {
		ctx.ui.notify(result.error || "Connection failed", "error");
	}
}

/**
 * Handle /ha voice command - interactively select default announcement device
 */
async function handleVoice(_args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!haConnection) {
		ctx.ui.notify("Set HA_URL and HA_TOKEN in environment or ~/.env", "error");
		return;
	}

	// Test connection first
	const connectionResult = await testConnection();
	if (!connectionResult.success) {
		ctx.ui.notify(connectionResult.error || "Connection failed", "error");
		return;
	}

	ctx.ui.notify("Fetching devices...", "info");

	// Fetch devices
	const { devices, error } = await fetchAnnouncementDevices();

	if (error) {
		ctx.ui.notify(error, "error");
		return;
	}

	if (devices.length === 0) {
		ctx.ui.notify("No announcement-capable devices found", "warning");
		return;
	}

	// Build select items with entity_id as value
	const items: { value: string; label: string; description?: string }[] = devices.map((device) => {
		const name = device.attributes.friendly_name || device.entity_id;
		const isActive = device.entity_id === haConfig.defaultAnnounceTarget;
		return {
			value: device.entity_id,
			label: isActive ? `${name} (active)` : name,
		};
	});

	// Find index of currently selected device
	const currentIndex = items.findIndex((item) => item.value === haConfig.defaultAnnounceTarget);

	// Show selection dialog using custom UI to pre-select current device
	const { Container, SelectList, Text } = await import("@mariozechner/pi-tui");
	const { DynamicBorder } = await import("@mariozechner/pi-coding-agent");

	const selected = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select default announcement device:")), 1, 0));

		const selectList = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (t) => theme.fg("accent", t),
			selectedText: (t) => theme.fg("accent", t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		});

		// Pre-select current device if set
		if (currentIndex >= 0) {
			selectList.setSelectedIndex(currentIndex);
		}

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);
		container.addChild(selectList);

		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));
		container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));

		return {
			render: (w) => container.render(w),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (!selected) {
		// User cancelled
		return;
	}

	// Save selection
	try {
		saveConfigFile({ ...haConfig, defaultAnnounceTarget: selected });
		const device = devices.find((d) => d.entity_id === selected);
		const friendlyName = device?.attributes.friendly_name || selected;
		ctx.ui.notify(`Default announcement device set to: ${friendlyName}`, "success");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Failed to save config: ${message}`, "error");
	}
}

/**
 * Core announcement logic - shared by handleSay and handleAnnounce
 * Routes to appropriate HA service based on entity type
 */
async function announceToTarget(
	message: string,
	targetDevice: string,
	signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
	if (targetDevice.startsWith("assist_satellite.")) {
		const result = await haApi<unknown>("POST", "/services/assist_satellite/announce", {
			entity_id: targetDevice,
			message,
			preannounce: true,
		}, signal);
		return { success: !result.error, error: result.error || undefined };
	} else if (targetDevice.startsWith("media_player.")) {
		const result = await haApi<unknown>("POST", "/services/tts/speak", {
			entity_id: "tts.cloud",
			media_player_entity_id: targetDevice,
			message,
		}, signal);
		return { success: !result.error, error: result.error || undefined };
	} else {
		return { success: false, error: `Unknown entity type: ${targetDevice}. Expected assist_satellite.* or media_player.*` };
	}
}

/**
 * Handle /ha say command - announce a message on the default device
 */
async function handleSay(args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!haConnection) {
		ctx.ui.notify("Set HA_URL and HA_TOKEN in environment or ~/.env", "error");
		return;
	}

	// Extract message from args (after "say ")
	const message = args.trim();

	if (!message) {
		ctx.ui.notify("Usage: /ha say <message>", "error");
		return;
	}

	// Strip surrounding quotes if present
	const cleanMessage = message.replace(/^["']|["']$/g, "");

	if (!cleanMessage) {
		ctx.ui.notify("Message cannot be empty", "error");
		return;
	}

	// Check for default target
	if (!haConfig.defaultAnnounceTarget) {
		ctx.ui.notify("No default device set. Run /ha voice to select one.", "error");
		return;
	}

	const targetDevice = haConfig.defaultAnnounceTarget;

	// Make the announcement
	ctx.ui.notify(`Announcing on ${targetDevice}...`, "info");

	const result = await announceToTarget(cleanMessage, targetDevice);

	if (result.error) {
		ctx.ui.notify(`Failed: ${result.error}`, "error");
	} else {
		ctx.ui.notify(`Announced: "${cleanMessage}"`, "success");
	}
}

/**
 * Handle ha_announce tool execution
 */
async function handleAnnounce(
	_toolCallId: string,
	params: { message: string; target?: string },
	signal: AbortSignal | undefined,
	_onUpdate: ((update: { content: { type: string; text: string }[] }) => void) | undefined,
	ctx: ExtensionCommandContext
): Promise<{ content: { type: string; text: string }[]; details?: unknown; isError?: boolean }> {
	const { message, target } = params;

	if (!haConnection) {
		return {
			content: [{ type: "text", text: "Home Assistant not configured. Set HA_URL and HA_TOKEN in environment or ~/.env" }],
			isError: true,
		};
	}

	// Determine target device
	const targetDevice = target || haConfig.defaultAnnounceTarget;

	if (!targetDevice) {
		return {
			content: [{ type: "text", text: "No target specified. Run /ha voice to set a default, or provide a target entity_id." }],
			isError: true,
		};
	}

	// Make the announcement
	const result = await announceToTarget(message, targetDevice, signal);

	if (result.error) {
		return {
			content: [{ type: "text", text: `Failed to announce: ${result.error}` }],
			isError: true,
		};
	}

	return {
		content: [{ type: "text", text: `Announced on ${targetDevice}: "${message}"` }],
		details: { message, target: targetDevice },
	};
}

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
		description: "Home Assistant commands: 'connect' to test connection, 'voice' to select device, 'say <message>' to announce",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			// Parse: subcommand followed by optional args
			const trimmed = args.trim();
			const spaceIndex = trimmed.indexOf(" ");
			const subcommand = spaceIndex >= 0 ? trimmed.slice(0, spaceIndex).toLowerCase() : trimmed.toLowerCase();
			const subArgs = spaceIndex >= 0 ? trimmed.slice(spaceIndex + 1) : "";

			if (subcommand === "connect" || subcommand === "") {
				await handleConnect(subArgs, ctx);
			} else if (subcommand === "voice") {
				await handleVoice(subArgs, ctx);
			} else if (subcommand === "say") {
				await handleSay(subArgs, ctx);
			} else {
				ctx.ui.notify(`Unknown /ha subcommand: ${subcommand}. Use 'connect', 'voice', or 'say'.`, "error");
			}
		},
	});

	// Register ha_announce tool
	pi.registerTool({
		name: "ha_announce",
		label: "Home Assistant Announce",
		description:
			"Announce a message via Home Assistant TTS. Use this to make voice announcements through HA voice satellites or media players. The message will be spoken aloud on the target device.",
		parameters: Type.Object({
			message: Type.String({ description: "The message to announce" }),
			target: Type.Optional(
				Type.String({
					description:
						"Optional entity_id to announce on (e.g., 'assist_satellite.kitchen_voice' or 'media_player.living_room'). If omitted, uses the default set via /ha voice.",
				})
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return handleAnnounce(
				toolCallId,
				params as { message: string; target?: string },
				signal,
				onUpdate,
				ctx as ExtensionCommandContext
			);
		},
	});
}
