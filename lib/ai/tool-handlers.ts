import { VENUES } from '@/lib/venues/data';
import { findRoute, nearestFacilityNode } from '@/lib/venues/graph';
import { generateCrowdForecast, getCrowdLevel, crowdLevelColor } from '@/lib/venues/crowd';
import type { VenueId } from '@/lib/types';

export type ToolInput = Record<string, unknown>;

export async function handleToolCall(
  toolName: string,
  input: ToolInput
): Promise<string> {
  switch (toolName) {
    case 'get_venue_info':
      return handleGetVenueInfo(input);
    case 'find_route':
      return handleFindRoute(input);
    case 'find_nearest_facility':
      return handleFindNearestFacility(input);
    case 'get_crowd_status':
      return handleGetCrowdStatus(input);
    case 'get_transport_options':
      return handleGetTransportOptions(input);
    case 'get_sustainability_tip':
      return handleGetSustainabilityTip(input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---------------------------------------------------------------------------
// get_venue_info
// ---------------------------------------------------------------------------
function handleGetVenueInfo(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const venue = VENUES[venueId as VenueId];

  if (!venue) {
    return JSON.stringify({
      error: `Venue "${venueId}" not found. Valid IDs: ${Object.keys(VENUES).join(', ')}`,
    });
  }

  const facilityTypes = Array.from(new Set(venue.facilities.map((f) => f.type)));

  return JSON.stringify({
    venueId: venue.venueId,
    venueName: venue.venueName,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    nodes: venue.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      section: n.section,
      level: n.level,
      accessible: n.accessible,
    })),
    availableFacilityTypes: facilityTypes,
    totalFacilities: venue.facilities.length,
    totalNodes: venue.nodes.length,
    totalEdges: venue.edges.length,
  });
}

// ---------------------------------------------------------------------------
// find_route
// ---------------------------------------------------------------------------
function handleFindRoute(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const fromNode = input.from_node as string;
  const toNode = input.to_node as string;
  const stepFree = (input.step_free as boolean | undefined) ?? false;

  const venue = VENUES[venueId as VenueId];
  if (!venue) {
    return JSON.stringify({ error: `Venue "${venueId}" not found.` });
  }

  const route = findRoute(venue, fromNode, toNode, { stepFreeOnly: stepFree });

  if (!route) {
    const fallback = stepFree
      ? findRoute(venue, fromNode, toNode, { stepFreeOnly: false })
      : null;

    return JSON.stringify({
      error: stepFree
        ? 'No step-free route found between these locations. A standard route is available — would you like that instead?'
        : `No route found between "${fromNode}" and "${toNode}". Please check the node IDs.`,
      standardRouteAvailable: stepFree ? fallback !== null : false,
    });
  }

  // Overlay crowd risk per segment using a 45-minute-to-kickoff forecast
  const forecast = generateCrowdForecast(venue, 45);
  const hotspotSet = new Set(forecast.hotspots);

  const segments = route.segments.map((seg) => ({
    fromNodeId: seg.fromNodeId,
    fromName: seg.fromName,
    toNodeId: seg.toNodeId,
    toName: seg.toName,
    travelMode: seg.travel,
    stepFree: seg.stepFree,
    distanceMeters: seg.distanceMeters,
    estimatedSeconds: seg.estimatedSeconds,
    instruction: seg.instruction,
    landmark: seg.landmark,
    crowdRisk: hotspotSet.has(seg.toNodeId) ? 'high' : 'low',
  }));

  return JSON.stringify({
    found: true,
    fromNodeId: fromNode,
    toNodeId: toNode,
    stepFreeRequested: stepFree,
    accessibilityCompliant: route.accessibilityCompliant,
    totalDistanceMeters: route.totalDistanceMeters,
    estimatedMinutes: route.estimatedMinutes,
    overallCrowdRisk: route.crowdRisk,
    segments,
    summary: `${segments.length} step(s), ${route.totalDistanceMeters}m, ~${route.estimatedMinutes} min`,
  });
}

// ---------------------------------------------------------------------------
// find_nearest_facility
// ---------------------------------------------------------------------------
function handleFindNearestFacility(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const fromNode = input.from_node as string;
  const facilityType = input.facility_type as string;
  const accessibleOnly = (input.accessible_only as boolean | undefined) ?? false;

  const venue = VENUES[venueId as VenueId];
  if (!venue) {
    return JSON.stringify({ error: `Venue "${venueId}" not found.` });
  }

  const result = nearestFacilityNode(
    venue,
    fromNode,
    [facilityType],
    accessibleOnly
  );

  if (!result) {
    const anyResult = accessibleOnly
      ? nearestFacilityNode(venue, fromNode, [facilityType], false)
      : null;

    return JSON.stringify({
      found: false,
      facilityType,
      accessibleOnly,
      message: accessibleOnly
        ? `No accessible ${facilityType} found near "${fromNode}". ${
            anyResult
              ? `A non-accessible ${facilityType} is ${anyResult.distanceMeters}m away at ${anyResult.facility.name}.`
              : `No ${facilityType} of any kind found.`
          }`
        : `No ${facilityType} found in this venue.`,
    });
  }

  const walkSeconds = result.distanceMeters * 1.5;
  const walkMinutes = Math.max(1, Math.ceil(walkSeconds / 60));

  return JSON.stringify({
    found: true,
    facilityId: result.facility.id,
    facilityName: result.facility.name,
    facilityType: result.facility.type,
    description: result.facility.description,
    nodeId: result.nodeId,
    distanceMeters: Math.round(result.distanceMeters),
    estimatedWalkMinutes: walkMinutes,
    accessible: result.facility.accessible,
    capacity: result.facility.capacity,
    operatingHours: result.facility.operatingHours ?? 'During event',
    tip:
      walkMinutes <= 2
        ? 'Very close — just around the corner.'
        : walkMinutes <= 5
        ? 'A short walk away.'
        : `About a ${walkMinutes}-minute walk. Consider planning your trip during a quiet moment.`,
  });
}

// ---------------------------------------------------------------------------
// get_crowd_status
// ---------------------------------------------------------------------------
function handleGetCrowdStatus(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const minutesToKickoff = (input.minutes_to_kickoff as number) ?? 45;
  const nodeIds = input.node_ids as string[] | undefined;

  const venue = VENUES[venueId as VenueId];
  if (!venue) {
    return JSON.stringify({ error: `Venue "${venueId}" not found.` });
  }

  const forecast = generateCrowdForecast(venue, minutesToKickoff);
  const nodeNameMap = new Map(venue.nodes.map((n) => [n.id, n.name]));

  let snapshots = forecast.snapshots;
  if (nodeIds && nodeIds.length > 0) {
    const idSet = new Set(nodeIds);
    snapshots = snapshots.filter((s) => idSet.has(s.nodeId));
  }

  const avgOccupancy =
    snapshots.reduce((sum, s) => sum + s.occupancy, 0) /
    Math.max(1, snapshots.length);
  const overallLevel = getCrowdLevel(avgOccupancy);
  const overallColor = crowdLevelColor(overallLevel);

  const hotspots = forecast.hotspots.slice(0, 6).map((id) => {
    const snap = forecast.snapshots.find((s) => s.nodeId === id);
    const level = snap ? getCrowdLevel(snap.occupancy) : 'high';
    return {
      nodeId: id,
      name: nodeNameMap.get(id) ?? id,
      congestionIndex: snap?.congestionIndex ?? 0,
      occupancyPercent: snap ? Math.round(snap.occupancy * 100) : 0,
      trend: snap?.trend ?? 'stable',
      crowdLevel: level,
      color: crowdLevelColor(level),
    };
  });

  const calmZones = forecast.safeNodes.slice(0, 5).map((id) => ({
    nodeId: id,
    name: nodeNameMap.get(id) ?? id,
    occupancyPercent: Math.round(
      (forecast.snapshots.find((s) => s.nodeId === id)?.occupancy ?? 0) * 100
    ),
  }));

  let recommendation = '';
  const elapsed = Math.abs(minutesToKickoff);
  if (minutesToKickoff > 0 && minutesToKickoff <= 30) {
    recommendation = `Kickoff is in ${minutesToKickoff} minutes. Move to your seat now to avoid peak congestion at gates and concourses.`;
  } else if (minutesToKickoff > 30 && minutesToKickoff <= 60) {
    recommendation = `Move to your seat at least 30 minutes before kickoff. Peak entry congestion typically occurs 20–10 min before kickoff.`;
  } else if (minutesToKickoff > 60) {
    recommendation = `Plenty of time before kickoff. Concessions and restrooms are currently at lower demand.`;
  } else if (minutesToKickoff === 0) {
    recommendation =
      'Match is starting now. Concourse areas are clearing quickly as fans reach their seats.';
  } else if (elapsed >= 40 && elapsed <= 55) {
    recommendation =
      'Halftime rush underway. Concessions and restrooms are at peak demand — expect 10–15 minute waits. Consider waiting 5 minutes for queues to ease.';
  } else if (elapsed > 80) {
    recommendation =
      'Match nearing its end. Begin planning your exit route now to beat the post-match rush. Gate A express transit is fastest.';
  } else {
    recommendation =
      'Match in progress. Most concourse areas are calm. Ideal time for restrooms or concessions.';
  }

  return JSON.stringify({
    venueName: venue.venueName,
    venueId: venue.venueId,
    minutesToKickoff,
    overallCrowdLevel: overallLevel,
    overallColor,
    averageOccupancyPercent: Math.round(avgOccupancy * 100),
    hotspotsCount: forecast.hotspots.length,
    hotspots,
    calmZones,
    recommendation,
    generatedAt: forecast.generatedAt,
  });
}

// ---------------------------------------------------------------------------
// get_transport_options
// ---------------------------------------------------------------------------
function handleGetTransportOptions(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const direction = (input.direction as 'arriving' | 'departing') ?? 'arriving';
  const minutesToKickoff = input.minutes_to_kickoff as number | undefined;

  const venue = VENUES[venueId as VenueId];
  if (!venue) {
    return JSON.stringify({ error: `Venue "${venueId}" not found.` });
  }

  type TransitOption = {
    mode: string;
    route: string;
    fromLocation: string;
    toLocation: string;
    frequency: string;
    cost: string;
    duration: string;
    accessible: boolean;
    notes?: string;
  };

  type ParkingZone = {
    zone: string;
    cost: string;
    spacesApprox: number;
    accessible: boolean;
    advancePurchaseRequired: boolean;
  };

  type VenueTransport = {
    publicTransit: TransitOption[];
    parking: ParkingZone[];
    accessibleDropOff: string;
    nearestCityCenter: { city: string; distanceMiles: number; driveMinutes: number; transitMinutes: number };
    arrivingTips: string[];
    departingTips: string[];
    departingSpecialService?: string;
  };

  const transportData: Record<string, VenueTransport> = {
    metlife: {
      publicTransit: [
        {
          mode: 'Bus',
          route: 'NJ Transit Game-Day Express',
          fromLocation: 'Port Authority Bus Terminal, Midtown Manhattan',
          toLocation: 'Gate A Shuttle Hub',
          frequency: 'Every 15 min (pre-match); every 8 min (post-match)',
          cost: '$7.25 round-trip',
          duration: '45 min',
          accessible: true,
          notes: 'Buses board at 42nd St. / 8th Ave. Buy tickets via the NJ Transit app.',
        },
        {
          mode: 'Bus',
          route: 'NJ Transit 352 / 356',
          fromLocation: 'Secaucus Junction (transfer from NJ Transit rail)',
          toLocation: 'Gate A Shuttle Hub',
          frequency: 'Every 10 min',
          cost: '$4.25 one-way',
          duration: '25 min',
          accessible: true,
          notes: 'Best option from Penn Station. Take any NJ Transit rail to Secaucus, then bus 352.',
        },
      ],
      parking: [
        { zone: 'Blue Lot (Preferred – adjacent)', cost: '$40', spacesApprox: 3200, accessible: true, advancePurchaseRequired: true },
        { zone: 'Gold Lot (General)', cost: '$30', spacesApprox: 5000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Red Lot (Economy, 10-min walk)', cost: '$20', spacesApprox: 8000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate D West Entrance — dedicated ADA drop-off circle, level access to Gate D, 50m to main concourse.',
      nearestCityCenter: { city: 'Midtown Manhattan, NYC', distanceMiles: 8.4, driveMinutes: 20, transitMinutes: 45 },
      arrivingTips: [
        'Arrive 2.5+ hours before kickoff for the smoothest transit experience.',
        'Use contactless payment (tap card) on NJ Transit buses — no need to queue at ticket machines.',
        'Gate A has dedicated accessible entry lanes; ask any staff member for assistance.',
        `${minutesToKickoff !== undefined && minutesToKickoff <= 60 ? 'Warning: Express buses are filling up fast. Head to the shuttle hub now.' : 'The NJ Transit app shows real-time bus capacity — check before boarding.'}`,
      ],
      departingTips: [
        'Express buses depart from Gate A Shuttle Plaza every 8 minutes for 90 minutes after the final whistle.',
        'Exit via Gate A for fastest shuttle access; Gate D exits to Lots B/C — allow 30 min for lots to clear.',
        'NJ Transit app shows live bus tracking — join the queue early for the first departures.',
      ],
      departingSpecialService: 'Post-match: Special NJ Transit Express to Penn Station departs from Gate A South Plaza every 8 minutes, starting immediately after the final whistle.',
    },

    sofi: {
      publicTransit: [
        {
          mode: 'Rail',
          route: 'Metro K Line (Crenshaw/LAX Line)',
          fromLocation: '7th St/Metro Center, Downtown LA',
          toLocation: 'Inglewood Station / Metro Rail Plaza',
          frequency: 'Every 12 min (every 6 min on event days post-match)',
          cost: '$1.75 one-way (TAP card)',
          duration: '45 min from downtown LA',
          accessible: true,
          notes: 'Direct service; no transfers from Downtown LA. 90m walk from Inglewood Station to Gate 1.',
        },
        {
          mode: 'Shuttle',
          route: 'SoFi Express from LAX',
          fromLocation: 'LAX Transportation Center (Lot C shuttle stop)',
          toLocation: 'Gate 1 Metro Rail Plaza',
          frequency: 'Every 20 min on match days',
          cost: '$5.00 one-way',
          duration: '20 min',
          accessible: true,
          notes: 'Pre-purchase on the SoFi Stadium app. Very popular — book in advance.',
        },
      ],
      parking: [
        { zone: 'Lot A (Premium, adjacent to Gate 1)', cost: '$50', spacesApprox: 2800, accessible: true, advancePurchaseRequired: true },
        { zone: 'Lot C (General)', cost: '$25', spacesApprox: 8000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Lot H (Economy, 15-min walk)', cost: '$15', spacesApprox: 5000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate 1 South — ADA drop-off zone with level access directly into Gate 1. Rideshare ADA pickup is in Lot H North.',
      nearestCityCenter: { city: 'Downtown Los Angeles', distanceMiles: 13, driveMinutes: 25, transitMinutes: 45 },
      arrivingTips: [
        'Metro K Line is the best option — it eliminates all traffic delays on I-105.',
        'Use the TAP card (contactless) for fastest Metro boarding.',
        'SoFi Parking opens 4 hours before kickoff; lots fill by 90 min before.',
        'Facial recognition express gates at Gate 1 reduce entry time by up to 40%.',
      ],
      departingTips: [
        'Metro K Line runs every 6 minutes for 2 hours post-match — fastest exit by far.',
        'Rideshare pickup zone is Lot H (North) — 15 min walk; use the SoFi app for the live map.',
        'Driving exit: I-105 West/East typically clears within 45 min of the final whistle.',
      ],
      departingSpecialService: 'Post-match: Metro K Line frequency increases to every 6 minutes from Inglewood Station for 2 hours post-match.',
    },

    attdallas: {
      publicTransit: [
        {
          mode: 'Rail',
          route: 'Trinity Railway Express (TRE)',
          fromLocation: 'Union Station, Dallas / Fort Worth Central',
          toLocation: 'TRE Rail Connection Hub (South Exterior)',
          frequency: 'Event specials: every 30 min pre-match',
          cost: '$5.00 round-trip',
          duration: '40 min from Dallas Union Station',
          accessible: true,
          notes: 'Only rail option. Parking at TRE stations is free on weekends.',
        },
        {
          mode: 'Shuttle',
          route: 'AT&T Stadium Game-Day Shuttle',
          fromLocation: 'Arlington Convention Center',
          toLocation: 'Gate D',
          frequency: 'Every 15 min',
          cost: '$5.00 one-way',
          duration: '10 min',
          accessible: true,
        },
      ],
      parking: [
        { zone: 'Lot E (Closest to Gate A)', cost: '$45', spacesApprox: 3000, accessible: true, advancePurchaseRequired: true },
        { zone: 'Lots B–D (General)', cost: '$25–35', spacesApprox: 14000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Remote Lots (R1–R5) + Shuttle', cost: '$15', spacesApprox: 10000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate A East Main Entry — ADA drop-off bay on Jerry Jones Drive. Rideshare ADA drop-off also at Gate A.',
      nearestCityCenter: { city: 'Downtown Dallas', distanceMiles: 19, driveMinutes: 25, transitMinutes: 55 },
      arrivingTips: [
        'Most fans drive — plan for significant traffic on I-30 and SR-180 within 3 miles.',
        'Trinity Railway Express is the most stress-free option from Dallas or Fort Worth.',
        'Biometric entry (fingerprint) at Gate A significantly speeds up entry — enroll in the AT&T Stadium app.',
        'Arrive 2+ hours early if driving; parking lots are first-come, first-served.',
      ],
      departingTips: [
        'Exit via Gate B (West) for fastest access to I-30 West.',
        'TRE trains depart 15 min and 45 min after the final whistle from the south lot hub.',
        'Remote lot shuttles run continuously for 90 minutes post-match.',
      ],
    },

    levis: {
      publicTransit: [
        {
          mode: 'Light Rail',
          route: 'VTA Light Rail (Mountain View – Winchester)',
          fromLocation: 'San Jose Diridon Station',
          toLocation: 'VTA Light Rail Plaza (Gate D side)',
          frequency: 'Every 15 min (every 7 min event service)',
          cost: '$2.50 one-way (Clipper card)',
          duration: '30 min from Diridon',
          accessible: true,
          notes: 'All VTA rail cars are 100% electric. 3-min walk from VTA station to Gate D.',
        },
        {
          mode: 'Caltrain',
          route: 'Caltrain + VTA Shuttle',
          fromLocation: 'San Francisco 4th & King / Millbrae BART',
          toLocation: 'VTA Light Rail Plaza',
          frequency: 'Hourly (event extras added)',
          cost: '$12–18 depending on zone',
          duration: '60–75 min from SF',
          accessible: true,
        },
      ],
      parking: [
        { zone: "Lot A (Premier – Levi's Preferred)", cost: '$40', spacesApprox: 2500, accessible: true, advancePurchaseRequired: true },
        { zone: 'Lot B / C (General)', cost: '$25', spacesApprox: 10000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Remote Lot + Shuttle', cost: '$15', spacesApprox: 5000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate A South Entry — dedicated ADA drop-off on Tasman Drive; level access straight to Gate A.',
      nearestCityCenter: { city: 'Downtown San Jose', distanceMiles: 4.5, driveMinutes: 12, transitMinutes: 30 },
      arrivingTips: [
        'VTA Light Rail is the fastest, cheapest, and most sustainable option.',
        'Use the Clipper card for tap-on transit — no queue at ticket machines.',
        'EV charging available in Lot A (free, 2-hour session included with parking purchase).',
        'US-101 is heavily congested on match days — allow 30+ extra minutes if driving.',
      ],
      departingTips: [
        'VTA Light Rail departs immediately after the match — trains run every 7 min for 90 min post-whistle.',
        'Lots A/B clear fastest via Tasman Drive East exit.',
        'Rideshare pickup: Lot D South, marked with orange signs.',
      ],
    },

    hardrock: {
      publicTransit: [
        {
          mode: 'Shuttle',
          route: 'Dolphin ExpressBus from Aventura / Downtown Miami',
          fromLocation: 'Aventura Mall / Brickell City Centre',
          toLocation: 'Miami Gardens Fan Zone',
          frequency: 'Every 20 min',
          cost: '$8.00 round-trip',
          duration: '30 min from Brickell',
          accessible: true,
          notes: 'Pre-book on the Hard Rock Stadium app. Very popular — limited seats.',
        },
        {
          mode: 'Shuttle',
          route: 'Metrorail + Shuttle Connector',
          fromLocation: 'Palmetto Metrorail Station (park & ride)',
          toLocation: 'Gate 4',
          frequency: 'Every 30 min',
          cost: '$5.25 (Metrorail fare included)',
          duration: '40 min from Downtown Miami',
          accessible: true,
        },
      ],
      parking: [
        { zone: 'Lot 1 (VIP, Gate 1 adjacent)', cost: '$55', spacesApprox: 2000, accessible: true, advancePurchaseRequired: true },
        { zone: 'Smart Parking Hub (EV & general)', cost: '$30', spacesApprox: 6000, accessible: true, advancePurchaseRequired: false },
        { zone: 'Remote Lots + Shuttle', cost: '$15', spacesApprox: 8000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate 4 West — ADA drop-off on NW 199th Street. Rideshare ADA vehicles use the Gate 1 designated bay.',
      nearestCityCenter: { city: 'Downtown Miami (Brickell)', distanceMiles: 16, driveMinutes: 30, transitMinutes: 50 },
      arrivingTips: [
        'The ExpressBus from Aventura or Brickell is highly recommended — I-95 and Florida Turnpike are severely congested on match days.',
        'Smart Parking Hub has free EV charging for 2 hours — 50+ stations in the north section.',
        'Heat advisory: arrive early if attending daytime matches — the Shade Canopy Concourse is your friend.',
        'Gate 1 processes the highest volume; Gates 3/4 often have shorter queues.',
      ],
      departingTips: [
        'ExpressBus return service runs every 15 min for 90 min post-match from Miami Gardens Fan Zone.',
        'Smart Parking Hub North exits via NW 27th Avenue for fastest Florida Turnpike access.',
        'Rideshare: designated pickup at Lot 5 West — follow orange RIDESHARE signs.',
      ],
    },

    mercedesbenz: {
      publicTransit: [
        {
          mode: 'Rail',
          route: 'MARTA Red/Gold Line to Vine City or GWCC/CNN Center',
          fromLocation: 'Downtown Atlanta (Five Points Station)',
          toLocation: 'MARTA Rail Hub (Gate 3 side)',
          frequency: 'Every 10 min (every 7 min event service)',
          cost: '$2.50 one-way (Breeze card)',
          duration: '12 min from Five Points',
          accessible: true,
          notes: 'Mercedes-Benz Stadium is purpose-built next to MARTA. 5-min walk from Vine City Station.',
        },
        {
          mode: 'Rail',
          route: 'MARTA Blue/Green Line to GWCC/CNN Center',
          fromLocation: 'Hartsfield-Jackson Atlanta Airport',
          toLocation: 'MARTA Rail Hub',
          frequency: 'Every 10 min',
          cost: '$2.50 one-way',
          duration: '25 min from airport',
          accessible: true,
          notes: 'Direct from the airport — no car needed. Transfer at Five Points for Vine City.',
        },
      ],
      parking: [
        { zone: 'Deck 1 (Gate 1 attached)', cost: '$50', spacesApprox: 1800, accessible: true, advancePurchaseRequired: true },
        { zone: 'GWCC Lots (1–5 min walk)', cost: '$30', spacesApprox: 8000, accessible: false, advancePurchaseRequired: false },
        { zone: 'State Farm Arena Decks', cost: '$20', spacesApprox: 4000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate 3 South (main gate) — ADA drop-off lane on Martin Luther King Jr. Drive. Elevators at Gate 3 directly to all levels.',
      nearestCityCenter: { city: 'Downtown Atlanta', distanceMiles: 1.2, driveMinutes: 8, transitMinutes: 12 },
      arrivingTips: [
        'MARTA is the definitive choice — it stops 5 min from the gate. No parking headaches.',
        'Direct MARTA service from Hartsfield-Jackson Airport takes just 25 min.',
        'Breeze card tap-on at any MARTA station — no queuing for tickets.',
        "All 5 gates are open — Gate 3 (South) is the main entry and closest to MARTA's Vine City Station.",
      ],
      departingTips: [
        'MARTA trains run every 7 min post-match for 2 hours — no need to rush.',
        'Head to Vine City Station (south) for Red/Gold Line, or GWCC/CNN Center (west) for Blue/Green Line.',
        'For drivers: I-20 West and East both accessible from Spring Street SW — allow 25 min for lots to clear.',
      ],
      departingSpecialService: 'Post-match: MARTA event service runs trains every 7 minutes on all lines from Vine City and GWCC/CNN Center stations for 2 hours after the final whistle.',
    },

    lincolnfinancial: {
      publicTransit: [
        {
          mode: 'Subway',
          route: 'SEPTA Broad Street Line',
          fromLocation: 'City Hall Station / Suburban Station, Center City',
          toLocation: 'SEPTA Broad St Hub (Gate C side)',
          frequency: 'Every 6 min (event extras added)',
          cost: '$2.50 one-way (SEPTA Key card)',
          duration: '20 min from Center City',
          accessible: true,
          notes: 'Pattison Station is a 5-min walk to Gate C. The most popular option for fans.',
        },
        {
          mode: 'Bus',
          route: 'SEPTA Route 17 / 29',
          fromLocation: 'South Philadelphia',
          toLocation: 'Pattison Ave & Broad St',
          frequency: 'Every 15 min',
          cost: '$2.50',
          duration: '15–25 min',
          accessible: true,
        },
      ],
      parking: [
        { zone: 'Lot K (Gate B adjacent, premium)', cost: '$45', spacesApprox: 2500, accessible: true, advancePurchaseRequired: true },
        { zone: 'Blue / Orange Lots (General)', cost: '$25', spacesApprox: 10000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Remote Lots (Packer Ave) + Shuttle', cost: '$15', spacesApprox: 6000, accessible: false, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate B South Entry — ADA drop-off lane on Pattison Ave. Rideshare ADA pickup/dropoff at Gate B East circle.',
      nearestCityCenter: { city: 'Center City Philadelphia', distanceMiles: 3.5, driveMinutes: 12, transitMinutes: 20 },
      arrivingTips: [
        'Broad Street Line is the most popular option — fast, cheap, and no parking stress.',
        'Use the SEPTA Key card (tap-on) for fastest boarding. Available at all City Hall area stations.',
        'Tailgate Zone opens 3 hours before kickoff — arrive early for the full Philly experience.',
        'Gate D (East) typically has shorter queues than Gate B on high-attendance days.',
      ],
      departingTips: [
        'Broad Street Line runs continuously post-match; expect 15–20 min platform waits at Pattison.',
        'Driving exit: I-95 North on-ramp at Pattison Ave clears faster than I-76 (Schuylkill).',
        'Rideshare pickup: Orange Lot South on Packer Avenue — follow RIDESHARE signs.',
      ],
    },

    gillette: {
      publicTransit: [
        {
          mode: 'Commuter Rail',
          route: 'MBTA Providence/Stoughton Line',
          fromLocation: 'South Station, Boston / Back Bay',
          toLocation: 'Foxboro Station (Commuter Rail Hub)',
          frequency: 'Event specials: 6 trains pre-match, 6 post-match',
          cost: '$15.00 round-trip',
          duration: '50 min from South Station',
          accessible: true,
          notes: 'Train stop is directly adjacent to Gate A — 2-min walk. MBTA app for schedule and tickets.',
        },
        {
          mode: 'Shuttle',
          route: 'Patriot Place Link Shuttle',
          fromLocation: 'Wrentham Village Premium Outlets (park & ride)',
          toLocation: 'Gate D',
          frequency: 'Every 20 min',
          cost: '$5.00 round-trip',
          duration: '10 min',
          accessible: true,
        },
      ],
      parking: [
        { zone: 'Lot 1 (Gate A adjacent, premium)', cost: '$50', spacesApprox: 2000, accessible: true, advancePurchaseRequired: true },
        { zone: 'Lots 2–5 (General)', cost: '$25', spacesApprox: 16000, accessible: false, advancePurchaseRequired: false },
        { zone: 'Patriot Place Garage (adjacent)', cost: '$20', spacesApprox: 3500, accessible: true, advancePurchaseRequired: false },
      ],
      accessibleDropOff: 'Gate A South Main Entry — ADA drop-off circle directly adjacent to Gate A. Rideshare ADA vehicles use Gate A North circle.',
      nearestCityCenter: { city: 'Downtown Boston', distanceMiles: 28, driveMinutes: 40, transitMinutes: 55 },
      arrivingTips: [
        'MBTA Commuter Rail is by far the easiest option — the train stops steps from Gate A.',
        'Buy MBTA tickets in advance on the MBTA app to skip the station queues.',
        'Route 1 (US-1) and I-95 both get heavily congested — allow 90+ extra minutes if driving.',
        'Patriot Place Mall is open pre-match — great option to arrive early and grab food.',
      ],
      departingTips: [
        'MBTA trains depart Foxboro Station 15 min and 40 min after the final whistle.',
        'Lots 1/2 exit via Route 1 North fastest; Lots 3–5 use I-95 South access road.',
        'Rideshare pickup in Lot 7 East — can take 20–30 min for vehicle arrival post-match.',
      ],
      departingSpecialService: 'Post-match: MBTA runs 6 special trains from Foxboro Station in the 90 minutes after the final whistle, with the first departing within 15 minutes of the match ending.',
    },
  };

  const data = transportData[venueId];
  if (!data) {
    return JSON.stringify({ error: `No transport data available for venue "${venueId}".` });
  }

  const tips = direction === 'arriving' ? data.arrivingTips : data.departingTips;
  const urgencyNote =
    direction === 'arriving' && minutesToKickoff !== undefined && minutesToKickoff <= 45
      ? `IMPORTANT: Only ${minutesToKickoff} minutes to kickoff — head to the venue now.`
      : direction === 'departing'
      ? data.departingSpecialService ?? null
      : null;

  return JSON.stringify({
    venue: venue.venueName,
    direction,
    minutesToKickoff: minutesToKickoff ?? 'not specified',
    urgencyNote,
    publicTransit: data.publicTransit,
    parking: data.parking,
    accessibleDropOff: data.accessibleDropOff,
    nearestCityCenter: data.nearestCityCenter,
    tips,
  });
}

// ---------------------------------------------------------------------------
// get_sustainability_tip
// ---------------------------------------------------------------------------
function handleGetSustainabilityTip(input: ToolInput): string {
  const venueId = input.venue_id as string;
  const venue = VENUES[venueId as VenueId];

  if (!venue) {
    return JSON.stringify({ error: `Venue "${venueId}" not found.` });
  }

  type SustainabilityData = {
    recyclingRate: number;
    carbonKgPerFan: number;
    wasteKgTotal: number;
    waterLitersPerFan: number;
    renewableEnergyPercent: number;
    publicTransportPercent: number;
    grade: 'A' | 'B' | 'C' | 'D';
    tips: string[];
    initiatives: string[];
  };

  const sustainabilityByVenue: Record<string, SustainabilityData> = {
    metlife: {
      recyclingRate: 68,
      carbonKgPerFan: 9.2,
      wasteKgTotal: 31200,
      waterLitersPerFan: 2.4,
      renewableEnergyPercent: 78,
      publicTransportPercent: 38,
      grade: 'B',
      tips: [
        'Refill your water bottle at the free filtered stations in the South Concourse (Gate A side) — saves a plastic bottle that takes 450 years to decompose.',
        'Hop on the NJ Transit Game-Day Express bus from Penn Station instead of driving — each bus removes roughly 40 cars from the road and cuts your trip carbon footprint by 85%.',
        'Separate your rubbish at the clearly marked green recycling bins throughout the concourse — today\'s match will generate ~31 tonnes of waste, and every sorted item helps hit our 68% diversion goal.',
      ],
      initiatives: [
        'MetLife Stadium purchases 78% renewable energy credits for all match-day operations.',
        'Single-use plastics banned in all food service areas — all containers are compostable.',
        '32 dedicated recycling & composting stations placed throughout the venue.',
      ],
    },
    sofi: {
      recyclingRate: 81,
      carbonKgPerFan: 6.8,
      wasteKgTotal: 22600,
      waterLitersPerFan: 1.9,
      renewableEnergyPercent: 100,
      publicTransportPercent: 55,
      grade: 'A',
      tips: [
        'SoFi Stadium runs on 100% renewable energy today — share that fact and inspire others. Every watt powering the lights and screens comes from solar.',
        'Fill up at the free Hydration Station inside the InfinityScreen Food Court (8 eco-taps with chilled, filtered water) and skip the single-use plastic bottle.',
        'Rode the Metro K Line? You already made one of the most sustainable choices a fan can make today — rail is 94% cleaner than solo driving on California\'s grid.',
      ],
      initiatives: [
        'SoFi Stadium is 100% renewably powered via on-site solar and long-term renewable purchase agreements.',
        'Zero single-use plastic policy across all 40+ food vendors.',
        'KultureCity partnership extends to eco-volunteering programmes on match days.',
      ],
    },
    attdallas: {
      recyclingRate: 65,
      carbonKgPerFan: 10.1,
      wasteKgTotal: 34500,
      waterLitersPerFan: 2.6,
      renewableEnergyPercent: 72,
      publicTransportPercent: 22,
      grade: 'B',
      tips: [
        'Skip the drive and ride the Trinity Railway Express (TRE) from Dallas or Fort Worth — it saves 4.5 kg of CO₂ per fan compared to solo driving and eliminates parking stress.',
        'Bring a reusable cup to any concession stand — the Grand Atrium refill stations charge $1.00 less per refill and you avoid adding to the ~34 tonnes of match-day waste.',
        'Choose the plant-based options at the Grand Atrium Food Court — plant-forward meals generate up to 60% less carbon than beef items, keeping today\'s footprint lower.',
      ],
      initiatives: [
        'AT&T Stadium uses 72% renewable energy and is trialling a green hydrogen backup generator.',
        'Composting programme in partnership with Texas-based ZeroWaste Solutions.',
        '28 EV charging stations in parking lots B and D.',
      ],
    },
    levis: {
      recyclingRate: 77,
      carbonKgPerFan: 7.4,
      wasteKgTotal: 21800,
      waterLitersPerFan: 2.1,
      renewableEnergyPercent: 92,
      publicTransportPercent: 48,
      grade: 'A',
      tips: [
        'Plug your EV into one of the free charging stations in Lot A — part of our Silicon Valley Green Initiative, offering 2 hours of free Level 2 charging on match days.',
        'Refill for free at the SW Concourse Hydration Station (8 chilled taps) — Levi\'s Stadium has eliminated over 85,000 single-use bottles per season with this programme.',
        'VTA Light Rail runs on 100% electric power — if you took the train today, your travel emissions are near zero. Tell your friends how easy the ride from Diridon was.',
      ],
      initiatives: [
        "Levi's Stadium is 92% renewably powered, with on-site solar arrays covering the stadium roof.",
        'Zero food waste partnership: unsold food is donated to Second Harvest Food Bank of Silicon Valley.',
        'Stadium composting diverts 77% of match-day waste from landfill.',
      ],
    },
    hardrock: {
      recyclingRate: 62,
      carbonKgPerFan: 10.8,
      wasteKgTotal: 29800,
      waterLitersPerFan: 2.8,
      renewableEnergyPercent: 68,
      publicTransportPercent: 25,
      grade: 'C',
      tips: [
        'Used an electric vehicle today? Take advantage of the free 2-hour EV charging at the Smart Parking Hub (north section) — 50+ Level 2 stations are available.',
        'The Shade Canopy Concourse is naturally ventilated — no extra air-conditioning required in that zone, saving significant energy. Enjoy it instead of crowding the indoor areas.',
        'Choose Latin cuisine vendors on the Shade Deck — their local ingredient sourcing means roughly 30% less food-chain carbon per meal compared to nationally imported options.',
      ],
      initiatives: [
        'Hard Rock Stadium is installing a 5 MW rooftop solar array (completion: late 2026).',
        'Miami-Dade County recycling partnership targeting 62% diversion rate for FIFA matches.',
        'Smart Parking Hub includes 52 EV charging ports (Level 2 & DC fast charge).',
      ],
    },
    mercedesbenz: {
      recyclingRate: 84,
      carbonKgPerFan: 6.5,
      wasteKgTotal: 18900,
      waterLitersPerFan: 1.8,
      renewableEnergyPercent: 100,
      publicTransportPercent: 52,
      grade: 'A',
      tips: [
        'Mercedes-Benz Stadium runs on 100% renewable energy — every light, screen, and appliance is powered by solar. Take a moment to notice the 4,000 solar panels on the roof.',
        'Use the reusable cup programme at the Halo Ring Food Hall: buy any drink in a reusable cup and return it for a $1.50 deposit back — zero waste and money back in your pocket.',
        "MARTA brought you here? You're already part of the 52% of fans who arrived sustainably today. Give yourself a high five and enjoy the $5 food menu — the world's most affordable stadium pricing also means less packaging waste.",
      ],
      initiatives: [
        'Mercedes-Benz Stadium is LEED Platinum certified — the highest sustainability standard for a major sports venue.',
        '100% renewable energy via on-site solar (4,000+ panels) and offsite wind PPAs.',
        '$5 food & drink pricing reduces per-fan spending and is proven to cut food waste by 30%.',
      ],
    },
    lincolnfinancial: {
      recyclingRate: 71,
      carbonKgPerFan: 8.7,
      wasteKgTotal: 24600,
      waterLitersPerFan: 2.3,
      renewableEnergyPercent: 81,
      publicTransportPercent: 44,
      grade: 'B',
      tips: [
        'SEPTA Broad Street Line is faster than driving and costs just $2.50 — versus $40+ for parking. That\'s money for more Philly cheesesteak AND a greener footprint.',
        'Refill for free at the West Concourse water station (8 taps, clearly marked) — Lincoln Financial Field has eliminated over 120,000 plastic bottles annually with this programme.',
        'Choose the green-dot food vendors (look for the leaf icon) — they use 100% compostable packaging, keeping their waste out of landfill and supporting Philadelphia\'s impressive 71% match-day recycling rate.',
      ],
      initiatives: [
        'Lincoln Financial Field is 81% renewably powered, including a 11,000-panel solar array.',
        "Philadelphia's Stadium District participates in the city's Zero Waste initiative.",
        'All concessions now use compostable packaging across all vendors.',
      ],
    },
    gillette: {
      recyclingRate: 70,
      carbonKgPerFan: 9.5,
      wasteKgTotal: 26400,
      waterLitersPerFan: 2.5,
      renewableEnergyPercent: 75,
      publicTransportPercent: 30,
      grade: 'B',
      tips: [
        'The MBTA Commuter Rail stops literally steps from Gate A — if you\'re at the station, you\'re almost at your seat. Far easier than Route 1, and much lower carbon.',
        'Pick up a reusable cup from any West Concourse concession stand — the 6-tap free refill station means you pay once and hydrate all match. Gillette hands out free reusable cups on designated sustainability match days.',
        'Patriot Place restaurants (Gate D side) use composable packaging marked with a green dot — your post-match meal can be zero-landfill if you choose the right vendor.',
      ],
      initiatives: [
        'Gillette Stadium powers 75% of operations from renewable sources, including a 2 MW wind contract.',
        'Patriot Place sustainability programme composts food waste from all attached restaurants.',
        'Foxborough-area rideshare programme actively promoted to reduce single-occupancy car trips.',
      ],
    },
  };

  const data = sustainabilityByVenue[venueId];
  if (!data) {
    return JSON.stringify({ error: `No sustainability data for venue "${venueId}".` });
  }

  return JSON.stringify({
    venueName: venue.venueName,
    sustainabilityGrade: data.grade,
    metrics: {
      recyclingRatePercent: data.recyclingRate,
      carbonKgPerFan: data.carbonKgPerFan,
      estimatedTotalWasteKg: data.wasteKgTotal,
      waterLitersPerFan: data.waterLitersPerFan,
      renewableEnergyPercent: data.renewableEnergyPercent,
      publicTransportArrivalPercent: data.publicTransportPercent,
    },
    ecoTips: data.tips,
    venueInitiatives: data.initiatives,
    fanImpactNote: `Every fan who uses public transport today saves an average of ${(data.carbonKgPerFan * 0.85).toFixed(1)} kg of CO₂ compared to solo driving.`,
  });
}
