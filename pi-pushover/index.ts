/**
 * Pushover Notification Extension for pi
 *
 * Enables sending Pushover notifications from within pi via slash command
 * and agent tool.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

// Configuration from environment variables
const getUserKey = (): string | undefined => process.env.PUSHOVER_USER_KEY;
const getAppKey = (): string | undefined => process.env.PUSHOVER_PI_KEY;

/**
 * Send a Pushover notification
 */
async function sendPushoverNotification(
	message: string,
	options?: { title?: string; priority?: number; sound?: string; retry?: number; expire?: number },
	signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
	const userKey = getUserKey();
	const appKey = getAppKey();

	if (!userKey || !appKey) {
		return {
			success: false,
			error: "Pushover not configured. Set PUSHOVER_USER_KEY and PUSHOVER_PI_KEY environment variables.",
		};
	}

	// Validate emergency priority requirements
	if (options?.priority === 2) {
		if (!options.retry || !options.expire) {
			return {
				success: false,
				error: "Emergency priority (2) requires 'retry' and 'expire' parameters.",
			};
		}
		if (options.retry < 30) {
			return { success: false, error: "Emergency priority 'retry' must be at least 30 seconds." };
		}
		if (options.expire > 10800) {
			return { success: false, error: "Emergency priority 'expire' must be at most 10800 seconds (3 hours)." };
		}
	}

	try {
		const response = await fetch("https://api.pushover.net/1/messages.json", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				user: userKey,
				token: appKey,
				message,
				title: options?.title,
				priority: options?.priority,
				sound: options?.sound,
				retry: options?.retry,
				expire: options?.expire,
			}),
			signal,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMsg = (errorData as { errors?: string[] })?.errors?.join(", ") || `HTTP ${response.status}`;
			return { success: false, error: errorMsg };
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return { success: false, error: "Request was cancelled" };
		}
		const message = error instanceof Error ? error.message : String(error);
		return { success: false, error: message };
	}
}

/**
 * Handle /pushover command
 */
async function handlePushover(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const message = args.trim();

	if (!message) {
		ctx.ui.notify("Usage: /pushover <message>", "error");
		return;
	}

	// Strip surrounding quotes if present
	const cleanMessage = message.replace(/^["']|["']$/g, "");

	if (!cleanMessage) {
		ctx.ui.notify("Message cannot be empty", "error");
		return;
	}

	ctx.ui.notify("Sending Pushover notification...", "info");

	const result = await sendPushoverNotification(cleanMessage);

	if (result.success) {
		ctx.ui.notify("Notification sent!", "success");
	} else {
		ctx.ui.notify(`Failed: ${result.error}`, "error");
	}
}

/**
 * Handle pushover_notify tool execution
 */
async function handleNotify(
	_toolCallId: string,
	params: { message: string; title?: string; priority?: number; sound?: string; retry?: number; expire?: number },
	signal: AbortSignal | undefined,
	_onUpdate: ((update: { content: { type: string; text: string }[] }) => void) | undefined,
	ctx: ExtensionCommandContext
): Promise<{ content: { type: string; text: string }[]; details?: unknown; isError?: boolean }> {
	const { message, title, priority, sound, retry, expire } = params;

	const result = await sendPushoverNotification(message, { title, priority, sound, retry, expire }, signal);

	if (result.success) {
		ctx.ui.notify("Pushover notification sent", "success");
		return {
			content: [{ type: "text", text: `Pushover notification sent successfully.` }],
			details: { message, title, priority, sound, retry, expire },
		};
	} else {
		ctx.ui.notify(`Pushover failed: ${result.error}`, "error");
		return {
			content: [{ type: "text", text: `Failed to send Pushover notification: ${result.error}` }],
			isError: true,
		};
	}
}

/**
 * Extension entry point
 */
export default function (pi: ExtensionAPI) {
	// Check configuration on startup
	const userKey = getUserKey();
	const appKey = getAppKey();
	if (!userKey || !appKey) {
		console.warn("[pi-pushover] PUSHOVER_USER_KEY and PUSHOVER_PI_KEY not configured. Notifications will fail.");
	}

	// Register /pushover command
	pi.registerCommand("pushover", {
		description: "Send a Pushover notification: /pushover <message>",
		handler: handlePushover,
	});

	// Register pushover_notify tool
	pi.registerTool({
		name: "pushover_notify",
		label: "Pushover Notify",
		description:
			"Send a Pushover notification. Use this to send alerts, reminders, or messages to the user via Pushover. The user must have the Pushover app installed on their device.",
		parameters: Type.Object({
			message: Type.String({ description: "The message to send" }),
			title: Type.Optional(Type.String({ description: "Optional title for the notification" })),
			priority: Type.Optional(
				Type.Integer({
					minimum: -2,
					maximum: 2,
					description:
						"Priority level: -2 (no alert), -1 (quiet), 0 (normal, default), 1 (high, bypasses quiet hours), 2 (emergency, requires retry and expire)",
				})
			),
			sound: Type.Optional(
				Type.String({
					description: "Optional sound name (e.g., 'pushover', 'bike', 'bugle', 'cashregister', 'classical', etc.)",
				})
			),
			retry: Type.Optional(
				Type.Integer({
					minimum: 30,
					description: "For emergency priority (2): seconds between retries (minimum 30)",
				})
			),
			expire: Type.Optional(
				Type.Integer({
					minimum: 30,
					maximum: 10800,
					description: "For emergency priority (2): seconds before stopping retries (max 10800 = 3 hours)",
				})
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return handleNotify(
				toolCallId,
				params as { message: string; title?: string; priority?: number; sound?: string; retry?: number; expire?: number },
				signal,
				onUpdate,
				ctx as ExtensionCommandContext
			);
		},
	});
}
