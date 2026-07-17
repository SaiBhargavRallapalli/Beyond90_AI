/**
 * Venue navigation engine — A* pathfinding and nearest-facility BFS.
 *
 * `findRoute` implements A* with a Euclidean distance heuristic on the venue's
 * 2D coordinate system. The heuristic is admissible and consistent, guaranteeing
 * an optimal path while visiting fewer nodes than Dijkstra on this domain.
 *
 * `nearestFacilityNode` uses weighted BFS (Dijkstra variant) with early
 * termination once a candidate is settled and no closer candidate can exist.
 *
 * Both functions are pure — they derive all state from the `VenueGraph` argument
 * and produce no side effects.
 */
import type { VenueGraph, VenueNode, NavEdge, RouteSegment, NavigationRoute, Facility } from '@/lib/types';

interface AStarNode {
  nodeId: string;
  gCost: number;
  hCost: number;
  fCost: number;
  parent: string | null;
  edgeUsed: NavEdge | null;
}

function heuristic(a: VenueNode, b: VenueNode): number {
  return Math.sqrt(
    Math.pow(a.coords.x - b.coords.x, 2) + Math.pow(a.coords.y - b.coords.y, 2)
  ) * 10;
}

function travelSeconds(edge: NavEdge): number {
  switch (edge.travel) {
    case 'escalator': return edge.distance * 0.8;
    case 'elevator':  return 30 + edge.distance * 0.5;
    case 'stairs':    return edge.distance * 2.0;
    case 'ramp':      return edge.distance * 1.8;
    case 'walk':
    default:          return edge.distance * 1.5;
  }
}

function buildInstruction(edge: NavEdge, toName: string, fromName: string): string {
  switch (edge.travel) {
    case 'escalator': return `Take escalator up to ${toName}`;
    case 'elevator':  return `Take elevator to ${toName}`;
    case 'stairs':    return `Use stairs from ${fromName} to ${toName}`;
    case 'ramp':      return `Follow accessible ramp to ${toName}`;
    case 'walk':
    default:
      return edge.distance > 100
        ? `Walk ${Math.round(edge.distance)}m along concourse to ${toName}`
        : `Walk to ${toName}`;
  }
}

function determineCrowdRisk(
  graph: VenueGraph,
  pathNodeIds: string[]
): 'low' | 'medium' | 'high' {
  const concourseCount = pathNodeIds.filter(id =>
    id.includes('conc') || id.includes('lower') || id.includes('upper')
  ).length;
  if (pathNodeIds.length <= 2 && concourseCount === 0) return 'low';
  if (concourseCount >= 3) return 'high';
  return 'medium';
}

/**
 * Build an adjacency list from the venue's edge array.
 *
 * Bidirectional edges are added in both directions. The result is a Map from
 * node ID to an array of `{ edge, targetId }` pairs used by A* and BFS.
 */
export function buildAdjacency(
  graph: VenueGraph
): Map<string, Array<{ edge: NavEdge; targetId: string }>> {
  const adj = new Map<string, Array<{ edge: NavEdge; targetId: string }>>();

  for (const node of graph.nodes) {
    if (!adj.has(node.id)) adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const fromList = adj.get(edge.from) ?? [];
    fromList.push({ edge, targetId: edge.to });
    adj.set(edge.from, fromList);

    if (edge.bidirectional) {
      const toList = adj.get(edge.to) ?? [];
      toList.push({ edge, targetId: edge.from });
      adj.set(edge.to, toList);
    }
  }

  return adj;
}

function reconstructRoute(
  goalData: AStarNode,
  nodeData: Map<string, AStarNode>,
  nodeMap: Map<string, VenueNode>,
  graph: VenueGraph
): NavigationRoute {
  const path: AStarNode[] = [];
  let current: AStarNode | undefined = goalData;

  while (current) {
    path.unshift(current);
    current = current.parent !== null ? nodeData.get(current.parent) : undefined;
  }

  const segments: RouteSegment[] = [];
  let totalDistance = 0;
  let totalSeconds = 0;
  let accessibilityCompliant = true;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to   = path[i + 1];
    if (!to.edgeUsed) continue;

    const fromNode = nodeMap.get(from.nodeId)!;
    const toNode   = nodeMap.get(to.nodeId)!;
    const edge     = to.edgeUsed;

    const segSeconds = travelSeconds(edge);
    if (!edge.stepFree) accessibilityCompliant = false;

    segments.push({
      fromNodeId:       from.nodeId,
      fromName:         fromNode.name,
      toNodeId:         to.nodeId,
      toName:           toNode.name,
      travel:           edge.travel,
      stepFree:         edge.stepFree,
      distanceMeters:   edge.distance,
      estimatedSeconds: Math.round(segSeconds),
      instruction:      buildInstruction(edge, toNode.name, fromNode.name),
      landmark:         toNode.section !== fromNode.section ? toNode.section : undefined,
    });

    totalDistance += edge.distance;
    totalSeconds  += segSeconds;
  }

  return {
    segments,
    totalDistanceMeters:   Math.round(totalDistance),
    estimatedMinutes:      Math.ceil(totalSeconds / 60),
    accessibilityCompliant,
    crowdRisk:             determineCrowdRisk(graph, path.map(n => n.nodeId)),
    alternativeAvailable:  true,
  };
}

/**
 * Find the optimal route between two nodes using A* with a Euclidean heuristic.
 *
 * A* is preferred over Dijkstra here because the 2D coordinate system provides
 * an admissible, consistent heuristic that prunes the search space significantly
 * on large venue graphs.
 *
 * @param graph - The venue graph to search
 * @param fromNodeId - Starting node ID
 * @param toNodeId - Destination node ID
 * @param options.stepFreeOnly - When true, only traverses step-free edges
 * @param options.avoidNodes - Node IDs to exclude from the search (e.g. hotspots)
 * @returns A `NavigationRoute` with step-by-step segments, or `null` if unreachable
 */
export function findRoute(
  graph: VenueGraph,
  fromNodeId: string,
  toNodeId: string,
  options: { stepFreeOnly: boolean; avoidNodes?: string[] }
): NavigationRoute | null {
  const nodeMap = new Map<string, VenueNode>();
  for (const node of graph.nodes) nodeMap.set(node.id, node);

  const startNode = nodeMap.get(fromNodeId);
  const goalNode  = nodeMap.get(toNodeId);
  if (!startNode || !goalNode) return null;
  if (fromNodeId === toNodeId) {
    return {
      segments: [],
      totalDistanceMeters: 0,
      estimatedMinutes: 0,
      accessibilityCompliant: true,
      crowdRisk: 'low',
      alternativeAvailable: false,
    };
  }

  const adjacency = buildAdjacency(graph);
  const avoidSet  = new Set(options.avoidNodes ?? []);

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();
  const nodeData  = new Map<string, AStarNode>();

  const h0 = heuristic(startNode, goalNode);
  const startData: AStarNode = {
    nodeId:   fromNodeId,
    gCost:    0,
    hCost:    h0,
    fCost:    h0,
    parent:   null,
    edgeUsed: null,
  };
  openSet.push(startData);
  nodeData.set(fromNodeId, startData);

  while (openSet.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (
        openSet[i].fCost < openSet[bestIdx].fCost ||
        (openSet[i].fCost === openSet[bestIdx].fCost &&
          openSet[i].hCost < openSet[bestIdx].hCost)
      ) {
        bestIdx = i;
      }
    }
    const current = openSet.splice(bestIdx, 1)[0];

    if (current.nodeId === toNodeId) {
      return reconstructRoute(current, nodeData, nodeMap, graph);
    }

    closedSet.add(current.nodeId);

    const neighbors = adjacency.get(current.nodeId) ?? [];
    for (const { edge, targetId } of neighbors) {
      if (closedSet.has(targetId))              continue;
      if (avoidSet.has(targetId))               continue;
      if (options.stepFreeOnly && !edge.stepFree) continue;

      const targetNode = nodeMap.get(targetId);
      if (!targetNode) continue;

      const gCost   = current.gCost + edge.distance;
      const existing = nodeData.get(targetId);

      if (!existing || gCost < existing.gCost) {
        const hCost = heuristic(targetNode, goalNode);
        const updated: AStarNode = {
          nodeId:   targetId,
          gCost,
          hCost,
          fCost:    gCost + hCost,
          parent:   current.nodeId,
          edgeUsed: edge,
        };
        nodeData.set(targetId, updated);

        const openIdx = openSet.findIndex(n => n.nodeId === targetId);
        if (openIdx >= 0) {
          openSet[openIdx] = updated;
        } else {
          openSet.push(updated);
        }
      }
    }
  }

  return null;
}

/**
 * Locate the nearest facility of a given type using breadth-first Dijkstra search.
 *
 * BFS over the weighted graph terminates as soon as a candidate facility node is
 * de-queued and no closer candidate can exist (distance pruning). Returns the
 * closest matching facility by walking distance, or `null` if none is reachable.
 *
 * @param graph - The venue graph to search
 * @param fromNodeId - Starting node ID
 * @param facilityTypes - Facility type identifiers to match (e.g. `['accessible_restroom']`)
 * @param accessibleOnly - When true, only considers facilities flagged as accessible
 */
export function nearestFacilityNode(
  graph: VenueGraph,
  fromNodeId: string,
  facilityTypes: string[],
  accessibleOnly: boolean
): { facility: Facility; nodeId: string; distanceMeters: number } | null {
  const typeSet = new Set(facilityTypes);

  const candidates = graph.facilities.filter(
    f => typeSet.has(f.type) && (!accessibleOnly || f.accessible)
  );
  if (candidates.length === 0) return null;

  const adjacency = buildAdjacency(graph);

  const visited = new Map<string, number>();
  const queue: Array<{ nodeId: string; distance: number }> = [
    { nodeId: fromNodeId, distance: 0 },
  ];
  visited.set(fromNodeId, 0);

  let best: { facility: Facility; nodeId: string; distanceMeters: number } | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const next = queue.shift();
    if (!next) break;
    const { nodeId, distance } = next;

    if (best && distance > best.distanceMeters) break;

    const here = candidates.find(f => f.nodeId === nodeId);
    if (here && (!best || distance < best.distanceMeters)) {
      best = { facility: here, nodeId, distanceMeters: distance };
    }

    for (const { edge, targetId } of adjacency.get(nodeId) ?? []) {
      const newDist = distance + edge.distance;
      const prev    = visited.get(targetId);
      if (prev === undefined || newDist < prev) {
        visited.set(targetId, newDist);
        queue.push({ nodeId: targetId, distance: newDist });
      }
    }
  }

  return best;
}
