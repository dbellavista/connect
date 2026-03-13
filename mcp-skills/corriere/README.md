# Corriere della Sera Skills

This directory contains skills to interact with the Corriere della Sera news outlet.

**Note**: All content (categories, titles, snippets, articles) is in **Italian**.

## Available Skills

### Get Categories

- **Description**: List available news categories and their RSS URLs.
- **MCP Tool**: `corriere_get_categories`

### Get News

- **Description**: Get latest news articles. You can filter by multiple categories and date ranges.
- **MCP Tool**: `corriere_get_news`
- **Parameters**:
  - `categories`: Array of category names (e.g. `["Notizie: Homepage", "Locale: Milano"]`) or custom RSS URLs.
  - `gte`: (Optional) Filter articles newer than or equal to this date (ISO string).
  - `lte`: (Optional) Filter articles older than or equal to this date (ISO string).

### Read Article

- **Description**: Read the full text of an article, bypassing paywall via cookies.
- **MCP Tool**: `corriere_read_article`
- **Parameters**:
  - `url`: The article URL.
  - `cookies_file`: Path to the cookies file (defaults to `data/corriere-cookies.txt`).
