// MBTA V3 API is JSON:API — resources carry {id, type, attributes,
// relationships}, with sideloaded records in a top-level `included` array.

export interface MbtaFacilityProperty {
  name: string; // e.g. "alternate-service-text", "excludes-stop"
  value: string | number;
}

export interface MbtaFacilityRaw {
  id: string; // stable elevator id, e.g. "985"
  type: "facility";
  attributes: {
    long_name: string; // "Porter Elevator 985 (Lobby to Somerville Avenue)"
    short_name: string;
    type: string; // "ELEVATOR" (already filtered server-side)
    latitude: number | null;
    longitude: number | null;
    properties: MbtaFacilityProperty[];
  };
  relationships: { stop: { data: { id: string; type: "stop" } | null } };
}

export interface MbtaStopIncluded {
  id: string; // "place-portr"
  type: "stop";
  attributes: {
    name: string;
    municipality: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface MbtaJsonApiResponse<T> {
  data: T[];
  included?: MbtaStopIncluded[];
  links?: { next?: string };
}

export interface MbtaInformedEntity {
  facility?: string | null; // facility id this alert applies to, when relevant
  stop?: string | null;
}

export interface MbtaAlertRaw {
  id: string;
  type: "alert";
  attributes: {
    active_period: { start: string | null; end: string | null }[]; // ISO 8601 with offset
    cause: string; // "MAINTENANCE" | "CONSTRUCTION" | "UNKNOWN_CAUSE" | ...
    // MBTA labels elevators-out inconsistently across effects — ELEVATOR_CLOSURE,
    // ACCESS_ISSUE, and FACILITY_ISSUE all seen live. The adapter does NOT trust
    // this field to identify elevator outages; it joins informed_entity facilities
    // against the ELEVATOR-filtered facilities feed instead (see adapter comment).
    effect: string; // "ELEVATOR_CLOSURE" | "ACCESS_ISSUE" | "FACILITY_ISSUE" | ...
    header: string;
    description: string | null;
    informed_entity: MbtaInformedEntity[];
    lifecycle: string; // "NEW" | "ONGOING" | "ONGOING_UPCOMING" | "UPCOMING"
  };
}
