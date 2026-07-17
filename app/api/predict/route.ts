/**
 * GET /api/predict
 *
 * Forward-looking crowd prediction engine.
 *
 * Given a venue and current match timing, returns crowd forecasts at T+0,
 * T+30, T+60, and T+90 minute intervals. Operations teams use these projections
 * to pre-position staff and open auxiliary exits before pressure peaks occur,
 * rather than reacting after congestion has already built.
 *
 * This endpoint is intentionally read-only and stateless — results are derived
 * entirely from the deterministic sigmoid flow model so they are safe to cache
 * for up to 5 minutes per `minutesToKickoff` value.
 *
 * Query params:
 *   venue_id           — required; one of the 8 WC2026 host venue IDs
 *   minutes_to_kickoff — required; current match timing (integer, may be negative)
 */

import { NextRequest, NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues/data';
import { generateCrowdForecast, getCrowdLevel } from '@/lib/venues/crowd';
import { resolveVenueId, badRequest, notFound } from '@/lib/utils/api';

export const runtime = 'nodejs';

/** Prediction horizon offsets relative to the current `minutesToKickoff`. */
const PREDICTION_OFFSETS = [0, 30, 60, 90] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const venueId = resolveVenueId(searchParams.get('venue_id'));
  if (!venueId) {
    return notFound(
      `"venue_id" is required and must be one of: ${Object.keys(VENUES).join(', ')}`
    );
  }

  const rawMinutes = searchParams.get('minutes_to_kickoff');
  if (rawMinutes === null) {
    return badRequest('"minutes_to_kickoff" is required.');
  }
  const currentMinutesToKickoff = parseInt(rawMinutes, 10);
  if (isNaN(currentMinutesToKickoff)) {
    return badRequest('"minutes_to_kickoff" must be a valid integer.');
  }

  const venue = VENUES[venueId];

  // Build a forecast snapshot at each horizon
  const horizons = PREDICTION_OFFSETS.map((offsetMinutes) => {
    // Subtract offset: T+30 means 30 minutes have elapsed since current point
    const mtk = currentMinutesToKickoff - offsetMinutes;
    const forecast = generateCrowdForecast(venue, mtk);

    const avgOccupancy =
      forecast.snapshots.reduce((sum, s) => sum + s.occupancy, 0) /
      Math.max(1, forecast.snapshots.length);

    return {
      offsetMinutes,
      minutesToKickoff: mtk,
      label:
        offsetMinutes === 0
          ? 'Now'
          : `T+${offsetMinutes}min`,
      hotspotCount: forecast.hotspots.length,
      safeNodeCount: forecast.safeNodes.length,
      overallOccupancyPercent: Math.round(avgOccupancy * 100),
      overallCrowdLevel: getCrowdLevel(avgOccupancy),
      topHotspots: forecast.hotspots.slice(0, 3).map((id) => ({
        nodeId: id,
        name: venue.nodes.find((n) => n.id === id)?.name ?? id,
        congestionIndex:
          forecast.snapshots.find((s) => s.nodeId === id)?.congestionIndex ?? 0,
      })),
    };
  });

  // Derive peak horizon (when overall occupancy is highest)
  const peakHorizon = horizons.reduce((a, b) =>
    b.overallOccupancyPercent > a.overallOccupancyPercent ? b : a
  );

  return NextResponse.json(
    {
      venueId,
      venueName: venue.venueName,
      currentMinutesToKickoff,
      generatedAt: new Date().toISOString(),
      horizons,
      recommendation: buildRecommendation(peakHorizon, horizons[0]),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    }
  );
}

function buildRecommendation(
  peak: (typeof PREDICTION_OFFSETS)[number] extends infer _T
    ? { label: string; overallOccupancyPercent: number; hotspotCount: number; offsetMinutes: number }
    : never,
  now: { overallOccupancyPercent: number; hotspotCount: number }
): string {
  if (peak.offsetMinutes === 0) {
    return `Crowd pressure is at its peak now (${now.overallOccupancyPercent}% overall). Pre-position egress staff at all main exits immediately.`;
  }
  return `Crowd pressure peaks in approximately ${peak.offsetMinutes} minutes (${peak.overallOccupancyPercent}% overall, ${peak.hotspotCount} hotspot${peak.hotspotCount !== 1 ? 's' : ''} projected). Staff deployment should begin within ${Math.max(5, peak.offsetMinutes - 10)} minutes to get ahead of the surge.`;
}
