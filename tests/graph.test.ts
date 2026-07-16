import { describe, it, expect } from 'vitest';
import { findRoute, buildAdjacency, nearestFacilityNode } from '@/lib/venues/graph';
import type { VenueGraph } from '@/lib/types';

// A simple linear graph: A --walk--> B --walk--> C
// Plus a step-free path: A --ramp--> B --elevator--> C
const GRAPH: VenueGraph = {
  venueId: 'metlife',
  venueName: 'Test Venue',
  city: 'Test City',
  country: 'USA',
  capacity: 50000,
  nodes: [
    { id: 'gate_a',   name: 'Gate A',    section: 'Entry',     level: 0, coords: { x: 0,   y: 0 },  accessible: true,  indoor: false },
    { id: 'conc_b',   name: 'Middle',    section: 'Concourse', level: 1, coords: { x: 50,  y: 0 },  accessible: true,  indoor: true  },
    { id: 'seat_c',   name: 'Section C', section: 'Seating',   level: 2, coords: { x: 100, y: 0 },  accessible: false, indoor: true  },
    { id: 'island_d', name: 'Island D',  section: 'Other',     level: 0, coords: { x: 50,  y: 50 }, accessible: true,  indoor: false },
  ],
  edges: [
    { from: 'gate_a', to: 'conc_b', travel: 'walk',     distance: 60,  stepFree: true,  capacity: 500, bidirectional: true },
    { from: 'conc_b', to: 'seat_c', travel: 'stairs',   distance: 40,  stepFree: false, capacity: 200, bidirectional: true },
    { from: 'gate_a', to: 'conc_b', travel: 'ramp',     distance: 80,  stepFree: true,  capacity: 300, bidirectional: true },
    { from: 'conc_b', to: 'seat_c', travel: 'elevator', distance: 50,  stepFree: true,  capacity:  15, bidirectional: true },
  ],
  facilities: [
    { id: 'wc_1', name: 'Accessible WC', type: 'accessible_restroom', nodeId: 'conc_b', description: 'ADA restroom', accessible: true,  capacity: 4 },
    { id: 'fd_1', name: 'Burger Stand',  type: 'food_court',          nodeId: 'seat_c', description: 'Quick serve',  accessible: false, capacity: 100 },
  ],
};

// Disconnected graph (no edges from 'isolated')
const DISCONNECTED_GRAPH: VenueGraph = {
  ...GRAPH,
  nodes: [
    ...GRAPH.nodes,
    { id: 'isolated', name: 'Isolated Room', section: 'Other', level: 0, coords: { x: 50, y: 99 }, accessible: true, indoor: false },
  ],
};

describe('buildAdjacency', () => {
  it('creates an entry for every node', () => {
    const adj = buildAdjacency(GRAPH);
    for (const node of GRAPH.nodes) {
      expect(adj.has(node.id)).toBe(true);
    }
  });

  it('bidirectional edges appear in both directions', () => {
    const adj = buildAdjacency(GRAPH);
    const fromA = adj.get('gate_a')!.map(e => e.targetId);
    const fromB = adj.get('conc_b')!.map(e => e.targetId);
    expect(fromA).toContain('conc_b');
    expect(fromB).toContain('gate_a');
  });
});

describe('findRoute — basic', () => {
  it('returns null for an unknown start node', () => {
    expect(findRoute(GRAPH, 'no_such_node', 'seat_c', { stepFreeOnly: false })).toBeNull();
  });

  it('returns null for an unknown goal node', () => {
    expect(findRoute(GRAPH, 'gate_a', 'no_such_node', { stepFreeOnly: false })).toBeNull();
  });

  it('returns zero-distance route when start equals goal', () => {
    const route = findRoute(GRAPH, 'gate_a', 'gate_a', { stepFreeOnly: false });
    expect(route).not.toBeNull();
    expect(route!.totalDistanceMeters).toBe(0);
    expect(route!.estimatedMinutes).toBe(0);
    expect(route!.segments).toHaveLength(0);
  });

  it('returns null when destination is unreachable', () => {
    const route = findRoute(DISCONNECTED_GRAPH, 'gate_a', 'isolated', { stepFreeOnly: false });
    expect(route).toBeNull();
  });

  it('finds a path between connected nodes', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    expect(route).not.toBeNull();
    expect(route!.segments.length).toBeGreaterThan(0);
    expect(route!.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('route starts from the correct node', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    expect(route!.segments[0].fromNodeId).toBe('gate_a');
  });

  it('route ends at the correct node', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    const last = route!.segments[route!.segments.length - 1];
    expect(last.toNodeId).toBe('seat_c');
  });

  it('estimated minutes is a positive integer', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    expect(route!.estimatedMinutes).toBeGreaterThan(0);
    expect(Number.isInteger(route!.estimatedMinutes)).toBe(true);
  });
});

describe('findRoute — step-free mode', () => {
  it('step-free route exists between accessible nodes', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: true });
    expect(route).not.toBeNull();
  });

  it('step-free route is marked accessibilityCompliant', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: true });
    expect(route!.accessibilityCompliant).toBe(true);
  });

  it('step-free route uses no stairs', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: true });
    for (const seg of route!.segments) {
      expect(seg.travel).not.toBe('stairs');
    }
  });

  it('all segments in step-free route have stepFree=true', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: true });
    for (const seg of route!.segments) {
      expect(seg.stepFree).toBe(true);
    }
  });
});

describe('findRoute — avoid nodes', () => {
  it('avoids the specified intermediate node', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', {
      stepFreeOnly: false,
      avoidNodes: ['conc_b'],
    });
    // conc_b is the only intermediate node; avoiding it makes seat_c unreachable
    expect(route).toBeNull();
  });
});

describe('findRoute — route properties', () => {
  it('crowdRisk is one of low | medium | high', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    expect(['low', 'medium', 'high']).toContain(route!.crowdRisk);
  });

  it('each segment has a non-empty instruction string', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    for (const seg of route!.segments) {
      expect(typeof seg.instruction).toBe('string');
      expect(seg.instruction.length).toBeGreaterThan(0);
    }
  });

  it('each segment has a positive estimatedSeconds', () => {
    const route = findRoute(GRAPH, 'gate_a', 'seat_c', { stepFreeOnly: false });
    for (const seg of route!.segments) {
      expect(seg.estimatedSeconds).toBeGreaterThan(0);
    }
  });
});

describe('nearestFacilityNode', () => {
  it('finds the nearest accessible restroom', () => {
    const result = nearestFacilityNode(GRAPH, 'gate_a', ['accessible_restroom'], true);
    expect(result).not.toBeNull();
    expect(result!.facility.type).toBe('accessible_restroom');
    expect(result!.facility.accessible).toBe(true);
  });

  it('returns null when no facility of requested type exists', () => {
    const result = nearestFacilityNode(GRAPH, 'gate_a', ['atm'], false);
    expect(result).toBeNull();
  });

  it('returns null when only inaccessible facilities exist and accessibleOnly=true', () => {
    const result = nearestFacilityNode(GRAPH, 'gate_a', ['food_court'], true);
    // food_court facility is accessible=false, so should return null
    expect(result).toBeNull();
  });

  it('distanceMeters is non-negative', () => {
    const result = nearestFacilityNode(GRAPH, 'gate_a', ['accessible_restroom'], false);
    expect(result!.distanceMeters).toBeGreaterThanOrEqual(0);
  });
});
