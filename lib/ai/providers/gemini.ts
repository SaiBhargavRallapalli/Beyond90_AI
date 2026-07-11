import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { VENUES } from '@/lib/venues/data';
import { generateCrowdForecast, getCrowdLevel } from '@/lib/venues/crowd';
import type { UserSession, ChatMessage } from '@/lib/types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

// ---------------------------------------------------------------------------
// Gemini types (no function-calling involved)
// ---------------------------------------------------------------------------
interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{ content: GeminiContent; finishReason?: string }>;
}

// ---------------------------------------------------------------------------
// Context injection
//
// gemini-flash-latest (gemini-3.5-flash) is a thinking model that attaches
// thoughtSignature to every function-call response. Echoing those signatures
// correctly across multi-turn conversations is fragile. Instead we pre-compute
// all venue intelligence locally and inject it as structured context in the
// system prompt — one clean request, no function-call round trips, no
// thoughtSignature surface at all.
// ---------------------------------------------------------------------------
function buildVenueContext(session: UserSession): string {
  const venue = VENUES[session.venueId];
  const crowd = generateCrowdForecast(venue, session.minutesToKickoff);
  const crowdMap = new Map(crowd.snapshots.map((s) => [s.nodeId, s]));

  const userNode = venue.nodes.find((n) => n.id === session.currentNodeId);

  const zones = venue.nodes
    .map((n) => {
      const c = crowdMap.get(n.id);
      const lvl = c ? getCrowdLevel(c.occupancy) : 'low';
      const floor = ['ground', 'concourse', 'upper'][n.level] ?? n.level;
      return `  • ${n.name} [${n.id}] — ${floor} floor, crowd: ${lvl}${n.accessible ? ', step-free' : ''}`;
    })
    .join('\n');

  const facilities = venue.facilities
    .map((f) => {
      const node = venue.nodes.find((n) => n.id === f.nodeId);
      const label = f.type.replace(/_/g, ' ');
      return `  • ${label}: ${f.name} → ${node?.name ?? f.nodeId}${f.accessible ? ' [ADA]' : ''}${f.operatingHours ? ` (${f.operatingHours})` : ''}`;
    })
    .join('\n');

  const connections = venue.edges
    .map((e) => {
      const from = venue.nodes.find((n) => n.id === e.from)?.name ?? e.from;
      const to = venue.nodes.find((n) => n.id === e.to)?.name ?? e.to;
      const sf = e.stepFree ? ', step-free' : '';
      return `  • ${from} → ${to} via ${e.travel} (${e.distance}m${sf})`;
    })
    .join('\n');

  const hotspots = crowd.hotspots
    .map((id) => venue.nodes.find((n) => n.id === id)?.name ?? id)
    .slice(0, 5)
    .join(', ') || 'None';

  const calm = crowd.safeNodes
    .map((id) => venue.nodes.find((n) => n.id === id)?.name ?? id)
    .slice(0, 5)
    .join(', ') || 'Most areas';

  const timeCtx =
    session.minutesToKickoff > 0
      ? `${session.minutesToKickoff} min to kickoff`
      : `Match in progress (${Math.abs(session.minutesToKickoff)} min elapsed)`;

  return `
=== LIVE VENUE INTELLIGENCE ===
Venue   : ${venue.venueName}, ${venue.city} (capacity ${venue.capacity.toLocaleString()})
Status  : ${timeCtx}
Fan at  : ${userNode?.name ?? session.currentNodeId}${session.ticketSection ? ` | Section ${session.ticketSection}` : ''}

ZONES & CURRENT CROWD:
${zones}

FACILITIES:
${facilities}

WALKING CONNECTIONS (1 metre ≈ 1.5 s at walking pace):
${connections}

CROWD HOTSPOTS (avoid if possible): ${hotspots}
LEAST BUSY RIGHT NOW               : ${calm}
================================
Answer using ONLY the data above. Never invent zones or facilities not listed.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildBody(
  systemPrompt: string,
  contents: GeminiContent[]
) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 1024 },
  };
}

function historyToContents(history: ChatMessage[], userMessage: string): GeminiContent[] {
  const contents: GeminiContent[] = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-goog-api-key': process.env.GEMINI_API_KEY ?? '',
  };
}

// ---------------------------------------------------------------------------
// Streaming response (no tools → no thoughtSignature issues)
// ---------------------------------------------------------------------------
async function* streamGemini(
  systemPrompt: string,
  contents: GeminiContent[]
): AsyncGenerator<string> {
  const res = await fetch(
    `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(buildBody(systemPrompt, contents)),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let chunk: GeminiResponse;
      try {
        chunk = JSON.parse(jsonStr) as GeminiResponse;
      } catch {
        continue;
      }

      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) yield part.text;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Non-streaming call (ops analysis)
// ---------------------------------------------------------------------------
async function callGemini(
  systemPrompt: string,
  contents: GeminiContent[]
): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(buildBody(systemPrompt, contents)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = (await res.json()) as GeminiResponse;
  return (
    data.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      .map((p) => p.text)
      .join('') ?? ''
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const venue = VENUES[session.venueId];
  const basePrompt = buildSystemPrompt(session.role, venue.venueName, session.language);
  const venueContext = buildVenueContext(session);
  const systemPrompt = `${basePrompt}\n\n${venueContext}`;

  const contents = historyToContents(history, message);

  try {
    yield* streamGemini(systemPrompt, contents);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield `\n\nSorry, I ran into a problem: ${msg}. Please try again.`;
  }

  // Report venue_context as the "tool" used so the UI chip renders
  yield `\n\n[METADATA]${JSON.stringify({ toolsUsed: ['venue_context'] })}`;
}

export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  const systemPrompt = buildOpsPrompt(venueName, minutesToKickoff, activeAlerts);

  try {
    return await callGemini(systemPrompt, [
      { role: 'user', parts: [{ text: query }] },
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return `Unable to generate analysis: ${msg}`;
  }
}
