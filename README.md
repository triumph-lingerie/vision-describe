# VisionDescribe

AI-powered content generation for e-commerce and marketplace platforms. Uses Claude Opus 5 with adaptive thinking to generate brand-compliant product descriptions, bullet points and optimised copy, with per-run cost tracking and multi-language support.

Built with React, TypeScript, Vercel serverless functions and Supabase.

## Features

- **Multi-platform support**: Inriver (e-commerce), Amazon (listings + A+ content), NEXT (UK market), About You (style-led), Partoo (store locations)
- **Metadata Generation**: long descriptions for new SKUs from the marketing USPs, or a brand-standard rewrite of a PIM export, in EN plus 11 locales; live or through the Batches API at half price
- **Batch processing**: large product catalogs (1000+ items) with client-side, server-side and Batches API pipelines
- **Run persistence and resume**: every Metadata Generation run is saved product by product; a closed tab or an exhausted credit can be picked up where it stopped
- **Cost tracking**: list-price cost per call including prompt-cache rates, a pre-run estimate from the API's own token count, and run totals in the dashboard
- **Style checks**: code-side verification of the generated HTML (opener, banned words, em dashes, structure, length), reported per product
- **Image analysis**: upload product images and generate descriptions using vision
- **Color and size translation**: deterministic mappings (e.g. DE→EN colors, EU→GB sizes) for consistent output
- **Content validation**: forbidden word detection, character limits and policy compliance
- **Multi-language**: content generation and translation across 50+ languages
- **Smart column detection**: automatic field mapping and use case identification from uploaded files
- **Multi-format support**: Excel (.xlsx, .xlsm), CSV and JSON file processing
- **Dark/Light mode**

## AI model and effort

Every flow runs on Claude Opus 5 with adaptive thinking. Effort is set per route in `src/components/GenerateMode/generationConfig.ts`:

| Route | Model | Effort | Why |
|-------|-------|--------|-----|
| EN master generation / EN rewrite | `claude-opus-5` | high | The creative step; it carries the terminology contract |
| Localisation of the EN master | `claude-opus-5` | medium | Starts from a finished text; medium trims the thinking tokens that make up about half of the output cost |
| Optimize, CSV translation, image analysis | `claude-opus-5` | high | |

Changing a route to another model (for example Claude Fable 5.1 for the EN master) is a one-line edit in that file; prices for every candidate live in `src/lib/pricing.ts`. Validate any change on a handful of SKUs with the market proofreaders first.

Sampling parameters (temperature, top_p, top_k) are never sent: Opus 5 rejects them. The stable instruction block of every prompt is sent as a cached system prefix (1-hour TTL on the metadata flows), so on a batch every call after the first reads it from the cache.

## Metadata Generation: live vs batch

| | Live | Batch |
|---|---|---|
| Price | List price | 50% off every token (Anthropic Batches API) |
| Turnaround | Results as they come | Most batches finish within the hour, 24h maximum |
| Tab | Keep it open (a closed tab can be resumed) | Can be closed; reconnect from the upload screen |
| API key | Browser calls the API with the key from Settings | Server submits with the key from Settings (or the deployment's `ANTHROPIC_API_KEY`) |

Both modes save a run in Supabase (`runs` + one `run_results` row per product) and show a cost estimate before starting. Batch mode runs two phases: EN masters first, then the localisations built on them.

## Supported Platforms

| Platform | Description |
|----------|-------------|
| **E-commerce (Inriver)** | Product descriptions and material content optimization |
| **Amazon** | Listings optimization with bullet points, descriptions, and A+ content |
| **NEXT** | Product titles and copy for the UK market (British English, 30-55 family-oriented audience) |
| **About You** | Style names and long descriptions for the style-led 18-35 demographic |
| **Partoo** | Store location descriptions with brand Tone of Voice compliance |

Partoo, NEXT and About You use structured outputs (`output_config.format`): the API guarantees the JSON shape, and character limits are enforced in code.

## Quick Start

### Prerequisites

- Node.js 22+
- Anthropic API key
- Supabase project (for auth and data persistence)

### Installation

```bash
git clone https://github.com/triumph-lingerie/vision-describe.git
cd vision-describe
npm install
npm run dev
```

### Configuration

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_ANTHROPIC_API_KEY` | No | Anthropic API key (can also be set in-app) |

Server-side (Vercel) also requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and, as a fallback for users without a key in Settings, `ANTHROPIC_API_KEY`.

## Architecture

```
src/
├── pages/                        # Route pages (Index, Login, Changelog)
├── components/
│   ├── AppShell/                 # Main layout and navigation
│   ├── GenerateMode/             # Image analysis, metadata generation, CSV translation
│   │   ├── generationConfig.ts   # Model and effort per route
│   │   ├── components/
│   │   │   ├── ImageAnalysis/    # Product image processing
│   │   │   ├── CsvTranslation/  # Batch CSV translation
│   │   │   ├── MetadataGeneration/ # Long descriptions (live + batch, resume)
│   │   │   └── SubModeSelector/  # Feature selector
│   │   ├── prompts/              # AI prompts
│   │   ├── utils/                # API wrapper, format detection, style guard, terminology
│   │   └── hooks/                # Custom hooks
│   ├── OptimizeMode/             # Batch file processing and optimization
│   │   ├── components/           # UI panels and forms
│   │   ├── processing/           # File processing logic
│   │   └── utils/
│   │       ├── sanitizers/       # Text validation
│   │       ├── prompts/          # AI prompts
│   │       └── translations/     # Language mappings
│   ├── Dashboard/                # Analytics and statistics
│   ├── Projects/                 # Project management
│   ├── Settings/                 # User settings and API keys
│   └── ui/                       # shadcn/UI component library
├── contexts/
│   ├── AuthContext.tsx            # Supabase auth state
│   └── ApiKeysContext.tsx         # User API keys storage
├── lib/
│   ├── api/                      # API clients (Anthropic, server, batch)
│   ├── pricing.ts                # List prices and cost arithmetic (shared with api/)
│   ├── metadataRuns.ts           # Run persistence for Metadata Generation
│   ├── runPersistence.ts         # Run persistence for Optimize mode
│   ├── models.ts                 # AI model definitions
│   ├── supabase.ts               # Supabase client
│   └── prompts/                  # Shared prompt templates
└── config/
    └── env.ts                    # Environment helpers

api/                              # Vercel serverless functions
├── start-run.ts                  # Initiate processing
├── process-run.ts                # Execute batch processing
├── process-run-chain.ts          # Multi-step pipeline
├── resume-run.ts                 # Resume interrupted runs
├── cancel-run.ts                 # Cancel running task
├── batch-create.ts               # Optimize mode: create a Message Batch
├── batch-status.ts               # Poll a Message Batch
├── batch-results.ts              # Optimize mode: collect a Message Batch
├── batch-submit.ts               # Metadata Generation: submit a phase as a Message Batch
├── batch-collect.ts              # Metadata Generation: store a phase's results
└── _lib/
    ├── types.ts                  # Shared API types
    ├── aiClients.ts              # Claude client (adaptive thinking, caching, structured outputs)
    ├── processors.ts             # Data processing logic
    └── supabaseAdmin.ts          # Admin Supabase client

supabase/migrations/              # Database schema
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 18 + TypeScript | Type-safe user interface |
| Styling | Tailwind CSS + Radix UI | Accessible design system |
| State | TanStack React Query | Server state management |
| Routing | React Router DOM | Client-side routing |
| File Processing | ExcelJS + Papa Parse | Excel and CSV handling |
| AI Integration | Anthropic SDK | Language model integration |
| Auth & Database | Supabase (PostgreSQL) | Authentication and data persistence |
| Deployment | Vercel | Serverless functions + static hosting |

## Security and data

- **Supabase Auth**: email/password authentication restricted to the company domain, with Row-Level Security on every table
- **What is stored**: run metadata, the parsed input workbook and the generated descriptions live in Supabase (EU region) so runs can be resumed and audited; input files sent for server-side or batch processing are stored in a private bucket, readable only by the user who uploaded them
- **API keys**: the Anthropic key entered in Settings is stored in the user's `user_settings` row (RLS-scoped). Moving it to Supabase Vault is planned.
- **What Anthropic sees**: product metadata and descriptions, under the API data-retention terms of the account

## Development

```bash
npm run dev        # Start Vite dev server on port 8080
npm run build      # Production build
npm run typecheck  # tsc for the app and for the server functions
npm test           # Unit tests (vitest)
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

CI (GitHub Actions) runs typecheck, tests and build on every push and pull request.

## License

This project is **dual-licensed**:

- **Non-Commercial**: [CC BY-NC-SA 4.0](LICENSE): free for personal and educational use
- **Commercial**: contact for licensing

Copyright (c) 2025-present Filippo Danesi
