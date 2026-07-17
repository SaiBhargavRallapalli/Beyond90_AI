import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { buildVenueContext } from '@/lib/ai/context';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';

// ---------------------------------------------------------------------------
// Groq uses the OpenAI-compatible chat completions API.
// No function calling, no thought signatures — just clean streaming.
// Venue intelligence is injected via the system prompt (context injection).
// ---------------------------------------------------------------------------

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ''}`,
  };
}

function historyToMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): GroqMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];
}

// ---------------------------------------------------------------------------
// Streaming call
// ---------------------------------------------------------------------------
async function* streamGroq(messages: GroqMessage[]): AsyncGenerator<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  if (!res.body) throw new Error('Groq streaming response returned no body.');
  const reader = res.body.getReader();
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

      let chunk: GroqChunk;
      try {
        chunk = JSON.parse(jsonStr) as GroqChunk;
      } catch {
        continue;
      }

      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

// ---------------------------------------------------------------------------
// Non-streaming call (ops analysis)
// ---------------------------------------------------------------------------
async function callGroq(messages: GroqMessage[]): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
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

  const messages = historyToMessages(systemPrompt, history, message);

  try {
    yield* streamGroq(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield `\n\nSorry, I ran into a problem: ${msg}. Please try again.`;
  }

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
    return await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return `Unable to generate analysis: ${msg}`;
  }
}
