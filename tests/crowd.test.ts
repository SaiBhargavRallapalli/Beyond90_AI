import { describe, it, expect } from 'vitest';
import {
  generateCrowdForecast,
  getCrowdLevel,
  crowdLevelColor,
  estimateWaitMinutes,
} from '@/lib/venues/crowd';
import type { VenueGraph } from '@/lib/types';

// Minimal synthetic graph for deterministic tests
const MOCK_GRAPH: VenueGraph = {
  venueId: 'metlife',
  venueName: 'MetLife Stadium',
  city: 'East Rutherford, NJ',
  country: 'USA',
  capacity: 82500,
  nodes: [
    { id: 'gate_a',      name: 'Gate A',          section: 'Entry',     level: 0, coords: { x: 0,  y: 93 }, accessible: true,  indoor: false },
    { id: 'conc_south',  name: 'South Concourse',  section: 'Concourse', level: 1, coords: { x: 50, y: 78 }, accessible: true,  indoor: true  },
    { id: 'food_main',   name: 'Main Food Court',  section: 'Food',      level: 1, coords: { x: 50, y: 65 }, accessible: true,  indoor: true  },
    { id: 'restroom_n',  name: 'North Restroom',   section: 'Restroom',  level: 1, coords: { x: 50, y: 22 }, accessible: true,  indoor: true  },
    { id: 'upper_west',  name: 'Upper West Seats', section: 'Seating',   level: 2, coords: { x: 17, y: 50 }, accessible: false, indoor: true  },
    { id: 'exit_main',   name: 'Main Exit',        section: 'Exit',      level: 0, coords: { x: 50, y: 98 }, accessible: true,  indoor: false },
  ],
  edges: [],
  facilities: [],
};

describe('generateCrowdForecast', () => {
  it('returns a snapshot for every node in the graph', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    expect(forecast.snapshots).toHaveLength(MOCK_GRAPH.nodes.length);
  });

  it('attaches correct venueId and minutesToKickoff', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 30);
    expect(forecast.venueId).toBe('metlife');
    expect(forecast.minutesToKickoff).toBe(30);
  });

  it('all occupancy values are clamped between 0 and 1', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    for (const snap of forecast.snapshots) {
      expect(snap.occupancy).toBeGreaterThanOrEqual(0);
      expect(snap.occupancy).toBeLessThanOrEqual(1);
    }
  });

  it('all congestionIndex values are between 0 and 100', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    for (const snap of forecast.snapshots) {
      expect(snap.congestionIndex).toBeGreaterThanOrEqual(0);
      expect(snap.congestionIndex).toBeLessThanOrEqual(100);
    }
  });

  it('inflow and outflow are non-negative integers', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    for (const snap of forecast.snapshots) {
      expect(snap.inflow).toBeGreaterThanOrEqual(0);
      expect(snap.outflow).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(snap.inflow)).toBe(true);
      expect(Number.isInteger(snap.outflow)).toBe(true);
    }
  });

  it('trend is one of rising | stable | falling', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    for (const snap of forecast.snapshots) {
      expect(['rising', 'stable', 'falling']).toContain(snap.trend);
    }
  });

  it('hotspots are a subset of snapshot nodeIds', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 20);
    const ids = new Set(forecast.snapshots.map(s => s.nodeId));
    for (const hs of forecast.hotspots) {
      expect(ids.has(hs)).toBe(true);
    }
  });

  it('safeNodes are a subset of snapshot nodeIds', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 120);
    const ids = new Set(forecast.snapshots.map(s => s.nodeId));
    for (const sn of forecast.safeNodes) {
      expect(ids.has(sn)).toBe(true);
    }
  });

  it('hotspots have congestionIndex > 70', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 20);
    const snapMap = new Map(forecast.snapshots.map(s => [s.nodeId, s]));
    for (const hs of forecast.hotspots) {
      expect(snapMap.get(hs)!.congestionIndex).toBeGreaterThan(70);
    }
  });

  it('safeNodes have occupancy < 0.40', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 180);
    const snapMap = new Map(forecast.snapshots.map(s => [s.nodeId, s]));
    for (const sn of forecast.safeNodes) {
      expect(snapMap.get(sn)!.occupancy).toBeLessThan(0.40);
    }
  });

  it('gate occupancy is low long before kickoff (>150 min)', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 180);
    const gate = forecast.snapshots.find(s => s.nodeId === 'gate_a')!;
    expect(gate.occupancy).toBeLessThan(0.10);
  });

  it('seating occupancy is near-full just before kickoff (mtk=0)', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 0);
    const seating = forecast.snapshots.find(s => s.nodeId === 'upper_west')!;
    expect(seating.occupancy).toBeGreaterThan(0.85);
  });

  it('generatedAt is a valid ISO timestamp', () => {
    const forecast = generateCrowdForecast(MOCK_GRAPH, 45);
    expect(() => new Date(forecast.generatedAt)).not.toThrow();
    expect(new Date(forecast.generatedAt).getTime()).toBeGreaterThan(0);
  });
});

describe('getCrowdLevel', () => {
  it('returns low for occupancy below 0.40', () => {
    expect(getCrowdLevel(0.00)).toBe('low');
    expect(getCrowdLevel(0.39)).toBe('low');
  });

  it('returns moderate for 0.40–0.64', () => {
    expect(getCrowdLevel(0.40)).toBe('moderate');
    expect(getCrowdLevel(0.64)).toBe('moderate');
  });

  it('returns high for 0.65–0.84', () => {
    expect(getCrowdLevel(0.65)).toBe('high');
    expect(getCrowdLevel(0.84)).toBe('high');
  });

  it('returns critical at 0.85 and above', () => {
    expect(getCrowdLevel(0.85)).toBe('critical');
    expect(getCrowdLevel(1.00)).toBe('critical');
  });
});

describe('crowdLevelColor', () => {
  it('returns a non-empty hex string for every level', () => {
    const levels = ['low', 'moderate', 'high', 'critical'] as const;
    for (const level of levels) {
      const color = crowdLevelColor(level);
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('low and critical return distinct colors', () => {
    expect(crowdLevelColor('low')).not.toBe(crowdLevelColor('critical'));
  });
});

describe('estimateWaitMinutes', () => {
  it('returns 0 when occupancy is below 0.5', () => {
    expect(estimateWaitMinutes(0.0,  10)).toBe(0);
    expect(estimateWaitMinutes(0.49, 10)).toBe(0);
  });

  it('returns a positive integer when occupancy is above 0.5', () => {
    const wait = estimateWaitMinutes(0.9, 10);
    expect(wait).toBeGreaterThan(0);
    expect(Number.isInteger(wait)).toBe(true);
  });

  it('higher occupancy produces a longer wait', () => {
    const w1 = estimateWaitMinutes(0.6, 10);
    const w2 = estimateWaitMinutes(0.9, 10);
    expect(w2).toBeGreaterThanOrEqual(w1);
  });

  it('higher capacity per minute produces shorter or equal wait', () => {
    const slow = estimateWaitMinutes(0.8, 5);
    const fast = estimateWaitMinutes(0.8, 50);
    expect(fast).toBeLessThanOrEqual(slow);
  });

  it('does not crash with zero throughput', () => {
    expect(() => estimateWaitMinutes(0.9, 0)).not.toThrow();
  });
});
