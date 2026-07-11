import Anthropic from '@anthropic-ai/sdk';
import { STADIUM_TOOLS } from './tools';
import { handleToolCall } from './tool-handlers';
import { buildSystemPrompt, buildOpsPrompt } from './prompts';
import { VENUES } from '@/lib/venues/data';
import type { UserSession, ChatMessage } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// Streaming assistant response
// Yields text chunks to the caller, then a final [METADATA] JSON line.
// Handles multi-turn tool use transparently.
// ---------------------------------------------------------------------------
export async function* streamAssistResponse(
  session: UserSession,
  message: string,
  history: ChatMessage[]
): AsyncGenerator<string> {
  const venue = VENUES[session.venueId];
  const systemPrompt = buildSystemPrompt(
    session.role,
    venue.venueName,
    session.language
  );

  // Build initial message list from history (skip metadata-only fields).
  const messages: Anthropic.MessageParam[] = [
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const toolsUsed = new Set<string>();

  try {
    // Multi-turn tool-use loop: continue until Claude returns end_turn.
    while (true) {
      // Tracks tool_use content blocks while streaming.
      // Key = content block index (stable across events for the same block).
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

      // Consume the stream: yield text deltas, accumulate tool-use JSON.
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            toolUseMap.set(event.index, {
              id: block.id,
              name: block.name,
              inputJson: '',
            });
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield delta.text;
          } else if (delta.type === 'input_json_delta') {
            const tb = toolUseMap.get(event.index);
            if (tb) {
              tb.inputJson += delta.partial_json;
            }
          }
        }
      }

      // Retrieve the fully assembled message (accumulated internally by the SDK).
      const finalMessage = await stream.finalMessage();

      // If Claude is done, exit the loop.
      if (finalMessage.stop_reason !== 'tool_use' || toolUseMap.size === 0) {
        break;
      }

      // Append Claude's assistant turn (including tool_use content blocks).
      messages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      // Execute each tool call and collect results.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      const toolBlocks = Array.from(toolUseMap.values());
      for (const tb of toolBlocks) {
        toolsUsed.add(tb.name);

        let toolInput: Record<string, unknown> = {};
        try {
          toolInput = JSON.parse(tb.inputJson || '{}') as Record<
            string,
            unknown
          >;
        } catch {
          toolInput = {};
        }

        const result = await handleToolCall(tb.name, toolInput);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: result,
        });
      }

      // Append tool results as a user turn, then loop for the next response.
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown streaming error';
    yield `\n\nI'm sorry, I ran into a problem: ${errMsg}. Please try again.`;
  }

  // Emit metadata as a terminal sentinel line the client can parse.
  yield `\n\n[METADATA]${JSON.stringify({ toolsUsed: Array.from(toolsUsed) })}`;
}

// ---------------------------------------------------------------------------
// Non-streaming ops analysis (for the dashboard)
// ---------------------------------------------------------------------------
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
