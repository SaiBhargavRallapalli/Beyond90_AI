import Anthropic from '@anthropic-ai/sdk';
import { STADIUM_TOOLS } from '@/lib/ai/tools';
import { handleToolCall } from '@/lib/ai/tool-handlers';
import { buildSystemPrompt, buildOpsPrompt } from '@/lib/ai/prompts';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const venue = VENUES[session.venueId];
  const systemPrompt = buildSystemPrompt(session.role, venue.venueName, session.language);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const toolsUsed = new Set<string>();

  try {
    while (true) {
      const toolUseMap = new Map<
        number,
        { id: string; name: string; inputJson: string }
      >();

      const stream = anthropic.messages.stream({
        model: MODEL,
        system: systemPrompt,
        tools: STADIUM_TOOLS,
        messages,
        max_tokens: 1024,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            toolUseMap.set(event.index, { id: block.id, name: block.name, inputJson: '' });
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield delta.text;
          } else if (delta.type === 'input_json_delta') {
            const tb = toolUseMap.get(event.index);
            if (tb) tb.inputJson += delta.partial_json;
          }
        }
      }

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason !== 'tool_use' || toolUseMap.size === 0) break;

      messages.push({ role: 'assistant', content: finalMessage.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tb of Array.from(toolUseMap.values())) {
        toolsUsed.add(tb.name);
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tb.inputJson || '{}') as Record<string, unknown>; } catch { /**/ }
        const result = await handleToolCall(tb.name, input);
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: result });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    yield `\n\nI'm sorry, I ran into a problem: ${msg}. Please try again.`;
  }

  yield `\n\n[METADATA]${JSON.stringify({ toolsUsed: Array.from(toolsUsed) })}`;
}

export async function getOpsAnalysis(
  venueName: string,
  minutesToKickoff: number,
  activeAlerts: number,
  query: string
): Promise<string> {
  const systemPrompt = buildOpsPrompt(venueName, minutesToKickoff, activeAlerts);
  const response = await anthropic.messages.create({
    model: MODEL,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
    max_tokens: 1024,
  });
  const textBlock = response.content.find((c) => c.type === 'text');
  return textBlock && textBlock.type === 'text'
    ? textBlock.text
    : 'Unable to generate operational analysis at this time.';
}
