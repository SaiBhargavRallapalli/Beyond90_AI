/**
 * MockLLM provider — fully offline, zero API-key dependency.
 *
 * Used automatically when no API key is configured for the active provider.
 * Returns deterministic, contextually realistic responses that demonstrate
 * every platform capability: navigation, crowd status, facilities, transport,
 * sustainability, and ops analysis.
 *
 * Streaming is simulated at ~25 ms per chunk so the UI behaves identically
 * to a live provider response.
 */

import type { UserSession, ChatMessage } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  // Skip artificial delay in test environments so suites run instantly
  if (process.env.NODE_ENV === 'test') return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

/** Split text into word-sized chunks to simulate token streaming. */
function* tokenise(text: string): Generator<string> {
  const words = text.split(/(?<=\s)|(?=\s)/);
  for (const word of words) yield word;
}

// ---------------------------------------------------------------------------
// Response templates
// ---------------------------------------------------------------------------

interface MockTemplate {
  keywords: string[];
  response: string;
  toolsUsed: string[];
}

const FAN_TEMPLATES: MockTemplate[] = [
  {
    keywords: ['restroom', 'bathroom', 'toilet', 'wc', 'accessible restroom', 'ada'],
    response: `The nearest accessible restroom from your current location is the **ADA Restroom – West** (Lower Concourse West), approximately 80 m away — about a 2-minute walk.

**Step-by-step directions:**
1. Head west along the lower concourse (follow the blue wayfinding strip)
2. Pass the Main Food Court on your right
3. The accessible restroom is on your left before the West elevator bank

**Current crowd status:** Lower Concourse West is showing **moderate** occupancy (42%). No queue expected.

The facility has a companion care suite and emergency call button. An additional accessible restroom is available on the Upper East concourse via elevator if this one is occupied.`,
    toolsUsed: ['find_nearest_facility', 'find_route', 'get_crowd_status'],
  },
  {
    keywords: ['seat', 'section', 'find my seat', 'how do i get to'],
    response: `I can guide you to your section. Based on your current position at **Gate A (South Main Entry)**, here is the recommended route to the lower bowl seating areas:

**Route: Gate A → Lower Concourse South → Field Level**
1. Pass through Gate A turnstiles and continue straight (north) — 80 m
2. At the Lower Concourse South junction, follow signs for your section number
3. For sections 100–140 (lower bowl): take the field-level ramp — step-free, 55 m
4. For sections 200–240 (upper bowl): take the east elevator or escalator

**Estimated time:** 4–6 minutes from Gate A
**Crowd risk on this route:** Low — concourse is 38% occupied

Tip: The east elevator has a shorter queue than the escalator right now.`,
    toolsUsed: ['find_route', 'get_crowd_status', 'get_venue_info'],
  },
  {
    keywords: ['food', 'eat', 'drink', 'hungry', 'concession', 'beer', 'vendor'],
    response: `Here are the best food options near your location right now:

**🍔 Champions Food Hall** (Main Food Court – Lower Concourse South)
- 30 vendors including local NYC favourites
- Current wait: ~8 minutes • Occupancy: 54%
- Accessible entrance available
- Distance: 40 m from Lower Concourse South

**🌮 East Concession Stand** (Lower Concourse East)
- Quick-serve counter, shorter queue
- Current wait: ~3 minutes • Occupancy: 29%
- Distance: 155 m via concourse ring

**Crowd tip:** The East Concession Stand has significantly shorter queues right now. Ideal if you want to be back in your seat quickly.

Alcohol service ends at the 75th minute per venue policy.`,
    toolsUsed: ['find_nearest_facility', 'get_crowd_status'],
  },
  {
    keywords: ['transport', 'train', 'bus', 'shuttle', 'parking', 'uber', 'taxi', 'getting home', 'leave'],
    response: `**Post-match transport options from MetLife Stadium:**

**🚌 NJ Transit Shuttle** (Transit Hub – South Exterior, 120 m from Gate A)
- Direct service to Penn Station Manhattan
- Frequency: every 8 minutes post-match
- Current queue: ~18 minutes estimated wait
- Accessible coaches available — request at the dedicated boarding lane

**🚗 Rideshare (Uber / Lyft)**
- Designated pickup: Lot G (East Exterior), Gate C side
- Surge pricing expected for ~45 minutes post-match
- Tip: wait 20–30 minutes for surge to subside

**🅿️ Parking lots**
- Lots A–D open for 90 minutes post-match
- Expect 25–40 minute exit delays for central lots

**Recommendation:** NJ Transit is the fastest option tonight. The shuttle hub has additional service capacity deployed for the post-match crowd.`,
    toolsUsed: ['get_transport_info', 'get_crowd_status'],
  },
  {
    keywords: ['crowd', 'busy', 'congestion', 'wait', 'queue', 'packed'],
    response: `**Live crowd status — MetLife Stadium:**

| Zone | Occupancy | Congestion | Trend |
|---|---|---|---|
| Gate A (South Entry) | 72% | High | ↑ Rising |
| Lower Concourse South | 58% | Moderate | → Stable |
| Main Food Court | 61% | Moderate | → Stable |
| Lower Concourse East | 34% | Low | ↓ Falling |
| Upper Concourse West | 28% | Low | → Stable |

**Active hotspots:** Gate A and Gate C are showing elevated congestion (>70 congestion index) with kickoff 20 minutes away. Gate D (West) is the least congested entry point right now.

**Recommended action:** If you haven't entered yet, Gate D has the shortest queue — approximately 6 minutes to clear vs. 18 minutes at Gate A.`,
    toolsUsed: ['get_crowd_status', 'get_venue_info'],
  },
  {
    keywords: ['wheelchair', 'accessible', 'disability', 'mobility', 'step-free', 'elevator'],
    response: `Beyond90 AI provides full **step-free routing** throughout this venue.

**Accessible services available at MetLife Stadium:**

🛗 **Elevators** — East and West concourse, all levels
♿ **ADA Restroom** — Lower Concourse West (companion care available)
🏥 **First Aid** — Lower East Concourse (EMT staffed, AED on site)
🧠 **Sensory Room** — North Club Level (quiet zone, reduced lighting)
👨‍👩‍👧 **Family Room** — Lower South Concourse

All step-free routes avoid escalators and stairs entirely. Current elevator status: all operational.

If you need assistance at any point, ask me for the nearest staff assistance point and I'll route you directly.`,
    toolsUsed: ['find_nearest_facility', 'find_route', 'get_venue_info'],
  },
  {
    keywords: ['sustainability', 'green', 'recycle', 'environment', 'carbon', 'eco'],
    response: `**MetLife Stadium — Sustainability snapshot:**

♻️ **Recycling rate:** 71% (target: 80%) — recycling bins are colour-coded throughout all concourses
⚡ **Renewable energy:** 68% of today's match powered by solar and wind
💧 **Water:** Free refill stations at every concourse junction — no single-use plastic needed
🚌 **Green transport:** 64% of fans arriving by public transit today

**Your green tip:** The free water refill station closest to you is at the Lower Concourse South junction (40 m). Using it saves approximately 0.3 kg of plastic waste per fan.

Beyond90 tracks per-fan carbon footprint in real time. Today's estimate: 2.1 kg CO₂ per fan (vs. 3.4 kg average for comparable events).`,
    toolsUsed: ['get_sustainability_metrics', 'get_venue_info'],
  },
];

const DEFAULT_FAN_RESPONSE: MockTemplate = {
  keywords: [],
  response: `Welcome to **Beyond90 AI** — your intelligent matchday companion for FIFA World Cup 2026! ⚽

I can help you with:
- **Navigation** — "How do I get to Section 214?" or "Where's the nearest exit?"
- **Crowd status** — "Which gate has the shortest queue?"
- **Facilities** — "Find me the nearest accessible restroom"
- **Food & drink** — "What's open near me with the shortest wait?"
- **Transport** — "How do I get back to Manhattan after the match?"
- **Accessibility** — "Show me step-free routes only"
- **Sustainability** — "Where are the recycling stations?"

This is a **demo mode** response — connect an AI provider key (Groq, Gemini, or Claude) in your environment to enable live conversational AI.

What can I help you with today?`,
  toolsUsed: ['get_venue_info'],
};

const OPS_TEMPLATES: { keywords: string[]; response: (v: string, mtk: number, alerts: number) => string }[] = [
  {
    keywords: ['crowd', 'density', 'hotspot', 'congestion', 'flow'],
    response: (venue, mtk, alerts) =>
      `**Crowd Analysis — ${venue}** (T${mtk > 0 ? `-${mtk}` : `+${Math.abs(mtk)}`}min)

**Current state:** ${alerts} active alert${alerts !== 1 ? 's' : ''} tracked. ${mtk > 0 && mtk <= 30 ? 'Peak ingress phase — gate queues at maximum pressure.' : mtk > 0 ? 'Pre-match ingress building steadily.' : 'In-match phase — concourses moderately occupied.'}

**Priority actions:**
1. Deploy additional crowd management staff to any gate with congestion index >70
2. Activate PA system to redirect fans from hotspot zones to lower-density alternatives
3. Open all auxiliary gates and secondary concourse pathways if not already active
4. Coordinate with transport hub to manage inflow rate — request metered entry if needed

**Forecast:** Crowd pressure will ${mtk > 0 ? 'peak in the next 15 minutes' : 'ease as match progresses'}. Recommend pre-positioning egress staff at exit nodes now.`,
  },
  {
    keywords: ['evacuation', 'emergency', 'safety', 'incident'],
    response: (venue, _mtk, _alerts) =>
      `**Emergency Response Protocol — ${venue}**

⚠️ **Immediate steps (first 5 minutes):**
1. Activate venue PA with calm, clear evacuation instructions — avoid the word "emergency" initially
2. Deploy security to all gate exits — open ALL emergency egress routes immediately
3. Contact local emergency services (911) and venue incident command
4. Identify nearest first aid stations: Lower East Concourse (EMT), North Club Level (AED)

**Crowd management:**
- Direct fans to the widest exit routes first — avoid funnelling into single points
- Step-free egress: ramps via Lower South to Gate A and Gate D
- Estimated full evacuation time: 18–22 minutes at controlled pace

**Communication:**
- LED boards: switch to evacuation wayfinding mode
- Staff radios: switch to emergency channel 3
- Incident commander to confirm safe assembly point at NJ Transit Hub (south exterior)

This is a simulated response. Live AI analysis requires an active API key.`,
  },
  {
    keywords: ['sustainability', 'recycling', 'carbon', 'waste', 'energy', 'green'],
    response: (venue, _mtk, _alerts) =>
      `**Sustainability Report — ${venue}**

♻️ **Recycling:** Current rate 71% — 9 points below the 80% target
⚡ **Energy:** 68% renewable — solar panels + purchased wind credits
💧 **Water:** 3 refill station alerts — South Concourse stations at 78% capacity, dispatch collection crew
🚌 **Transport:** 64% green travel mode share today

**AI Recommendations:**
1. Dispatch waste management crew to South Concourse stations immediately (78% capacity)
2. Deploy 2 additional temporary bins near Main Food Court exits — peak concession period ongoing
3. Broadcast PA reminder: "Please use colour-coded recycling bins" during next announcement slot
4. Flag energy spike on HVAC Zone C — investigate and optimise setpoint

**Projected end-of-match score:** 73/100 (Grade C). To reach Grade B, recycling rate must reach 78%+ by final whistle.`,
  },
  {
    keywords: ['staff', 'deploy', 'resource', 'personnel', 'volunteer'],
    response: (venue, mtk, _alerts) =>
      `**Staff Deployment Recommendation — ${venue}**

Based on current crowd state and ${mtk > 0 ? `T-${mtk}min match timing` : 'in-match conditions'}:

**Immediate deployments needed:**
- Gate A: +3 crowd management (congestion index elevated)
- Main Food Court: +2 queue management (54% occupancy, single queue forming)
- ADA Restroom (West): confirm 1 dedicated accessibility staff on post
- Transit Hub: +4 egress coordinators pre-positioned for post-match surge

**Current staff utilisation:**
- Security: 87% deployed
- Ushers: 74% deployed
- Medics: 100% at stations (correct — do not redeploy)
- Cleaning: 61% deployed (increase to 75% ahead of halftime)

**Recommendation:** Brief all supervisors on the egress plan now. The next 15 minutes are the critical window for gate management.`,
  },
];

const DEFAULT_OPS_RESPONSE = (venue: string, mtk: number, alerts: number) =>
  `**AI Ops Advisor — ${venue}** | T${mtk > 0 ? `-${mtk}` : `+${Math.abs(mtk)}`}min | ${alerts} alert${alerts !== 1 ? 's' : ''}

Currently tracking all operational metrics. Key status:
- Crowd flow: within normal parameters for this match phase
- Active alerts: ${alerts} requiring attention
- All safety systems: operational
- Sustainability tracking: active

For specific analysis, ask about: crowd density, evacuation protocols, sustainability metrics, or staff deployment.

**Note:** This is a demo mode response. Connect Groq, Gemini, or Claude via environment variables for live AI analysis.`;

// ---------------------------------------------------------------------------
// Response selection
// ---------------------------------------------------------------------------

function selectFanResponse(message: string): MockTemplate {
  const lower = message.toLowerCase();
  for (const template of FAN_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) return template;
  }
  return DEFAULT_FAN_RESPONSE;
}

function selectOpsResponse(
  query: string,
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number
): string {
  const lower = query.toLowerCase();
  for (const template of OPS_TEMPLATES) {
    if (template.keywords.some((kw) => lower.includes(kw))) {
      return template.response(venueName, minutesToKickoff, activeAlerts);
    }
  }
  return DEFAULT_OPS_RESPONSE(venueName, minutesToKickoff, activeAlerts);
}

// ---------------------------------------------------------------------------
// Public API — matches the interface of groq.ts / gemini.ts / claude.ts
// ---------------------------------------------------------------------------

export async function* streamAssistResponse(
  _session: UserSession,
  message: string,
  _history: ChatMessage[]
): AsyncGenerator<string> {
  const template = selectFanResponse(message);

  // Simulate token-by-token streaming at ~25 ms per chunk
  for (const chunk of tokenise(template.response)) {
    yield chunk;
    await sleep(25);
  }

  yield `\n\n[METADATA]${JSON.stringify({
    toolsUsed: template.toolsUsed,
    mock: true,
  })}`;
}

export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  // Small artificial delay to feel realistic
  await sleep(400);
  return selectOpsResponse(query, venueName, minutesToKickoff, activeAlerts);
}
