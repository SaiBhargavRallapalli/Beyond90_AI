import { GEMINI_FUNCTION_DECLARATIONS } from '@/lib/ai/tools';
import { handleToolCall } from '@/lib/ai/tool-handlers';
import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Gemini content types
// ---------------------------------------------------------------------------
interface GeminiPart {
  text?: string;
  thought?: boolean;          // true on internal thinking parts (Gemini 2.5+)
  thoughtSignature?: string;  // must be echoed back verbatim in history
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: string } };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

// ---------------------------------------------------------------------------
// Build request body matching the curl format exactly
// ---------------------------------------------------------------------------
function buildRequestBody(
  systemPrompt: string,
  contents: GeminiContent[],
  withTools: boolean
) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    ...(withTools
      ? { tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }] }
      : {}),
    generationConfig: { maxOutputTokens: 1024 },
  };
}

// ---------------------------------------------------------------------------
// Convert app ChatMessage history → Gemini contents array
// ---------------------------------------------------------------------------
function historyToContents(history: ChatMessage[], userMessage: string): GeminiContent[] {
  const contents: GeminiContent[] = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

// ---------------------------------------------------------------------------
// Non-streaming Gemini call (ops dashboard analysis)
// ---------------------------------------------------------------------------
async function callGemini(
  systemPrompt: string,
  contents: GeminiContent[],
  withTools = false
): Promise<GeminiResponse> {
  const url = `${GEMINI_BASE}/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': process.env.GEMINI_API_KEY ?? '',
    },
    body: JSON.stringify(buildRequestBody(systemPrompt, contents, withTools)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<GeminiResponse>;
}

// ---------------------------------------------------------------------------
// Streaming Gemini call — yields SSE text chunks
// Handles multi-turn function calling transparently.
// ---------------------------------------------------------------------------
export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const venue = VENUES[session.venueId];
  const systemPrompt = buildSystemPrompt(session.role, venue.venueName, session.language);
  const contents = historyToContents(history, message);
  const toolsUsed = new Set<string>();

  try {
    while (true) {
      const url = `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        },
        body: JSON.stringify(buildRequestBody(systemPrompt, contents, true)),
      });

      if (!res.ok) {
        const errText = await res.text();
        yield `\n\nI'm sorry, there was a service error (${res.status}). Please try again.`;
        console.error('Gemini stream error:', errText);
        break;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Accumulated for multi-turn: function calls from this turn
      const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      // Accumulated model content parts for appending to conversation
      const modelParts: GeminiPart[] = [];
      let turnEnded = false;

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

          const candidate = chunk.candidates?.[0];
          if (!candidate) continue;

          if (candidate.finishReason) turnEnded = true;

          const parts = candidate.content?.parts ?? [];
          for (const part of parts) {
            if (part.thought) {
              // Internal thinking part (Gemini 2.5+): capture with thoughtSignature
              // but never yield to the user. Must be echoed verbatim in history.
              modelParts.push(part);
            } else if (part.text) {
              yield part.text;
              modelParts.push({ text: part.text });
            } else if (part.functionCall) {
              functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args,
              });
              modelParts.push({ functionCall: part.functionCall });
            }
          }
        }
      }

      if (functionCalls.length === 0) break;

      // Append the model turn with function calls
      contents.push({ role: 'model', parts: modelParts });

      // Execute each function call and build the user turn with responses
      const responseParts: GeminiPart[] = [];
      for (const fc of functionCalls) {
        toolsUsed.add(fc.name);
        const result = await handleToolCall(fc.name, fc.args);
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: { content: result },
          },
        });
      }

      contents.push({ role: 'user', parts: responseParts });

      void turnEnded;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield `\n\nSorry, I encountered a problem: ${msg}. Please try again.`;
  }

  yield `\n\n[METADATA]${JSON.stringify({ toolsUsed: Array.from(toolsUsed) })}`;
}

// ---------------------------------------------------------------------------
// Non-streaming ops analysis
// ---------------------------------------------------------------------------
export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  const systemPrompt = buildOpsPrompt(venueName, minutesToKickoff, activeAlerts);

  const response = await callGemini(
    systemPrompt,
    [{ role: 'user', parts: [{ text: query }] }],
    false
  );

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text)
    .map((p) => p.text)
    .join('');

  return text ?? 'Unable to generate operational analysis at this time.';
}
