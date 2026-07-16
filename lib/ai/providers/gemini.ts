import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { buildVenueContext } from '@/lib/ai/context';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

interface GeminiPart { text?: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{ content: GeminiContent; finishReason?: string }>;
}

function buildBody(systemPrompt: string, contents: GeminiContent[]) {
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
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
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
      try { chunk = JSON.parse(jsonStr) as GeminiResponse; } catch { continue; }
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) yield part.text;
      }
    }
  }
}

async function callGemini(systemPrompt: string, contents: GeminiContent[]): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(buildBody(systemPrompt, contents)),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.filter((p) => p.text).map((p) => p.text).join('') ?? '';
}

export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const venue = VENUES[session.venueId];
  const systemPrompt = `${buildSystemPrompt(session.role, venue.venueName, session.language)}\n\n${buildVenueContext(session)}`;
  const contents = historyToContents(history, message);
  try {
    yield* streamGemini(systemPrompt, contents);
  } catch (err) {
    yield `\n\nSorry, I ran into a problem: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`;
  }
  yield `\n\n[METADATA]${JSON.stringify({ toolsUsed: ['venue_context'] })}`;
}

export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  try {
    return await callGemini(buildOpsPrompt(venueName, minutesToKickoff, activeAlerts), [
      { role: 'user', parts: [{ text: query }] },
    ]);
  } catch (err) {
    return `Unable to generate analysis: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}
