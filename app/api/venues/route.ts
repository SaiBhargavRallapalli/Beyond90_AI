import { NextResponse } from 'next/server';
import { VENUES } from '@/lib/venues/data';

export const runtime = 'nodejs';

export async function GET() {
  const venues = Object.values(VENUES).map((venue) => ({
    venueId: venue.venueId,
    venueName: venue.venueName,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    // Nodes list for location-selection UI: include id, name, level, accessible flag
    nodes: venue.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      section: n.section,
      level: n.level,
      accessible: n.accessible,
      indoor: n.indoor,
      coords: n.coords,
    })),
    // Facility summary for display in the UI
    facilitySummary: {
      total: venue.facilities.length,
      byType: venue.facilities.reduce<Record<string, number>>((acc, f) => {
        acc[f.type] = (acc[f.type] ?? 0) + 1;
        return acc;
      }, {}),
    },
  }));

  return NextResponse.json(
    { venues, count: venues.length },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    }
  );
}
