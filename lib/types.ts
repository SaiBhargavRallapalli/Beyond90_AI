export type VenueId =
  | 'metlife'
  | 'sofi'
  | 'attdallas'
  | 'levis'
  | 'hardrock'
  | 'mercedesbenz'
  | 'lincolnfinancial'
  | 'gillette';

export interface Coordinates {
  x: number;
  y: number;
}

export interface VenueNode {
  id: string;
  name: string;
  section: string;
  level: number;
  coords: Coordinates;
  accessible: boolean;
  indoor: boolean;
}

export interface NavEdge {
  from: string;
  to: string;
  distance: number;
  travel: 'walk' | 'escalator' | 'elevator' | 'ramp' | 'stairs';
  stepFree: boolean;
  capacity: number;
  bidirectional: boolean;
}

export type FacilityType =
  | 'gate'
  | 'turnstile'
  | 'restroom'
  | 'accessible_restroom'
  | 'first_aid'
  | 'food_court'
  | 'merchandise'
  | 'atm'
  | 'water_station'
  | 'charging_station'
  | 'sensory_room'
  | 'family_room'
  | 'vip_lounge'
  | 'press_area'
  | 'exit'
  | 'parking'
  | 'transit_hub'
  | 'seat_section';

export interface Facility {
  id: string;
  type: FacilityType;
  nodeId: string;
  name: string;
  description: string;
  accessible: boolean;
  capacity?: number;
  operatingHours?: string;
}

export interface VenueGraph {
  venueId: VenueId;
  venueName: string;
  city: string;
  country: 'USA' | 'Canada' | 'Mexico';
  capacity: number;
  nodes: VenueNode[];
  edges: NavEdge[];
  facilities: Facility[];
}

export interface CrowdSnapshot {
  nodeId: string;
  occupancy: number;
  inflow: number;
  outflow: number;
  congestionIndex: number;
  trend: 'rising' | 'stable' | 'falling';
}

export interface CrowdForecast {
  venueId: VenueId;
  minutesToKickoff: number;
  snapshots: CrowdSnapshot[];
  hotspots: string[];
  safeNodes: string[];
  generatedAt: string;
}

export interface RouteSegment {
  fromNodeId: string;
  fromName: string;
  toNodeId: string;
  toName: string;
  travel: NavEdge['travel'];
  stepFree: boolean;
  distanceMeters: number;
  estimatedSeconds: number;
  instruction: string;
  landmark?: string;
}

export interface NavigationRoute {
  segments: RouteSegment[];
  totalDistanceMeters: number;
  estimatedMinutes: number;
  accessibilityCompliant: boolean;
  crowdRisk: 'low' | 'medium' | 'high';
  alternativeAvailable: boolean;
}

export type UserRole = 'fan' | 'staff' | 'volunteer' | 'media';
export type AccessibilityProfile =
  | 'standard'
  | 'wheelchair'
  | 'low_vision'
  | 'hearing_impaired'
  | 'cognitive';

export interface UserSession {
  id: string;
  role: UserRole;
  venueId: VenueId;
  currentNodeId: string;
  accessibilityProfile: AccessibilityProfile;
  language: string;
  ticketSection?: string;
  minutesToKickoff: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    route?: NavigationRoute;
    facilities?: Facility[];
    crowdAlert?: { level: string; message: string };
    toolsUsed?: string[];
  };
}

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertCategory =
  | 'crowd'
  | 'safety'
  | 'accessibility'
  | 'facility'
  | 'infrastructure'
  | 'staff'
  | 'transport'
  | 'sustainability';

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  affectedNodes: string[];
  recommendedActions: string[];
  timestamp: string;
  acknowledged: boolean;
  aiGenerated: boolean;
}

export interface StaffResource {
  id: string;
  role: 'security' | 'usher' | 'medic' | 'cleaning' | 'supervisor';
  nodeId: string;
  status: 'available' | 'deployed' | 'break' | 'emergency';
  skills: string[];
}

export interface OpsSnapshot {
  venueId: VenueId;
  timestamp: string;
  minutesToKickoff: number;
  totalAttendance: number;
  capacityPercent: number;
  activeAlerts: number;
  staffDeployed: number;
  sustainabilityScore: number;
  alerts: OperationalAlert[];
}

export interface SustainabilityMetrics {
  venueId: VenueId;
  matchId: string;
  carbonKgPerFan: number;
  wasteKgTotal: number;
  recyclingRate: number;
  waterLitersPerFan: number;
  renewableEnergyPercent: number;
  publicTransportPercent: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface AssistRequest {
  session: UserSession;
  message: string;
  history: ChatMessage[];
}

export interface AssistResponse {
  answer: string;
  route?: NavigationRoute;
  facilities?: Facility[];
  crowdWarning?: string;
  toolsUsed: string[];
}
