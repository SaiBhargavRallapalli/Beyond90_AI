/**
 * Venue data integrity tests — verify that all 8 FIFA WC 2026 venue graphs
 * are internally consistent (nodes referenced by edges exist, facilities
 * reference valid nodes, capacities are realistic, etc.)
 */
import { describe, it, expect } from 'vitest';
import { VENUES } from '@/lib/venues/data';
import type { VenueId } from '@/lib/types';

const VENUE_IDS: VenueId[] = [
  'metlife', 'sofi', 'attdallas', 'levis',
  'hardrock', 'mercedesbenz', 'lincolnfinancial', 'gillette',
];

// ─── Top-level structure ──────────────────────────────────────────────────────

describe('VENUES registry', () => {
  it('contains exactly 8 venues', () => {
    expect(Object.keys(VENUES)).toHaveLength(8);
  });

  it.each(VENUE_IDS)('contains venue "%s"', (id) => {
    expect(VENUES[id]).toBeDefined();
  });

  it.each(VENUE_IDS)('venue "%s" venueId matches its registry key', (id) => {
    expect(VENUES[id].venueId).toBe(id);
  });

  it.each(VENUE_IDS)('venue "%s" has a non-empty venueName', (id) => {
    expect(typeof VENUES[id].venueName).toBe('string');
    expect(VENUES[id].venueName.length).toBeGreaterThan(0);
  });

  it.each(VENUE_IDS)('venue "%s" is in USA, Canada, or Mexico', (id) => {
    expect(['USA', 'Canada', 'Mexico']).toContain(VENUES[id].country);
  });
});

// ─── Capacity ─────────────────────────────────────────────────────────────────

describe('Venue capacities', () => {
  it.each(VENUE_IDS)('venue "%s" capacity is at least 50,000', (id) => {
    expect(VENUES[id].capacity).toBeGreaterThanOrEqual(50_000);
  });

  it.each(VENUE_IDS)('venue "%s" capacity does not exceed 110,000', (id) => {
    expect(VENUES[id].capacity).toBeLessThanOrEqual(110_000);
  });
});

// ─── Node integrity ───────────────────────────────────────────────────────────

describe('Venue nodes', () => {
  it.each(VENUE_IDS)('venue "%s" has at least 5 nodes', (id) => {
    expect(VENUES[id].nodes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(VENUE_IDS)('all node IDs within "%s" are unique', (id) => {
    const ids = VENUES[id].nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VENUE_IDS)('every node in "%s" has valid coordinates', (id) => {
    for (const node of VENUES[id].nodes) {
      expect(node.coords.x).toBeGreaterThanOrEqual(0);
      expect(node.coords.y).toBeGreaterThanOrEqual(0);
      expect(node.coords.x).toBeLessThanOrEqual(100);
      expect(node.coords.y).toBeLessThanOrEqual(100);
    }
  });

  it.each(VENUE_IDS)('every node in "%s" has a non-empty name', (id) => {
    for (const node of VENUES[id].nodes) {
      expect(typeof node.name).toBe('string');
      expect(node.name.length).toBeGreaterThan(0);
    }
  });

  it.each(VENUE_IDS)('every node in "%s" has a non-empty section', (id) => {
    for (const node of VENUES[id].nodes) {
      expect(typeof node.section).toBe('string');
      expect(node.section.length).toBeGreaterThan(0);
    }
  });
});

// ─── Edge integrity ───────────────────────────────────────────────────────────

describe('Venue edges', () => {
  it.each(VENUE_IDS)('venue "%s" has at least 5 edges', (id) => {
    expect(VENUES[id].edges.length).toBeGreaterThanOrEqual(5);
  });

  it.each(VENUE_IDS)('all edge "from" nodes in "%s" exist as graph nodes', (id) => {
    const nodeIds = new Set(VENUES[id].nodes.map(n => n.id));
    for (const edge of VENUES[id].edges) {
      expect(nodeIds.has(edge.from), `edge.from="${edge.from}" not found`).toBe(true);
    }
  });

  it.each(VENUE_IDS)('all edge "to" nodes in "%s" exist as graph nodes', (id) => {
    const nodeIds = new Set(VENUES[id].nodes.map(n => n.id));
    for (const edge of VENUES[id].edges) {
      expect(nodeIds.has(edge.to), `edge.to="${edge.to}" not found`).toBe(true);
    }
  });

  it.each(VENUE_IDS)('all edges in "%s" have positive distance', (id) => {
    for (const edge of VENUES[id].edges) {
      expect(edge.distance).toBeGreaterThan(0);
    }
  });

  it.each(VENUE_IDS)('all edge travel types in "%s" are valid', (id) => {
    const VALID_TRAVEL = ['walk', 'escalator', 'elevator', 'ramp', 'stairs'];
    for (const edge of VENUES[id].edges) {
      expect(VALID_TRAVEL).toContain(edge.travel);
    }
  });

  it.each(VENUE_IDS)('no edge in "%s" connects a node to itself', (id) => {
    for (const edge of VENUES[id].edges) {
      expect(edge.from).not.toBe(edge.to);
    }
  });
});

// ─── Facility integrity ───────────────────────────────────────────────────────

describe('Venue facilities', () => {
  it.each(VENUE_IDS)('venue "%s" has at least one facility', (id) => {
    expect(VENUES[id].facilities.length).toBeGreaterThan(0);
  });

  it.each(VENUE_IDS)('all facility nodeIds in "%s" reference existing nodes', (id) => {
    const nodeIds = new Set(VENUES[id].nodes.map(n => n.id));
    for (const fac of VENUES[id].facilities) {
      expect(nodeIds.has(fac.nodeId), `facility "${fac.id}" nodeId="${fac.nodeId}" not found`).toBe(true);
    }
  });

  it.each(VENUE_IDS)('all facility IDs within "%s" are unique', (id) => {
    const ids = VENUES[id].facilities.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VENUE_IDS)('every facility in "%s" has a non-empty name', (id) => {
    for (const fac of VENUES[id].facilities) {
      expect(typeof fac.name).toBe('string');
      expect(fac.name.length).toBeGreaterThan(0);
    }
  });

  it.each(VENUE_IDS)('venue "%s" has at least one accessible facility', (id) => {
    const hasAccessible = VENUES[id].facilities.some(f => f.accessible);
    expect(hasAccessible).toBe(true);
  });
});

// ─── Accessibility coverage ───────────────────────────────────────────────────

describe('Venue accessibility coverage', () => {
  it.each(VENUE_IDS)('venue "%s" has at least one accessible node', (id) => {
    const hasAccessible = VENUES[id].nodes.some(n => n.accessible);
    expect(hasAccessible).toBe(true);
  });

  it.each(VENUE_IDS)('venue "%s" has at least one step-free edge', (id) => {
    const hasStepFree = VENUES[id].edges.some(e => e.stepFree);
    expect(hasStepFree).toBe(true);
  });
});
