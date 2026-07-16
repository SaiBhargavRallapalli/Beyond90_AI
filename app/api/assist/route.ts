import { NextRequest } from 'next/server';
import { streamAssistResponse } from '@/lib/ai/client';
import { checkRateLimit } from '@/lib/rateLimit';
import type { UserSession, ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1';
  const rl = checkRateLimit(ip, 'ai');
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait before sending another message.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Window': '60',
        },
      }
    );
  }

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

  // ── Validate session fields ──────────────────────────────────────────────
  // No API key check here — client.ts falls back to MockLLM when no key is set
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
