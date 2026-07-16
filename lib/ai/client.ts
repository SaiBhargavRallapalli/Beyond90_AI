import type { UserSession, ChatMessage } from '@/lib/types';

// ---------------------------------------------------------------------------
// AI Provider factory
// AI_PROVIDER = 'groq' (default) | 'gemini' | 'claude'
//
// Falls back to the MockLLM provider automatically when no API key is set,
// so the platform works fully offline / without credentials configured.
// ---------------------------------------------------------------------------

const PROVIDER = (process.env.AI_PROVIDER ?? 'groq') as 'groq' | 'gemini' | 'claude';

const KEY_MAP: Record<string, string> = {
  groq:   'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
};

function hasApiKey(): boolean {
  const requiredKey = KEY_MAP[PROVIDER] ?? 'GROQ_API_KEY';
  const value = process.env[requiredKey] ?? '';
  // Treat placeholder values as missing
  return value.length > 0 && !value.startsWith('your_');
}

async function getProvider() {
  if (!hasApiKey()) {
    return import('@/lib/ai/providers/mock');
  }
  if (PROVIDER === 'claude')  return import('@/lib/ai/providers/claude');
  if (PROVIDER === 'gemini') return import('@/lib/ai/providers/gemini');
  return import('@/lib/ai/providers/groq');
}

/**
 * Stream a fan assistant response token-by-token from the active AI provider.
 *
 * Yields raw text chunks followed by a `[METADATA]{...}` sentinel containing
 * toolsUsed, provider, and model. Falls back to MockLLM when no API key is set.
 */
export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const provider = await getProvider();
  yield* provider.streamAssistResponse(session, message, history);
}

/**
 * Generate a structured operational analysis for a venue's current state.
 *
 * Returns a markdown-formatted string with prioritized recommendations.
 * Falls back to MockLLM when no API key is configured for the active provider.
 */
export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  const provider = await getProvider();
  return provider.getOpsAnalysis(venueName, minutesToKickoff, activeAlerts, query);
}
