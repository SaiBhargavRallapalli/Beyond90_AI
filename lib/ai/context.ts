/**
 * Venue context builder — injects live intelligence into Groq / Gemini prompts.
 *
 * Claude uses structured tool calls instead; this function is only invoked for
 * providers that don't support reliable function calling. It pre-computes the
 * crowd forecast locally and serialises the full venue graph (zones, facilities,
 * walking connections, hotspots) into a structured text block that the model
 * can reason over without any external calls.
 *
 * The returned string is appended to the system prompt, giving the model a
 * grounded, real-time snapshot that is accurate to the request's `minutesToKickoff`.
 */
import { VENUES } from '@/lib/venues/data';
import { generateCrowdForecast, getCrowdLevel } from '@/lib/venues/crowd';
import type { UserSession } from '@/lib/types';

/**
 * Build the live venue intelligence block for a user session.
 *
 * @param session - The active user session; `venueId`, `currentNodeId`, and
 *   `minutesToKickoff` are used to compute the crowd forecast and user location.
 * @returns A multi-line text block formatted for injection into a system prompt.
 */
export function buildVenueContext(session: UserSession): string {
  const venue = VENUES[session.venueId];
  const crowd = generateCrowdForecast(venue, session.minutesToKickoff);
  const crowdMap = new Map(crowd.snapshots.map((s) => [s.nodeId, s]));

  const userNode = venue.nodes.find((n) => n.id === session.currentNodeId);

  const zones = venue.nodes
    .map((n) => {
      const c = crowdMap.get(n.id);
      const lvl = c ? getCrowdLevel(c.occupancy) : 'low';
      const floor = ['ground', 'concourse', 'upper'][n.level] ?? String(n.level);
      return `  • ${n.name} [${n.id}] — ${floor} floor, crowd: ${lvl}${n.accessible ? ', step-free' : ''}`;
    })
    .join('\n');

  const facilities = venue.facilities
    .map((f) => {
      const node = venue.nodes.find((n) => n.id === f.nodeId);
      const label = f.type.replace(/_/g, ' ');
      return `  • ${label}: ${f.name} → ${node?.name ?? f.nodeId}${f.accessible ? ' [ADA]' : ''}${f.operatingHours ? ` (${f.operatingHours})` : ''}`;
    })
    .join('\n');

  const connections = venue.edges
    .map((e) => {
      const from = venue.nodes.find((n) => n.id === e.from)?.name ?? e.from;
      const to = venue.nodes.find((n) => n.id === e.to)?.name ?? e.to;
      const sf = e.stepFree ? ', step-free' : '';
      return `  • ${from} → ${to} via ${e.travel} (${e.distance}m${sf})`;
    })
    .join('\n');

  const hotspots =
    crowd.hotspots
      .map((id) => venue.nodes.find((n) => n.id === id)?.name ?? id)
      .slice(0, 5)
      .join(', ') || 'None';

  const calm =
    crowd.safeNodes
      .map((id) => venue.nodes.find((n) => n.id === id)?.name ?? id)
      .slice(0, 5)
      .join(', ') || 'Most areas';

  const timeCtx =
    session.minutesToKickoff > 0
      ? `${session.minutesToKickoff} min to kickoff`
      : `Match in progress (${Math.abs(session.minutesToKickoff)} min elapsed)`;

  return `=== LIVE VENUE INTELLIGENCE ===
Venue   : ${venue.venueName}, ${venue.city} (capacity ${venue.capacity.toLocaleString()})
Status  : ${timeCtx}
Fan at  : ${userNode?.name ?? session.currentNodeId}${session.ticketSection ? ` | Section ${session.ticketSection}` : ''}

ZONES & CURRENT CROWD:
${zones}

FACILITIES:
${facilities}

WALKING CONNECTIONS (1 metre ≈ 1.5 s at walking pace):
${connections}

CROWD HOTSPOTS (avoid if possible): ${hotspots}
LEAST BUSY RIGHT NOW               : ${calm}
================================
Answer using ONLY the data above. Never invent zones or facilities not listed.`;
}
