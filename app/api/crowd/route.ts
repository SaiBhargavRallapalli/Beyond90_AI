import { NextRequest, NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues/data';
import { generateCrowdForecast, getCrowdLevel, crowdLevelColor } from '@/lib/venues/crowd';
import type { VenueId } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venue_id');
  const minutesParam = searchParams.get('minutes_to_kickoff');

  // ── Validate venue_id ────────────────────────────────────────────────────
  if (!venueId) {
    return NextResponse.json(
      { error: 'Query param "venue_id" is required.' },
      { status: 400 }
    );
  }

  if (!(venueId in VENUES)) {
    return NextResponse.json(
      {
        error: `Venue "${venueId}" not found. Valid IDs: ${Object.keys(VENUES).join(', ')}`,
      },
      { status: 404 }
    );
  }

  // ── Parse minutes_to_kickoff (default 45 min before) ────────────────────
  const minutesToKickoff =
    minutesParam !== null ? parseInt(minutesParam, 10) : 45;

  if (isNaN(minutesToKickoff)) {
    return NextResponse.json(
      { error: '"minutes_to_kickoff" must be a valid integer.' },
      { status: 400 }
    );
  }

  // ── Generate forecast ────────────────────────────────────────────────────
  const venue = VENUES[venueId as VenueId];
  const forecast = generateCrowdForecast(venue, minutesToKickoff);
  const nodeNameMap = new Map(venue.nodes.map((n) => [n.id, n.name]));

  // Enrich snapshots with human-readable level and color
  const enrichedSnapshots = forecast.snapshots.map((snap) => {
    const level = getCrowdLevel(snap.occupancy);
    return {
      ...snap,
      nodeName: nodeNameMap.get(snap.nodeId) ?? snap.nodeId,
      crowdLevel: level,
      color: crowdLevelColor(level),
      occupancyPercent: Math.round(snap.occupancy * 100),
    };
  });

  // Enrich hotspot and safeNode lists with names
  const hotspotDetails = forecast.hotspots.map((id) => ({
    nodeId: id,
    name: nodeNameMap.get(id) ?? id,
    congestionIndex:
      forecast.snapshots.find((s) => s.nodeId === id)?.congestionIndex ?? 0,
  }));

  const safeNodeDetails = forecast.safeNodes.map((id) => ({
    nodeId: id,
    name: nodeNameMap.get(id) ?? id,
    occupancyPercent: Math.round(
      (forecast.snapshots.find((s) => s.nodeId === id)?.occupancy ?? 0) * 100
    ),
  }));

  return NextResponse.json(
    {
      ...forecast,
      snapshots: enrichedSnapshots,
      hotspotDetails,
      safeNodeDetails,
      venueName: venue.venueName,
      venueCapacity: venue.capacity,
    },
    {
      headers: {
        // Short TTL — crowd data is time-sensitive
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
