# AttachSurfer Architecture

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 19 + Vite 8 | Component-based UI with fast HMR |
| **Styling** | CSS Custom Properties | Dark/light theming, responsive design |
| **Icons** | Lucide React | Consistent icon set |
| **Search APIs** | Bing Search API / Google Custom Search API | Official search API calls |
| **AI Inference** | WebLLM (Phi-4-mini) | Browser-based LLM for summarization |
| **Local Storage** | Dexie.js (IndexedDB) | Search history, results, telemetry |
| **HTML→Markdown** | Turndown | Convert extracted HTML to markdown |
| **Language** | JavaScript (JSX) | No TypeScript overhead |

## System Architecture

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
            WLLM["WebLLM MLCEngine<br/>Singleton · Phi-4-mini-instruct-q4f16_1-MLC"]
        end

        subgraph "External APIs"
            B["Bing Search API<br/>api.bing.microsoft.com"]
            G["Google Custom Search API<br/>googleapis.com"]
            WEB["Web Pages<br/>(content extraction)"]
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

## Data Flow

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
        SS->>API: GET /v7.0/search (Ocp-Apim-Subscription-Key)
        API-->>SS: JSON results
    and Google Search
        SS->>API: GET /customsearch/v1 (key + cx)
        API-->>SS: JSON results
    end

    SS-->>UI: ParsedResult[]
    UI->>DB: Save search + results

    loop For each result
        UI->>ES: extractPageContent(url)
        ES->>WEB: fetch(url)
        WEB-->>ES: HTML content
        ES-->>UI: {markdown, type, title}
        UI->>DB: Save content
    end

    User->>UI: Click "Generate Summary"
    UI->>SM: generateSummary(results, contents)
    SM->>WLLM: chat.completions.create(prompt)
    WLLM-->>SM: AI summary text
    SM-->>UI: Formatted markdown summary
    UI->>DB: Save summary
    UI-->>User: Display summary
```

## Component Architecture

```mermaid
graph LR
    A["App.jsx<br/>Root · State · Routing"] --> B["SearchBar<br/>Query · Engine · Filter · Count"]
    A --> C["ResultCard<br/>Rank · Title · URL · Snippet · Content"]
    A --> D["SummaryPanel<br/>AI-generated summary display"]
    A --> E["SettingsView<br/>Config · API keys · Model"]
    A --> F["SearchHistory<br/>Past searches · Date filter · Delete"]
    A --> G["HardwareWarning<br/>RAM/CPU capability check"]

    A --> H["SearchService<br/>Bing + Google API calls"]
    A --> I["ExtractService<br/>HTML→Markdown (Turndown)"]
    A --> J["SummaryService<br/>WebLLM summarization"]
    A --> K["TelemetryService<br/>Event tracking"]
```

## IndexedDB Schema

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
        string attachmentFilter
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
        timestamp timestamp
    }
    ATTACHMENTS {
        int id PK
        int resultId FK
        int searchId FK
        string filename
        string type
        string content
        timestamp timestamp
    }
    SUMMARIES {
        int id PK
        int searchId FK
        string content
        timestamp timestamp
    }
    TELEMETRY {
        int id PK
        string event
        json data
        timestamp timestamp
    }
```

## Privacy Model

All processing is client-side only:

| Operation | Location | Data Sent Externally |
|-----------|----------|---------------------|
| Search queries | Browser → Bing/Google API | Query text via official API |
| Content extraction | Browser → Target URL | URL only |
| AI summarization | Browser (WebLLM) | Nothing |
| Data storage | Browser (IndexedDB) | Nothing |
| Telemetry | Browser (IndexedDB) | Nothing |

No server, no analytics services, no third-party proxies.
