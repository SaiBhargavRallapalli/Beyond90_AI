import { NextRequest } from 'next/server';
import { streamAssistResponse } from '@/lib/ai/client';
import type { UserSession, ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────
  let body: { session?: UserSession; message?: string; history?: ChatMessage[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { session, message, history = [] } = body;

  // ── Validate API key ─────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Validate session fields ──────────────────────────────────────────────
  if (!session?.venueId || !session?.role || !session?.id) {
    return new Response(
      JSON.stringify({ error: 'Missing required session fields: venueId, role, id.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Message is required and must be a non-empty string.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Stream AI response ───────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamAssistResponse(
          session,
          message.trim(),
          history
        )) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : 'Unexpected streaming error.';
        controller.enqueue(
          encoder.encode(`\n\nError: ${errMsg}`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // prevents nginx proxy buffering
    },
  });
}
