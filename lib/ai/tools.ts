import Anthropic from '@anthropic-ai/sdk';

export const STADIUM_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_venue_info',
    description:
      'Get layout info for a FIFA WC 2026 venue — zones, sections, and available facility types',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: {
          type: 'string',
          description: 'Venue identifier (e.g. metlife, sofi, attdallas)',
        },
      },
      required: ['venue_id'],
    },
  },
  {
    name: 'find_route',
    description:
      'Find the best walking route between two zones in a venue, respecting accessibility needs',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string' },
        from_node: { type: 'string', description: 'Starting node ID' },
        to_node: { type: 'string', description: 'Destination node ID' },
        step_free: {
          type: 'boolean',
          description: 'If true, only use step-free routes (wheelchair/ramp/elevator)',
        },
      },
      required: ['venue_id', 'from_node', 'to_node'],
    },
  },
  {
    name: 'find_nearest_facility',
    description:
      "Find the nearest facility of a given type from the user's current location",
    input_schema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string' },
        from_node: { type: 'string', description: 'Current location node ID' },
        facility_type: {
          type: 'string',
          description:
            'Type of facility: restroom, accessible_restroom, first_aid, food_court, water_station, merchandise, atm, charging_station, sensory_room, family_room, exit, transit_hub',
        },
        accessible_only: {
          type: 'boolean',
          description: 'Only return accessible facilities',
        },
      },
      required: ['venue_id', 'from_node', 'facility_type'],
    },
  },
  {
    name: 'get_crowd_status',
    description: 'Get current crowd density levels and congestion hotspots for a venue',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string' },
        minutes_to_kickoff: {
          type: 'number',
          description: 'Minutes until kickoff (negative = match in progress)',
        },
        node_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific node IDs to check (optional, returns all if omitted)',
        },
      },
      required: ['venue_id', 'minutes_to_kickoff'],
    },
  },
  {
    name: 'get_transport_options',
    description:
      'Get public transport and parking information for arriving at or departing from the venue',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string' },
        direction: {
          type: 'string',
          enum: ['arriving', 'departing'],
          description: 'Arriving at or departing from venue',
        },
        minutes_to_kickoff: { type: 'number' },
      },
      required: ['venue_id', 'direction'],
    },
  },
  {
    name: 'get_sustainability_tip',
    description: 'Get sustainability metrics and eco-friendly tips for the venue and match day',
    input_schema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string' },
      },
      required: ['venue_id'],
    },
  },
];

// ---------------------------------------------------------------------------
// Gemini function declaration format
// Gemini requires uppercase type names and uses "parameters" (not "input_schema")
// ---------------------------------------------------------------------------
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
    required?: string[];
  };
}

export const GEMINI_FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'get_venue_info',
    description:
      'Get layout info for a FIFA WC 2026 venue — zones, sections, and available facility types',
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: {
          type: 'STRING',
          description: 'Venue identifier (e.g. metlife, sofi, attdallas)',
        },
      },
      required: ['venue_id'],
    },
  },
  {
    name: 'find_route',
    description:
      'Find the best walking route between two zones in a venue, respecting accessibility needs',
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: { type: 'STRING' },
        from_node: { type: 'STRING', description: 'Starting node ID' },
        to_node: { type: 'STRING', description: 'Destination node ID' },
        step_free: {
          type: 'BOOLEAN',
          description: 'If true, only use step-free routes (wheelchair/ramp/elevator)',
        },
      },
      required: ['venue_id', 'from_node', 'to_node'],
    },
  },
  {
    name: 'find_nearest_facility',
    description: "Find the nearest facility of a given type from the user's current location",
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: { type: 'STRING' },
        from_node: { type: 'STRING', description: 'Current location node ID' },
        facility_type: {
          type: 'STRING',
          description:
            'Type: restroom, accessible_restroom, first_aid, food_court, water_station, merchandise, atm, charging_station, sensory_room, family_room, exit, transit_hub',
        },
        accessible_only: {
          type: 'BOOLEAN',
          description: 'Only return accessible facilities',
        },
      },
      required: ['venue_id', 'from_node', 'facility_type'],
    },
  },
  {
    name: 'get_crowd_status',
    description: 'Get current crowd density levels and congestion hotspots for a venue',
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: { type: 'STRING' },
        minutes_to_kickoff: {
          type: 'NUMBER',
          description: 'Minutes until kickoff (negative = match in progress)',
        },
        node_ids: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Specific node IDs to check (optional)',
        },
      },
      required: ['venue_id', 'minutes_to_kickoff'],
    },
  },
  {
    name: 'get_transport_options',
    description:
      'Get public transport and parking info for arriving at or departing from the venue',
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: { type: 'STRING' },
        direction: {
          type: 'STRING',
          enum: ['arriving', 'departing'],
          description: 'Arriving at or departing from venue',
        },
        minutes_to_kickoff: { type: 'NUMBER' },
      },
      required: ['venue_id', 'direction'],
    },
  },
  {
    name: 'get_sustainability_tip',
    description: 'Get sustainability metrics and eco-friendly tips for the venue and match day',
    parameters: {
      type: 'OBJECT',
      properties: {
        venue_id: { type: 'STRING' },
      },
      required: ['venue_id'],
    },
  },
];
