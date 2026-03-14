# Brave Search Extension for pi

A pi extension that provides web and news search capabilities via the Brave Search API.

## Features

- **Web Search**: General web search with AI-generated summaries
- **News Search**: Search a curated index of news sources
- **Freshness Filtering**: Filter results by age (day, week, month, year, or custom date range)
- **Localization**: Country and language targeting
- **AI Summaries**: Get AI-generated summaries of search results (web only)
- **Extra Snippets**: Request additional context snippets per result

## Installation

1. Obtain a Brave Search API key from [Brave Search API](https://brave.com/search/api/)
2. Set the environment variable:

```bash
export BRAVE_API_KEY=your_api_key_here
```

3. The extension will be automatically loaded by pi.

## Tool: `brave_search`

The extension provides a single unified search tool.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | **required** | Search query (max 400 chars, 50 words) |
| `type` | "web" \| "news" | "web" | Search type |
| `count` | number | 10 | Number of results (max: 20 web, 50 news) |
| `offset` | number | 0 | Pagination offset (max 9 for news) |
| `freshness` | string | - | Filter by age |
| `country` | string | "us" | 2-char ISO country code |
| `search_lang` | string | "en" | Language code |
| `summary` | boolean | false | Enable AI summary (web only) |
| `extra_snippets` | boolean | false | Get 5 extra snippets per result |

### Freshness Values

- `"day"` - Past 24 hours
- `"week"` - Past 7 days
- `"month"` - Past 31 days
- `"year"` - Past 365 days
- `"YYYY-MM-DDtoYYYY-MM-DD"` - Custom date range

### Examples

```typescript
// Basic web search
brave_search({ query: "TypeScript best practices" })

// News search with freshness filter
brave_search({
  query: "AI developments",
  type: "news",
  freshness: "week"
})

// Web search with AI summary
brave_search({
  query: "quantum computing explained",
  summary: true
})

// Localized search
brave_search({
  query: "local restaurants",
  country: "de",
  search_lang: "de"
})
```

## Output Format

### Web Search

```
## Search Results for: "query"
*Showing X results (type: web)*

### AI Summary
<AI-generated summary if enabled>

---

### Results

1. **Title**
   URL: https://example.com
   Description: <snippet>
   Age: <relative time>
```

### News Search

```
## News Results for: "query"
*Showing X results*

### Results

1. **Article Title**
   Source: News Source
   URL: https://news.example.com/article
   Published: <timestamp>
   Description: <snippet>
```

## Error Handling

The tool provides clear error messages for:
- Missing API key
- Invalid API key (401)
- Rate limiting (429)
- Network errors
- Invalid parameters

## License

MIT
