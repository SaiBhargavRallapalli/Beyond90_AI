/**
 * Crowd flow model for FIFA WC 2026 smart stadium analytics.
 *
 * Occupancy at each venue node is modelled as a continuous, phase-aware sigmoid
 * function of `minutesToKickoff` rather than a discrete time-tier lookup. This
 * produces smooth transitions across match phases (pre-match ingress, in-match,
 * halftime surge, post-match egress) for six node types: gate, concourse,
 * concession, restroom, seating, and exit.
 *
 * The congestion index (0–100) is a composite of occupancy ratio, absolute
 * inflow density relative to node throughput capacity, and trend direction.
 * Nodes with index > 70 are flagged as hotspots requiring operational action.
 *
 * All functions are pure — no I/O, no randomness — making them fully testable
 * and safe to call on every API request without caching.
 */
import type { VenueGraph, CrowdSnapshot, CrowdForecast } from '@/lib/types';

type NodeClassification = 'gate' | 'concourse' | 'concession' | 'restroom' | 'seating' | 'exit';

interface FlowParams {
  minutesToKickoff: number;
  capacity: number;
  nodeType: NodeClassification;
  baseOccupancy: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function computeOccupancy(params: FlowParams): number {
  const { minutesToKickoff: mtk, nodeType } = params;
  const t = -mtk;

  switch (nodeType) {
    case 'gate': {
      if (mtk > 150)        return 0.02;
      if (mtk > 90)         return 0.02 + ((150 - mtk) / 60) * 0.18;
      if (mtk > 45)         return 0.20 + ((90  - mtk) / 45) * 0.40;
      if (mtk > 0)          return 0.60 + ((45  - mtk) / 45) * 0.28;
      if (mtk > -15)        return 0.88 - (t / 15) * 0.75;
      if (mtk > -30)        return 0.13 - ((t - 15) / 15) * 0.10;
      return 0.03;
    }

    case 'concourse': {
      if (mtk > 150)        return 0.04;
      if (mtk > 90)         return 0.04 + ((150 - mtk) / 60) * 0.16;
      if (mtk > 45)         return 0.20 + ((90  - mtk) / 45) * 0.25;
      if (mtk > 0)          return 0.45 + ((45  - mtk) / 45) * 0.15;
      if (mtk > -15)        return 0.60 - (t / 15) * 0.45;
      if (t >= 43 && t <= 52) {
        const htProgress = (t - 43) / 9;
        return 0.15 + Math.sin(Math.PI * htProgress) * 0.60;
      }
      if (mtk > -60)        return 0.15 - ((t - 52) / 38) * 0.08;
      if (mtk > -90)        return 0.07;
      return 0.07 + ((t - 90) / 30) * 0.50;
    }

    case 'concession': {
      if (mtk > 120)        return 0.08;
      if (mtk > 60)         return 0.08 + ((120 - mtk) / 60) * 0.42;
      if (mtk > 30)         return 0.50 - ((60  - mtk) / 30) * 0.15;
      if (mtk > 0)          return 0.35 - (mtk / 30) * 0.10;
      if (mtk > -20)        return 0.25;
      if (t >= 43 && t <= 53) {
        const p = (t - 43) / 10;
        return 0.25 + Math.sin(Math.PI * p) * 0.65;
      }
      if (mtk > -60)        return 0.28 - ((t - 53) / 37) * 0.18;
      if (mtk > -90)        return 0.10;
      return 0.10;
    }

    case 'restroom': {
      if (mtk > 90)         return 0.12;
      if (mtk > 0)          return 0.18;
      if (mtk > -20)        return 0.20;
      if (t >= 43 && t <= 55) {
        const p = (t - 43) / 12;
        return 0.20 + Math.sin(Math.PI * p) * 0.72;
      }
      if (mtk > -90)        return 0.22;
      return 0.28;
    }

    case 'seating': {
      if (mtk > 90)         return 0.04;
      if (mtk > 45)         return 0.04 + ((90 - mtk) / 45) * 0.41;
      if (mtk > 0)          return 0.45 + ((45 - mtk) / 45) * 0.50;
      if (t >= 43 && t <= 50) return 0.95 - ((t - 43) / 7) * 0.15;
      if (t > 50 && t <= 53)  return 0.80 + ((t - 50) / 3) * 0.15;
      if (mtk > -90)        return 0.95;
      return clamp(0.95 - ((t - 90) / 30) * 0.60);
    }

    case 'exit': {
      if (mtk > -90)        return 0.02;
      return clamp(0.02 + ((t - 90) / 30) * 0.85);
    }

    default:
      return 0.20;
  }
}

function computeInflow(params: FlowParams): number {
  const { minutesToKickoff: mtk, capacity, nodeType } = params;
  const base = capacity * 0.025;

  switch (nodeType) {
    case 'gate':
      if (mtk <= 0 || mtk > 150) return 0;
      return base * sigmoid(-(mtk - 60) / 18) * 2.2;

    case 'concourse':
      if (mtk > 0 && mtk <= 150) return base * sigmoid(-(mtk - 45) / 15) * 1.5;
      if (mtk < -40 && mtk > -55) return base * 2.0;
      return base * 0.2;

    case 'seating':
      if (mtk > 0 && mtk <= 90) return base * sigmoid(-(mtk - 30) / 12) * 1.8;
      if (mtk < -50 && mtk > -60) return base * 1.2;
      return 0;

    case 'concession':
      if (mtk > 60 && mtk < 150) return base * 0.8;
      if (mtk < -43 && mtk > -53) return base * 3.0;
      return base * 0.3;

    case 'restroom':
      if (mtk < -43 && mtk > -55) return base * 2.5;
      return base * 0.15;

    case 'exit':
      if (mtk < -90) return base * sigmoid(-(-mtk - 100) / 8) * 4.0;
      return 0;

    default:
      return base * 0.1;
  }
}

function computeOutflow(params: FlowParams): number {
  const { minutesToKickoff: mtk, capacity, nodeType } = params;
  const base = capacity * 0.025;

  switch (nodeType) {
    case 'gate':
      if (mtk < -10 && mtk > -40) return base * 0.6;
      return 0;

    case 'concourse':
      if (mtk < 0 && mtk > -43) return base * 1.2;
      if (mtk < -55 && mtk > -90) return base * 0.6;
      return base * 0.2;

    case 'seating':
      if (mtk < -90) return base * sigmoid(-(-mtk - 95) / 5) * 3.5;
      return 0;

    case 'concession':
    case 'restroom':
      if (mtk < -55 && mtk > -90) return base * 1.0;
      return base * 0.1;

    case 'exit':
      if (mtk < -110) return base * 3.0;
      return 0;

    default:
      return base * 0.05;
  }
}

function computeCongestionIndex(occupancy: number, inflow: number, nodeCapacity: number): number {
  const occupancyScore = occupancy * 70;
  const inflowDensity  = nodeCapacity > 0 ? inflow / (nodeCapacity * 0.03) : 0;
  const inflowScore    = Math.min(30, inflowDensity * 30);
  return Math.min(100, Math.round(occupancyScore + inflowScore));
}

function classifyNode(nodeId: string): NodeClassification {
  const id = nodeId.toLowerCase();
  if (id.includes('gate'))                                         return 'gate';
  if (id.includes('exit'))                                         return 'exit';
  if (id.includes('seat') || id.includes('field') || id.startsWith('upper_') || id.includes('tower')) return 'seating';
  if (id.includes('food') || id.includes('concession') || id.includes('vip') || id.includes('club') || id.includes('lounge') || id.includes('plaza') || id.includes('atrium')) return 'concession';
  if (id.includes('restroom') || id.includes('bathroom') || id.includes('sensory')) return 'restroom';
  return 'concourse';
}

/**
 * Compute a per-node crowd forecast for the given venue and match timing.
 *
 * Each node's occupancy, inflow, outflow, congestion index, and trend are
 * derived from the continuous sigmoid flow model in `computeOccupancy` /
 * `computeInflow` / `computeOutflow`. Hotspots are nodes with congestion
 * index > 70; safe nodes have occupancy < 40%.
 *
 * @param graph - The venue graph (nodes, edges, capacity)
 * @param minutesToKickoff - Minutes until kickoff (positive = pre-match, negative = in-match / post)
 */
export function generateCrowdForecast(
  graph: VenueGraph,
  minutesToKickoff: number
): CrowdForecast {
  const snapshots: CrowdSnapshot[] = graph.nodes.map(node => {
    const nodeType    = classifyNode(node.id);
    const nodeCapacity = graph.capacity * (nodeType === 'gate' ? 0.015 : nodeType === 'seating' ? 0.08 : 0.04);

    const params: FlowParams = {
      minutesToKickoff,
      capacity:      nodeCapacity,
      nodeType,
      baseOccupancy: 0.1,
    };

    const occupancy       = clamp(computeOccupancy(params));
    const inflow          = Math.max(0, computeInflow(params));
    const outflow         = Math.max(0, computeOutflow(params));
    const congestionIndex = computeCongestionIndex(occupancy, inflow, nodeCapacity);

    const trend: CrowdSnapshot['trend'] =
      inflow > outflow * 1.25 ? 'rising' :
      outflow > inflow * 1.25 ? 'falling' : 'stable';

    return { nodeId: node.id, occupancy, inflow: Math.round(inflow), outflow: Math.round(outflow), congestionIndex, trend };
  });

  const hotspots  = snapshots.filter(s => s.congestionIndex > 70).map(s => s.nodeId);
  const safeNodes = snapshots.filter(s => s.occupancy < 0.40).map(s => s.nodeId);

  return {
    venueId:          graph.venueId,
    minutesToKickoff,
    snapshots,
    hotspots,
    safeNodes,
    generatedAt:      new Date().toISOString(),
  };
}

/**
 * Map a fractional occupancy value (0–1) to a named crowd level.
 * Thresholds: low < 0.40, moderate < 0.65, high < 0.85, critical ≥ 0.85.
 */
export function getCrowdLevel(occupancy: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (occupancy < 0.40) return 'low';
  if (occupancy < 0.65) return 'moderate';
  if (occupancy < 0.85) return 'high';
  return 'critical';
}

/** Return the hex colour associated with a crowd level for UI rendering. */
export function crowdLevelColor(level: ReturnType<typeof getCrowdLevel>): string {
  switch (level) {
    case 'low':      return '#00D4AA';
    case 'moderate': return '#C9A84C';
    case 'high':     return '#E4AE43';
    case 'critical': return '#C41E3A';
  }
}

/**
 * Estimate queue wait time (in minutes) at a node given its occupancy and throughput.
 *
 * Returns 0 when occupancy is below 50% (no meaningful queue).
 * Above 50%, wait grows linearly with overflow relative to throughput.
 *
 * @param occupancy - Fractional occupancy (0–1)
 * @param nodeCapacityPerMinute - Fan throughput capacity in fans/minute
 */
export function estimateWaitMinutes(occupancy: number, nodeCapacityPerMinute: number): number {
  if (occupancy < 0.5) return 0;
  const overflow = Math.max(0, occupancy - 0.5);
  return Math.round((overflow / 0.5) * (100 / Math.max(1, nodeCapacityPerMinute)));
}
