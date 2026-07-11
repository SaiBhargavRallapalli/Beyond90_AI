# Beyond90 AI
### FIFA World Cup 2026 — Smart Stadium Intelligence Platform

> *Intelligence Beyond The Final Whistle*

Beyond90 AI is a GenAI-powered platform for the FIFA World Cup 2026, delivering real-time intelligence to fans, operations staff, volunteers, and media across all 8 USA host venues. Built with Anthropic Claude claude-sonnet-4-6 using multi-turn tool use and streaming, it transforms how 3.4 million fans and thousands of staff experience the tournament.

---

## Challenge

**[Challenge 4] Smart Stadiums & Tournament Operations**

Beyond90 AI addresses: navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, operational intelligence, and real-time decision support — all in one unified platform.

---

## Key Features

### Fan Hub
- **AI-Powered Navigation** — Conversational wayfinding to any seat, facility, or gate using A* pathfinding and real-time crowd awareness
- **Crowd-Intelligent Routing** — Routes automatically avoid congestion hotspots; crowd density updates every 30 seconds
- **Accessibility-First** — Step-free routing for wheelchair users, sensory room locations, companion care facilities
- **Multilingual** — Responds natively in 10+ languages via Claude AI (no hardcoded translations)
- **Transport Planning** — Arriving or departing: live transit options, parking, accessible drop-off per venue

### Operations Center
- **Real-Time Crowd Heatmap** — SVG schematic updated live with congestion index per zone
- **AI Ops Advisor** — Claude analyzes crowd patterns and generates prioritized, actionable recommendations
- **Automated Alert Engine** — Detects hotspots, gate queues, medical needs; generates recommended actions
- **Sustainability Dashboard** — Live recycling rate, carbon per fan, renewable energy %, composite score
- **Staff Coordination** — Deployment status overview with zone-level visibility

### GenAI Architecture
- Claude claude-sonnet-4-6 with **6 structured tools** (venue info, route finding, facility lookup, crowd status, transport, sustainability)
- **Multi-turn tool use** — Claude chains multiple tool calls in a single conversational turn when needed
- **Streaming SSE** — Responses stream token-by-token for immediate user feedback
- Role-specific system prompts: Fan / Staff / Volunteer / Media

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
| Language | TypeScript (strict) |
| AI | Anthropic Claude claude-sonnet-4-6 — tool use + streaming |
| Pathfinding | A\* algorithm with venue coordinate system |
| Crowd Model | Continuous sigmoid flow model (pre-match, halftime, post-match phases) |
| Styling | Tailwind CSS (dark theme) |
| Icons | Lucide React |
| Deployment | Vercel / any Node.js host |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Anthropic API key — [get one at console.anthropic.com](https://console.anthropic.com)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd beyond90-ai
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local: add your ANTHROPIC_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
ANTHROPIC_API_KEY=your_api_key_here   # Required
CLAUDE_MODEL=claude-sonnet-4-6        # Optional override
```

---

## Architecture

```
beyond90-ai/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── fan/page.tsx             # Fan Hub (streaming chat)
│   ├── ops/page.tsx             # Operations Center dashboard
│   └── api/
│       ├── assist/route.ts      # Streaming AI endpoint (SSE)
│       ├── crowd/route.ts       # Crowd intelligence API
│       ├── ops/route.ts         # Ops snapshot + AI advisor
│       └── venues/route.ts      # Venue data API
├── lib/
│   ├── ai/
│   │   ├── client.ts            # Anthropic streaming client
│   │   ├── tools.ts             # Claude tool definitions
│   │   ├── tool-handlers.ts     # Tool execution logic
│   │   └── prompts.ts           # Role-based system prompts
│   ├── venues/
│   │   ├── data.ts              # All 8 WC2026 venue graphs
│   │   ├── graph.ts             # A* pathfinding engine
│   │   └── crowd.ts             # Crowd flow model
│   └── types.ts                 # Shared TypeScript types
└── components/
    ├── fan/MessageBubble.tsx
    └── shared/
        ├── VenueSelector.tsx
        └── CrowdBadge.tsx
```

### How Claude Uses Tools

When a fan asks *"Where's the nearest accessible restroom from Gate C?"*, Claude:
1. Calls `find_nearest_facility` → locates the closest ADA restroom node
2. Calls `find_route` → computes the A* step-free path
3. Calls `get_crowd_status` → checks congestion on the route
4. Responds with turn-by-turn directions, crowd conditions, and estimated walk time

All streaming — the fan sees the response build in real time.

---

## Crowd Intelligence Model

Unlike simple time-tier rules, Beyond90 uses a **continuous sigmoid flow model**:

- `occupancy(t)` driven by entry inflow rate + exit outflow rate
- Node classification: gate, concourse, concession, restroom, seating, exit
- Match lifecycle phases: pre-match surge (120→0 min), halftime spike (45+1=46), post-match egress
- **Congestion Index** (0–100): composite of occupancy ratio, inflow vs. capacity, and trend

Crowd data refreshes every 30 seconds on the ops dashboard.

---

## Sustainability

Beyond90 tracks green matchday performance per venue:
- Carbon kg per fan (transport + energy)
- Recycling rate (target: 80%+)
- Renewable energy percentage
- Public transport mode share
- Composite sustainability score (0–100, graded A–F)

The AI advisor suggests specific, actionable tips to fans (e.g., free water refill locations to avoid single-use plastic).

---

Built for FIFA World Cup 2026 · Powered by [Claude AI](https://anthropic.com)
