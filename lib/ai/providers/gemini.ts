import { GEMINI_FUNCTION_DECLARATIONS } from '@/lib/ai/tools';
import { handleToolCall } from '@/lib/ai/tool-handlers';
import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Match whatever the user's API key is provisioned for.
// gemini-flash-latest is the alias that resolves to the newest Flash model.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

// ---------------------------------------------------------------------------
// Gemini types
// The raw JSON response may carry additional fields (e.g. thoughtSignature)
// beyond what we explicitly name. We use unknown-index escape so TypeScript
// does not strip those fields when we echo parts back in conversation history.
// ---------------------------------------------------------------------------
interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string; // present on text/functionCall parts in thinking models
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: string } };
  [key: string]: unknown;   // preserve any undocumented fields verbatim
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: GeminiContent;
    finishReason?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildBody(
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

function historyToContents(history: ChatMessage[], userMessage: string): GeminiContent[] {
  const contents: GeminiContent[] = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-goog-api-key': process.env.GEMINI_API_KEY ?? '',
  };
}

// ---------------------------------------------------------------------------
// Non-streaming generateContent
//
// Used for every turn in the agentic loop. The non-streaming endpoint returns
// the COMPLETE response in one JSON object, meaning thoughtSignature (which
// gemini-flash-latest / gemini-3.5-flash embeds directly on text and
// functionCall parts) is never split across chunks. We echo the raw part
// objects verbatim into the conversation history, so the next turn always
// has intact signatures.
// ---------------------------------------------------------------------------
async function callGemini(
  systemPrompt: string,
  contents: GeminiContent[],
  withTools: boolean
): Promise<GeminiResponse> {
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(buildBody(systemPrompt, contents, withTools)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  return res.json() as Promise<GeminiResponse>;
}

// ---------------------------------------------------------------------------
// Streaming assistant response
//
// All turns use non-streaming generateContent to avoid the thoughtSignature
// reassembly problem with SSE chunks. The final text is yielded directly
// from the response — no second streaming call needed.
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
      const response = await callGemini(systemPrompt, contents, true);
      // Use the raw parsed parts — this preserves thoughtSignature and any
      // other fields Gemini returns without us having to name them all.
      const parts: GeminiPart[] = response.candidates?.[0]?.content?.parts ?? [];

      const functionCallParts = parts.filter((p) => p.functionCall);

      if (functionCallParts.length === 0) {
        // No more function calls — yield all visible text parts and exit.
        for (const part of parts) {
          if (part.text && !part.thought) {
            yield part.text;
          }
        }
        break;
      }

      // Echo the model turn back with ALL raw parts so thoughtSignature
      // is present for the next request.
      contents.push({ role: 'model', parts });

      // Execute every function call and gather results.
      const responseParts: GeminiPart[] = [];
      for (const part of functionCallParts) {
        const { name, args } = part.functionCall!;
        toolsUsed.add(name);
        const result = await handleToolCall(name, args);
        responseParts.push({
          functionResponse: { name, response: { content: result } },
        });
      }

      contents.push({ role: 'user', parts: responseParts });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield `\n\nSorry, I ran into a problem: ${msg}. Please try again.`;
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
    ?.filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join('');

  return text ?? 'Unable to generate operational analysis at this time.';
}
