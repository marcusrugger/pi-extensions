/**
 * Brave Search Extension for pi
 *
 * Provides web and news search capabilities via the Brave Search API.
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Configuration from environment variables
const getApiKey = (): string | undefined => process.env.BRAVE_API_KEY;

// Map user-friendly freshness values to Brave API format
const FRESHNESS_MAP: Record<string, string> = {
	day: "pd",
	week: "pw",
	month: "pm",
	year: "py",
};

// API endpoints
const WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const NEWS_SEARCH_URL = "https://api.search.brave.com/res/v1/news/search";

/**
 * Build search URL with parameters
 */
function buildSearchUrl(
	type: "web" | "news",
	params: {
		query: string;
		count?: number;
		offset?: number;
		freshness?: string;
		country?: string;
		search_lang?: string;
		summary?: boolean;
		extra_snippets?: boolean;
	}
): URL {
	const baseUrl = type === "web" ? WEB_SEARCH_URL : NEWS_SEARCH_URL;
	const url = new URL(baseUrl);

	url.searchParams.set("q", params.query);

	if (params.count !== undefined) {
		url.searchParams.set("count", String(params.count));
	}
	if (params.offset !== undefined) {
		url.searchParams.set("offset", String(params.offset));
	}
	if (params.freshness !== undefined) {
		// Map user-friendly values or pass through
		const mappedFreshness = FRESHNESS_MAP[params.freshness] || params.freshness;
		url.searchParams.set("freshness", mappedFreshness);
	}
	if (params.country !== undefined) {
		url.searchParams.set("country", params.country);
	}
	if (params.search_lang !== undefined) {
		url.searchParams.set("search_lang", params.search_lang);
	}
	// Summary is web-only
	if (params.summary === true && type === "web") {
		url.searchParams.set("summary", "true");
	}
	if (params.extra_snippets === true) {
		url.searchParams.set("extra_snippets", "true");
	}

	return url;
}

/**
 * Format web search results for LLM consumption
 */
function formatWebResults(
	query: string,
	data: {
		web?: { results?: Array<{
			title: string;
			url: string;
			description?: string;
			age?: string;
			language?: string;
		}> };
		summary?: { text: string };
	},
	count: number
): string {
	const lines: string[] = [];
	lines.push(`## Search Results for: "${query}"`);
	lines.push(`*Showing ${data.web?.results?.length || 0} results (type: web)*`);
	lines.push("");

	// AI Summary if available
	if (data.summary?.text) {
		lines.push("### AI Summary");
		lines.push(data.summary.text);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	lines.push("### Results");
	lines.push("");

	const results = data.web?.results || [];
	if (results.length === 0) {
		lines.push("No results found.");
	} else {
		results.forEach((result, index) => {
			lines.push(`${index + 1}. **${result.title}**`);
			lines.push(`   URL: ${result.url}`);
			if (result.description) {
				lines.push(`   Description: ${result.description}`);
			}
			if (result.age) {
				lines.push(`   Age: ${result.age}`);
			}
			lines.push("");
		});
	}

	return lines.join("\n");
}

/**
 * Format news search results for LLM consumption
 */
function formatNewsResults(
	query: string,
	data: {
		results?: Array<{
			title: string;
			url: string;
			description?: string;
			age?: string;
			source?: string;
			published?: string;
			thumbnail?: { src: string };
		}>;
	}
): string {
	const lines: string[] = [];
	lines.push(`## News Results for: "${query}"`);
	lines.push(`*Showing ${data.results?.length || 0} results*`);
	lines.push("");

	lines.push("### Results");
	lines.push("");

	const results = data.results || [];
	if (results.length === 0) {
		lines.push("No results found.");
	} else {
		results.forEach((result, index) => {
			lines.push(`${index + 1}. **${result.title}**`);
			if (result.source) {
				lines.push(`   Source: ${result.source}`);
			}
			lines.push(`   URL: ${result.url}`);
			if (result.published || result.age) {
				lines.push(`   Published: ${result.published || result.age}`);
			}
			if (result.description) {
				lines.push(`   Description: ${result.description}`);
			}
			lines.push("");
		});
	}

	return lines.join("\n");
}

/**
 * Execute a Brave Search API request
 */
async function executeSearch(
	type: "web" | "news",
	params: {
		query: string;
		count?: number;
		offset?: number;
		freshness?: string;
		country?: string;
		search_lang?: string;
		summary?: boolean;
		extra_snippets?: boolean;
	},
	signal?: AbortSignal,
	notify?: (message: string, type: "info" | "success" | "error") => void
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
	const apiKey = getApiKey();

	if (!apiKey) {
		return {
			content: [
				{
					type: "text",
					text: "Brave Search API key not found. Set BRAVE_API_KEY environment variable.",
				},
			],
			isError: true,
		};
	}

	try {
		const url = buildSearchUrl(type, params);

		notify?.(`Searching Brave ${type}...`, "info");

		const response = await fetch(url.toString(), {
			headers: {
				Accept: "application/json",
				"X-Subscription-Token": apiKey,
			},
			signal,
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			let errorMessage = `Brave API error (${response.status}): ${errorText}`;

			if (response.status === 401) {
				errorMessage = "Brave API error: Invalid API key. Check your BRAVE_API_KEY environment variable.";
			} else if (response.status === 429) {
				errorMessage = "Brave API error: Rate limit exceeded. Please try again later.";
			}

			notify?.("Search failed", "error");
			return {
				content: [{ type: "text", text: errorMessage }],
				isError: true,
			};
		}

		const data = await response.json();
		const formattedResult = type === "web"
			? formatWebResults(params.query, data, params.count || 10)
			: formatNewsResults(params.query, data);

		notify?.("Search complete", "success");
		return {
			content: [{ type: "text", text: formattedResult }],
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return {
				content: [{ type: "text", text: "Search was cancelled" }],
				isError: true,
			};
		}
		const message = error instanceof Error ? error.message : String(error);
		notify?.("Search failed", "error");
		return {
			content: [{ type: "text", text: `Search failed: ${message}` }],
			isError: true,
		};
	}
}

/**
 * Handle brave_search tool execution
 */
async function handleSearch(
	_toolCallId: string,
	params: {
		query: string;
		type?: "web" | "news";
		count?: number;
		offset?: number;
		freshness?: string;
		country?: string;
		search_lang?: string;
		summary?: boolean;
		extra_snippets?: boolean;
	},
	signal: AbortSignal | undefined,
	_onUpdate: ((update: { content: { type: string; text: string }[] }) => void) | undefined,
	ctx: { ui: { notify: (message: string, type: "info" | "success" | "error") => void } }
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
	const searchType = params.type || "web";

	// Validate and clamp count based on type
	let count = params.count ?? 10;
	const maxCount = searchType === "web" ? 20 : 50;
	if (count > maxCount) {
		count = maxCount;
		ctx.ui.notify(`Count clamped to ${maxCount} for ${searchType} search`, "info");
	}

	// Validate offset for news (0-9)
	let offset = params.offset ?? 0;
	if (searchType === "news" && offset > 9) {
		offset = 9;
		ctx.ui.notify("Offset clamped to 9 for news search", "info");
	}

	return executeSearch(
		searchType,
		{
			query: params.query,
			count,
			offset,
			freshness: params.freshness,
			country: params.country,
			search_lang: params.search_lang,
			summary: params.summary,
			extra_snippets: params.extra_snippets,
		},
		signal,
		ctx.ui.notify
	);
}

/**
 * Extension entry point
 */
export default function (pi: ExtensionAPI) {
	// Check configuration on startup
	const apiKey = getApiKey();
	if (!apiKey) {
		console.warn("[pi-brave-search] BRAVE_API_KEY not configured. Search will fail.");
	}

	// Register brave_search tool
	pi.registerTool({
		name: "brave_search",
		label: "Brave Search",
		description:
			"Search the web using Brave Search API. Supports both web and news search. Returns AI-summarized results when summary is enabled (web only).",
		parameters: Type.Object({
			query: Type.String({
				description: "Search query (max 400 characters, 50 words)",
			}),
			type: Type.Optional(
				Type.Union([Type.Literal("web"), Type.Literal("news")], {
					description: 'Search type: "web" (default) or "news"',
				})
			),
			count: Type.Optional(
				Type.Integer({
					minimum: 1,
					maximum: 50,
					description: "Number of results (default: 10, max: 20 for web, 50 for news)",
				})
			),
			offset: Type.Optional(
				Type.Integer({
					minimum: 0,
					description: "Pagination offset (default: 0, max 9 for news)",
				})
			),
			freshness: Type.Optional(
				Type.String({
					description: 'Filter by age: "day", "week", "month", "year", or "YYYY-MM-DDtoYYYY-MM-DD"',
				})
			),
			country: Type.Optional(
				Type.String({
					description: '2-char ISO country code (default: "us")',
				})
			),
			search_lang: Type.Optional(
				Type.String({
					description: 'Language code (default: "en")',
				})
			),
			summary: Type.Optional(
				Type.Boolean({
					description: "Enable AI summary of results (web only, default: false)",
				})
			),
			extra_snippets: Type.Optional(
				Type.Boolean({
					description: "Get 5 extra snippets per result (default: false)",
				})
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return handleSearch(
				toolCallId,
				params as {
					query: string;
					type?: "web" | "news";
					count?: number;
					offset?: number;
					freshness?: string;
					country?: string;
					search_lang?: string;
					summary?: boolean;
					extra_snippets?: boolean;
				},
				signal,
				onUpdate,
				ctx as { ui: { notify: (message: string, type: "info" | "success" | "error") => void } }
			);
		},
	});
}
