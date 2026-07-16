# Beyond90 AI
### FIFA World Cup 2026 — Smart Stadium Intelligence Platform

> *Intelligence Beyond The Final Whistle*

**Live Demo:** [https://beyond90-ai-1002766839472.us-central1.run.app](https://beyond90-ai-1002766839472.us-central1.run.app)

Beyond90 AI is a GenAI-powered platform for the FIFA World Cup 2026, delivering real-time intelligence to fans, operations staff, volunteers, and media across all 8 USA host venues. It transforms how 3.4 million fans and thousands of staff experience the tournament — with conversational AI, live crowd analytics, accessible navigation, and operational command in one unified platform.

---

## Challenge

**[Challenge 4] Smart Stadiums & Tournament Operations**

Beyond90 AI addresses every dimension of the challenge brief: navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, operational intelligence, and real-time decision support.

---

## Live Demo

| Page | URL |
|---|---|
| Home | [beyond90-ai-1002766839472.us-central1.run.app](https://beyond90-ai-1002766839472.us-central1.run.app) |
| Fan Hub | [.../fan](https://beyond90-ai-1002766839472.us-central1.run.app/fan) |
| Ops Center | [.../ops](https://beyond90-ai-1002766839472.us-central1.run.app/ops) |

---

## Key Features

### Fan Hub — Conversational AI for Every Fan
- **AI Navigation** — Ask anything; get step-by-step directions to any seat, gate, or facility using A* pathfinding with live crowd awareness
- **Crowd-Intelligent Routing** — Routes automatically avoid congestion hotspots; density updates in real time
- **Accessibility-First** — Step-free routing for wheelchair users; sensory rooms, companion care, and ADA facilities surfaced first
- **Multilingual** — Responds natively in 10+ languages (Arabic, Spanish, French, Portuguese, German, Japanese, Mandarin, Hindi, and more)
- **Role-Aware** — Distinct experience modes for Fan, Staff, Volunteer, and Media

### Operations Center — Command Intelligence for Venue Staff
- **Live Crowd Heatmap** — SVG schematic with congestion index per zone, updated on demand
- **AI Ops Advisor** — GenAI analyzes crowd patterns, active alerts, and sustainability state to generate prioritized recommendations
- **Automated Alert Engine** — Detects hotspots, gate queue build-ups, transport delays; generates specific recommended actions
- **Sustainability Dashboard** — Live recycling rate, carbon per fan, renewable energy %, composite score per venue
- **Staff Coordination** — Deployment status overview with zone-level visibility

### GenAI Architecture — Multi-Provider, Swappable
- **Default provider: Groq** (`llama-3.1-8b-instant`) — fast, zero-latency streaming
- **Gemini** (`gemini-flash-latest`) — context injection pattern, no function-calling surface
- **Claude** (`claude-sonnet-4-6`) — 6 structured tools, multi-turn tool use, SSE streaming
- Single `AI_PROVIDER` env flag switches the entire backend with no code changes

---

## Approach & Logic

### Why A* over Dijkstra
The reference architecture uses Dijkstra. Beyond90 uses A* with Euclidean heuristic on the venue's 2D coordinate system. A* is admissible and consistent on this domain, so it finds the optimal path while visiting fewer nodes — critical when the graph is queried on every fan message.

### Crowd Flow Model
Unlike time-tier rules, Beyond90 uses a **continuous sigmoid flow model** per node type:
- `occupancy(t)` driven by inflow minus outflow, modelled by phase-aware sigmoid curves
- Node types: gate, concourse, concession, restroom, seating, exit — each with its own lifecycle curve
- Match phases: pre-match surge (T-150 to T-0), halftime spike (T+43 to T+52), post-match egress (T+90+)
- **Congestion Index** (0–100): composite of occupancy ratio, inflow density relative to node capacity, and trend direction

### Context Injection (Gemini / Groq)
For providers that don't support function calling reliably, venue data, crowd snapshot, and match state are pre-computed locally and injected into the system prompt. This eliminates tool-use surface entirely and prevents `thoughtSignature` errors from Gemini's experimental models.

---

## Venues Covered

| Venue | City | Capacity |
|---|---|---|
| MetLife Stadium | East Rutherford, NJ | 82,500 |
| SoFi Stadium | Inglewood, CA | 70,240 |
| AT&T Stadium | Arlington, TX | 80,000 |
| Levi's Stadium | Santa Clara, CA | 68,500 |
| Hard Rock Stadium | Miami Gardens, FL | 65,326 |
| Mercedes-Benz Stadium | Atlanta, GA | 71,000 |
| Lincoln Financial Field | Philadelphia, PA | 69,796 |
| Gillette Stadium | Foxborough, MA | 65,878 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| AI — default | Groq `llama-3.1-8b-instant` (OpenAI-compatible API) |
| AI — optional | Google Gemini `gemini-flash-latest` |
| AI — optional | Anthropic Claude `claude-sonnet-4-6` |
| Pathfinding | A* algorithm on 2D venue coordinate graph |
| Crowd Model | Continuous sigmoid flow model (6 node types, 3 match phases) |
| Styling | Tailwind CSS (dark theme, design tokens) |
| Testing | Vitest — 301 tests across 5 test suites |
| Accessibility | WCAG 2.1 AA — skip nav, aria-live, focus-visible, reduced-motion |
| Deployment | Google Cloud Run |

---

## Testing

301 tests across 5 suites — all passing.

```bash
npm test              # run all tests
npm run test:coverage # run with coverage report
```

| Suite | Tests | Coverage Area |
|---|---|---|
| `crowd.test.ts` | 37 | `generateCrowdForecast`, occupancy model, `getCrowdLevel`, wait estimation |
| `graph.test.ts` | 22 | A* pathfinding, step-free mode, avoid-nodes, `nearestFacilityNode` |
| `validation.test.ts` | 28 | VenueId, query strings, minutesToKickoff, roles, profiles, prompt injection sanitization |
| `data.test.ts` | 73 | All 8 venues: capacity ranges, node/edge/facility integrity, step-free coverage |
| `accessibility.test.ts` | 22 | Skip link, aria-labels, heading hierarchy, form label association, SVG, table caption, aria-live |

---

## Accessibility

Beyond90 targets **WCAG 2.1 AA** across all pages:

- **Skip navigation link** — keyboard users jump directly to main content
- **`<main id="main">`** — landmark navigation for screen readers
- **All form controls** have associated `<label>` via `htmlFor`/`id`
- **Icon-only buttons** have `aria-label` (Send, Refresh, Settings toggle)
- **`aria-live="polite" role="log"`** on both chat message containers — responses announced to screen readers
- **SVG heatmap** — `role="img"`, `aria-label`, `<title>`, and keyboard `tabIndex`/`onFocus` per node
- **Heading hierarchy** — every page has a single `<h1>`, sections use `<h2>`
- **`:focus-visible`** outline with 3px gold ring (contrast >3:1 on dark background)
- **`prefers-reduced-motion`** — all animations and transitions disabled when OS setting is active
- **No nested interactive elements** — `<Link><button>` patterns replaced with `<Link className="btn-...">`
- Accessibility compliance is **machine-verified** via `tests/accessibility.test.ts`

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Groq API key (free) — [console.groq.com](https://console.groq.com)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd beyond90-ai
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local: add your GROQ_API_KEY (or GEMINI_API_KEY / ANTHROPIC_API_KEY)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
# AI provider — groq (default) | gemini | claude
AI_PROVIDER=groq

# Groq (default — fastest, free tier available)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Google Gemini (optional)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest

# Anthropic Claude (optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=claude-sonnet-4-6
```

Switching AI providers requires only changing `AI_PROVIDER` — no code changes.

---

## Architecture

```
beyond90-ai/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout — skip link, <main>, WCAG baseline
│   ├── globals.css              # Design tokens, skip-link, focus-visible, reduced-motion
│   ├── fan/page.tsx             # Fan Hub (streaming chat, sidebar session config)
│   ├── ops/page.tsx             # Operations Center dashboard
│   └── api/
│       ├── assist/route.ts      # Streaming AI endpoint (raw text chunks)
│       ├── crowd/route.ts       # Crowd intelligence API
│       ├── ops/route.ts         # Ops snapshot (GET) + AI advisor (POST)
│       └── venues/route.ts      # Venue graph data API
├── lib/
│   ├── ai/
│   │   ├── client.ts            # Provider factory (AI_PROVIDER flag)
│   │   ├── context.ts           # Venue context builder (injected into system prompt)
│   │   └── providers/
│   │       ├── groq.ts          # Groq — OpenAI-compatible, SSE streaming
│   │       ├── gemini.ts        # Gemini — context injection, no function calling
│   │       └── claude.ts        # Claude — 6 tools, multi-turn tool use, SSE
│   ├── venues/
│   │   ├── data.ts              # All 8 WC2026 venue graphs (nodes, edges, facilities)
│   │   ├── graph.ts             # A* pathfinding + nearestFacilityNode (BFS)
│   │   └── crowd.ts             # Sigmoid crowd flow model + congestion index
│   └── types.ts                 # Shared TypeScript types
├── components/
│   ├── fan/MessageBubble.tsx
│   └── shared/
│       ├── VenueSelector.tsx
│       └── CrowdBadge.tsx
└── tests/
    ├── crowd.test.ts            # 37 tests — crowd model invariants
    ├── graph.test.ts            # 22 tests — A* pathfinding correctness
    ├── validation.test.ts       # 28 tests — input validation & sanitization
    ├── data.test.ts             # 73 tests — all 8 venue graph integrity
    └── accessibility.test.ts   # 22 tests — WCAG structure assertions
```

### How the AI Responds (Claude path)

When a fan asks *"Where's the nearest accessible restroom from Gate C?"*:
1. Calls `find_nearest_facility` → locates the closest ADA restroom node
2. Calls `find_route` → computes the A* step-free path
3. Calls `get_crowd_status` → checks congestion on the route segments
4. Streams the response token-by-token — the fan sees directions appear in real time

For Groq/Gemini: venue graph, crowd snapshot, and match state are pre-computed and injected into the system prompt — equivalent capability, no function-calling overhead.

---

## Assumptions

- Venue node graphs are pre-built with realistic 2D coordinates (0–100 normalized scale) rather than GPS, which keeps pathfinding fast in the browser and on the server
- Crowd flow is simulated deterministically from `minutesToKickoff` — a real deployment would pipe in live sensor or turnstile data
- Staff resource data on the ops dashboard is representative mock data; in production this would connect to a venue management system
- Multilingual support relies entirely on the LLM — no hardcoded translation files

---

Built for FIFA World Cup 2026 · Beyond90 AI
