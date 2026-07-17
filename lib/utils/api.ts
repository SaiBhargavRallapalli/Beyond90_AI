/**
 * Shared utility helpers for Next.js API route handlers.
 *
 * Centralises cross-cutting concerns — IP extraction, rate limit responses —
 * so every route handler follows the same pattern without duplication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues/data';
import type { VenueId } from '@/lib/types';

/**
 * Extract the originating client IP from an incoming request.
 *
 * Checks `x-forwarded-for` first (set by proxies and load balancers such as
 * Cloud Run's front-end), then `x-real-ip`, and falls back to the loopback
 * address for local development where no proxy header is present.
 *
 * @returns A single IP string, never empty.
 */
export function extractClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

/**
 * Resolve a raw venue ID string to a typed `VenueId` after verifying it
 * exists in the venue registry.
 *
 * @param venueId - Raw string from query params or request body
 * @returns The typed `VenueId` if valid, or `null` if unknown / missing
 */
export function resolveVenueId(venueId: string | null | undefined): VenueId | null {
  if (!venueId || !(venueId in VENUES)) return null;
  return venueId as VenueId;
}

/**
 * Build a standard 400 response for validation failures.
 *
 * @param message - Human-readable error description
 */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Build a standard 404 response for unknown resources.
 *
 * @param message - Human-readable error description
 */
export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
