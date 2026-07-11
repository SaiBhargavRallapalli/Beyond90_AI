import type { UserSession, ChatMessage } from '@/lib/types';

// ---------------------------------------------------------------------------
// AI Provider factory
// Set AI_PROVIDER=gemini (default) or AI_PROVIDER=claude in your .env.local
// ---------------------------------------------------------------------------
const PROVIDER = (process.env.AI_PROVIDER ?? 'gemini') as 'gemini' | 'claude';

async function getProvider() {
  if (PROVIDER === 'claude') {
    return import('@/lib/ai/providers/claude');
  }
  return import('@/lib/ai/providers/gemini');
}

export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const provider = await getProvider();
  yield* provider.streamAssistResponse(session, message, history);
}

export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  const provider = await getProvider();
  return provider.getOpsAnalysis(venueName, minutesToKickoff, activeAlerts, query);
}
