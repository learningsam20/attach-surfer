# AttachSurfer

> Privacy-first web search with attachment extraction and AI-powered summarization. All AI processing happens in your browser.

## Features

- **Multi-Engine Search**: Search across Bing and Google via official APIs
- **Attachment Detection**: Automatically identifies and extracts content from attachments
- **Content Extraction**: Converts web pages to readable markdown using Turndown
- **AI Summarization**: Generate summaries from search results using WebLLM (runs entirely in-browser)
- **Search History**: Store and review past searches in IndexedDB
- **Dark/Light Mode**: Modern responsive UI with theme toggle
- **Fully Private**: AI processing is local — no data leaves your browser

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 5289)
npm run dev
```

Open [http://localhost:5289](http://localhost:5289) in Chrome or Edge (WebGPU required).

```bash
# Kill process on port 5289 and restart
npm run restart
```

## Configuration

Copy `.env.example` to `.env` and add your API keys:

### Required: Search API Keys

At least one engine key is needed.

| Engine | Key | Where to get it |
|--------|-----|-----------------|
| **Bing** | `VITE_BING_API_KEY` | [portal.azure.com](https://portal.azure.com) → Create "Bing Search v7" resource (free: 1000 calls/month) |
| **Google** | `VITE_GOOGLE_API_KEY` + `VITE_GOOGLE_CX` | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) for API key, [programmablesearchengine.google.com](https://programmablesearchengine.google.com) for CX |

### Optional Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DEFAULT_SEARCH_ENGINE` | `bing` | Default engine: `bing`, `google`, or `all` |
| `VITE_DEFAULT_RESULT_COUNT` | `3` | Default number of results (1-10) |
| `VITE_WEBLLM_MODEL` | `Phi-4-mini-instruct-q4f16_1-MLC` | WebLLM model for summarization |
| `VITE_TELEMETRY_ENABLED` | `true` | Track usage events locally |
| `VITE_STORE_HISTORY` | `true` | Store search history in IndexedDB |

## Usage

1. **Search**: Enter your query and click Search or press Enter
2. **Configure**: Choose search engine, attachment filter, and result count
3. **Explore**: Click "View Extracted Content" on any result to see extracted markdown
4. **Summarize**: Click "Generate Summary" to create an AI-powered summary of all results
5. **Review**: Check the History tab to review past searches
6. **Settings**: Configure default behavior, AI model, and view API key status

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Browser (Client-Side Only)"
        UI["React UI<br/>SearchBar · ResultCard · SummaryPanel · Settings · History"]

        subgraph "Services Layer"
            SS["Search Service<br/>Bing API + Google API (direct)"]
            ES["Extract Service<br/>HTML → Markdown (Turndown)"]
            SM["Summary Service<br/>WebLLM (Phi-4-mini)"]
            TL["Telemetry Service<br/>Local event tracking"]
        end

        subgraph "Data Layer"
            DB["Dexie.js / IndexedDB<br/>searches · results · attachments · summaries · telemetry"]
        end

        subgraph "AI Engine"
            WLLM["WebLLM MLCEngine<br/>Singleton · Phi-4-mini"]
        end

        subgraph "External APIs"
            B["Bing Search API"]
            G["Google Custom Search API"]
            WEB["Web Pages"]
        end
    end

    UI --> SS
    UI --> ES
    UI --> SM
    UI --> TL
    SS -->|API key| B
    SS -->|API key + CX| G
    ES --> WEB
    SM --> WLLM
    TL --> DB
    UI <--> DB
```

### Data Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant SS as Search Service
    participant API as Bing / Google API
    participant ES as Extract Service
    participant SM as Summary Service
    participant WLLM as WebLLM Engine
    participant DB as IndexedDB

    User->>UI: Enter query + options
    UI->>UI: Validate API keys
    UI->>SS: search(query, engine, count)

    par Bing Search
        SS->>API: GET /v7.0/search
        API-->>SS: JSON results
    and Google Search
        SS->>API: GET /customsearch/v1
        API-->>SS: JSON results
    end

    SS-->>UI: ParsedResult[]
    UI->>DB: Save search + results

    loop For each result
        UI->>ES: extractPageContent(url)
        ES-->>UI: {markdown, type, title}
        UI->>DB: Save content
    end

    User->>UI: Click "Generate Summary"
    UI->>SM: generateSummary(results, contents)
    SM->>WLLM: chat.completions.create(prompt)
    WLLM-->>SM: AI summary
    SM-->>UI: Formatted summary
    UI->>DB: Save summary
    UI-->>User: Display summary
```

### Component Architecture

```mermaid
graph LR
    A["App.jsx"] --> B["SearchBar"]
    A --> C["ResultCard"]
    A --> D["SummaryPanel"]
    A --> E["SettingsView"]
    A --> F["SearchHistory"]
    A --> G["HardwareWarning"]

    A --> H["SearchService"]
    A --> I["ExtractService"]
    A --> J["SummaryService"]
    A --> K["TelemetryService"]
```

### IndexedDB Schema

```mermaid
erDiagram
    SEARCHES ||--o{ RESULTS : contains
    SEARCHES ||--o{ ATTACHMENTS : references
    SEARCHES ||--o| SUMMARIES : has
    SEARCHES {
        int id PK
        string query
        string engine
        int resultCount
        timestamp timestamp
    }
    RESULTS {
        int id PK
        int searchId FK
        int rank
        string title
        string url
        string snippet
        string engine
    }
    ATTACHMENTS {
        int id PK
        int searchId FK
        string filename
        string type
        string content
    }
    SUMMARIES {
        int id PK
        int searchId FK
        string content
    }
    TELEMETRY {
        int id PK
        string event
        json data
    }
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Browser Requirements

- Chrome 113+ or Edge 113+ (WebGPU support)
- 8GB+ RAM recommended
- Internet connection for search and content extraction

## License

MIT
