import { NextRequest, NextResponse } from 'next/server';
import { getOpsAnalysis } from '@/lib/ai/client';
import { generateCrowdForecast } from '@/lib/venues/crowd';
import { VENUES } from '@/lib/venues/data';
import type { VenueId, OpsSnapshot, OperationalAlert, CrowdForecast } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/ops
// Accepts { venueId, minutesToKickoff, query } and returns an AI ops analysis.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: { venueId?: string; minutesToKickoff?: number; query?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body.' },
      { status: 400 }
    );
  }

  const { venueId, minutesToKickoff = 45, query } = body;

  if (!venueId || !(venueId in VENUES)) {
    return NextResponse.json(
      {
        error: `"venueId" is required and must be one of: ${Object.keys(VENUES).join(', ')}`,
      },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json(
      { error: '"query" is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  const venue = VENUES[venueId as VenueId];
  const forecast = generateCrowdForecast(venue, minutesToKickoff);
  const activeAlerts = forecast.hotspots.length + 2; // crowd alerts + baseline infra alerts

  try {
    const analysis = await getOpsAnalysis(
      venue.venueName,
      minutesToKickoff,
      activeAlerts,
      query.trim()
    );

    return NextResponse.json({
      venueId,
      venueName: venue.venueName,
      minutesToKickoff,
      activeAlerts,
      hotspotsCount: forecast.hotspots.length,
      hotspots: forecast.hotspots,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'AI analysis failed';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ops
// Returns the current OpsSnapshot for a venue (attendance, alerts, metrics).
// Query params: venue_id, minutes_to_kickoff
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venue_id') ?? 'metlife';
  const minutesToKickoff = parseInt(
    searchParams.get('minutes_to_kickoff') ?? '45',
    10
  );

  if (!(venueId in VENUES)) {
    return NextResponse.json(
      {
        error: `"venue_id" must be one of: ${Object.keys(VENUES).join(', ')}`,
      },
      { status: 404 }
    );
  }

  if (isNaN(minutesToKickoff)) {
    return NextResponse.json(
      { error: '"minutes_to_kickoff" must be a valid integer.' },
      { status: 400 }
    );
  }

  const venue = VENUES[venueId as VenueId];
  const forecast = generateCrowdForecast(venue, minutesToKickoff);

  // Estimate overall attendance from average occupancy across all nodes
  const avgOccupancy =
    forecast.snapshots.reduce((sum, s) => sum + s.occupancy, 0) /
    Math.max(1, forecast.snapshots.length);

  // Attendance = capacity × avg_occupancy, clamped to 98% max
  const totalAttendance = Math.min(
    Math.round(venue.capacity * Math.min(avgOccupancy, 0.98)),
    venue.capacity
  );
  const capacityPercent = Math.round((totalAttendance / venue.capacity) * 100);

  const alerts = buildAlerts(venueId as VenueId, forecast, minutesToKickoff);

  const snapshot: OpsSnapshot = {
    venueId: venue.venueId,
    timestamp: new Date().toISOString(),
    minutesToKickoff,
    totalAttendance,
    capacityPercent,
    activeAlerts: alerts.filter((a) => !a.acknowledged).length,
    staffDeployed: computeStaffDeployed(venue.capacity, capacityPercent, minutesToKickoff),
    sustainabilityScore: SUSTAINABILITY_SCORES[venueId as VenueId] ?? 72,
    alerts,
  };

  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Realistic static sustainability scores per venue (0–100). */
const SUSTAINABILITY_SCORES: Record<VenueId, number> = {
  metlife:          73,
  sofi:             94,
  attdallas:        68,
  levis:            88,
  hardrock:         62,
  mercedesbenz:     97,
  lincolnfinancial: 76,
  gillette:         71,
};

/** Estimate staff deployed based on attendance level and match phase. */
function computeStaffDeployed(
  capacity: number,
  capacityPercent: number,
  minutesToKickoff: number
): number {
  const base = Math.round(capacity * 0.012); // ~1.2% of capacity as baseline staff
  const demandMultiplier =
    minutesToKickoff > 0 && minutesToKickoff <= 30
      ? 1.3  // peak ingress
      : minutesToKickoff < -85
      ? 1.4  // peak egress
      : minutesToKickoff < -40 && minutesToKickoff > -56
      ? 1.2  // halftime
      : 1.0;
  const capacityFactor = 0.7 + (capacityPercent / 100) * 0.5;
  return Math.round(base * demandMultiplier * capacityFactor);
}

/** Generate a realistic set of operational alerts from crowd data + static rules. */
function buildAlerts(
  venueId: VenueId,
  forecast: CrowdForecast,
  minutesToKickoff: number
): OperationalAlert[] {
  const now = new Date();
  const alerts: OperationalAlert[] = [];

  // 1. Crowd hotspot alert (dynamic, from forecast)
  if (forecast.hotspots.length > 0) {
    const severity = forecast.hotspots.length >= 5 ? 'critical' : 'warning';
    alerts.push({
      id: `crowd_hotspot_${venueId}_${now.getTime()}`,
      severity,
      category: 'crowd',
      title: `${forecast.hotspots.length} Congestion Hotspot${forecast.hotspots.length > 1 ? 's' : ''} Detected`,
      description: `Elevated crowd density (congestion index >70) at: ${forecast.hotspots.slice(0, 3).join(', ')}${forecast.hotspots.length > 3 ? ` and ${forecast.hotspots.length - 3} more` : ''}.`,
      affectedNodes: forecast.hotspots,
      recommendedActions: [
        'Deploy additional crowd management staff to affected concourse zones immediately.',
        'Activate PA system announcements to redirect fans to less congested routes.',
        'Open all auxiliary gates and secondary concourse pathways.',
        'Coordinate with transport hub to manage inflow rate.',
      ],
      timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
      acknowledged: false,
      aiGenerated: true,
    });
  }

  // 2. Gate queue alert (near kickoff)
  if (minutesToKickoff > 0 && minutesToKickoff <= 30) {
    alerts.push({
      id: `gate_queue_${venueId}_${now.getTime()}`,
      severity: minutesToKickoff <= 15 ? 'critical' : 'warning',
      category: 'crowd',
      title: `Gate Queue Build-up — ${minutesToKickoff} Min to Kickoff`,
      description: `With kickoff in ${minutesToKickoff} minutes, gate queues are expected to peak. Estimated throughput gap: ~1,200 fans still to process.`,
      affectedNodes: ['gate_a', 'gate_b', 'gate_1', 'gate_2'],
      recommendedActions: [
        'Maximise all available turnstile lanes — open emergency lanes if needed.',
        'Deploy ushers to queue management positions at all main gates.',
        'Broadcast pre-match entertainment to keep queuing fans engaged.',
        minutesToKickoff <= 15
          ? 'CRITICAL: Alert operations director for potential delayed kickoff assessment.'
          : 'Continue monitoring — assess in 10 minutes.',
      ],
      timestamp: new Date(now.getTime() - 1 * 60000).toISOString(),
      acknowledged: false,
      aiGenerated: true,
    });
  }

  // 3. Sustainability / waste alert (static, realistic)
  alerts.push({
    id: `waste_capacity_${venueId}`,
    severity: 'info',
    category: 'sustainability',
    title: 'Waste Station Approaching Capacity',
    description:
      'Recycling stations in South Concourse are at 78% capacity. Waste collection required within the next 20 minutes to maintain separation rates.',
    affectedNodes: ['lower_south', 'conc_south', 'food_main', 'atrium'],
    recommendedActions: [
      'Dispatch waste management crew to South Concourse now.',
      'Deploy two additional temporary recycling bins near food court exits.',
      'Remind fans via PA to use segregated waste bins during next announcement.',
    ],
    timestamp: new Date(now.getTime() - 14 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: false,
  });

  // 4. Transport hub alert (static, realistic)
  alerts.push({
    id: `transport_queue_${venueId}`,
    severity: 'warning',
    category: 'transport',
    title: 'Transit Hub Queue Building',
    description:
      'Shuttle and rail hub showing queue build-up. Current estimated wait: 18 minutes. Additional service capacity may be required.',
    affectedNodes: ['transit_hub', 'metro_plaza', 'marta_hub', 'commuter_hub', 'vta_plaza'],
    recommendedActions: [
      'Contact transit operator to request additional vehicles or increased frequency.',
      'Display live wait time estimates on all LED information boards.',
      'Deploy volunteers to assist with orderly queuing and information.',
    ],
    timestamp: new Date(now.getTime() - 6 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: true,
  });

  // 5. Infrastructure alert (static, acknowledged, routine)
  alerts.push({
    id: `elevator_maint_${venueId}`,
    severity: 'info',
    category: 'infrastructure',
    title: 'Scheduled Elevator Maintenance – East Concourse',
    description:
      'East concourse elevator is scheduled for a routine 15-minute safety inspection during halftime. Accessible ramp route remains fully operational.',
    affectedNodes: ['lower_east', 'upper_east', 'conc_east', 'upper_e'],
    recommendedActions: [
      'Confirm accessible ramp route is staffed and clearly signposted.',
      'Brief nearby ushers to redirect wheelchair users to ramp access.',
      'Notify maintenance crew to begin inspection at the halftime whistle.',
    ],
    timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
    acknowledged: true,
    aiGenerated: false,
  });

  // Return at most 5 alerts, prioritised by severity (critical > warning > info)
  const priorityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    emergency: 0,
  };

  return alerts
    .sort((a, b) => (priorityOrder[a.severity] ?? 3) - (priorityOrder[b.severity] ?? 3))
    .slice(0, 5);
}
