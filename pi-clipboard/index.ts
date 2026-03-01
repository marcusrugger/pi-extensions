/**
 * Clipboard Extension (npm-clipboard)
 *
 * Provides a copy_to_clipboard tool for agents to copy text to the system clipboard.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "copy_to_clipboard",
		label: "Copy to Clipboard",
		description:
			"Copy text to the system clipboard. Use this when the user wants to easily paste the content elsewhere (e.g., into a git commit editor, another application, or a document).",
		parameters: Type.Object({
			text: Type.String({ description: "The text to copy to the clipboard" }),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { text } = params as { text: string };

			try {
				const clipboard = (await import("clipboardy")).default;
				await clipboard.write(text);

				ctx.ui.notify("Copied to clipboard", "success");

				return {
					content: [
						{
							type: "text",
							text: `Successfully copied ${text.length} characters to clipboard.`,
						},
					],
					details: { charCount: text.length },
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to copy: ${message}`, "error");

				return {
					content: [
						{
							type: "text",
							text: `Failed to copy to clipboard: ${message}`,
						},
					],
					isError: true,
				};
			}
		},
	});
}
