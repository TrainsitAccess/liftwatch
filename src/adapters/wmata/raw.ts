// Raw shapes from WMATA's API (live-verified 2026-07-04). Dates are ISO 8601
// WITHOUT an offset — local America/New_York wall-clock, e.g.
// "2026-07-03T11:52:00". UnitStatus/SymptomCode/DisplayOrder are deprecated
// (null/0 across the entire live feed) and intentionally not modeled.

/** Element of Incidents.svc/json/ElevatorIncidents — includes ESCALATORs too. */
export interface WmataIncidentRaw {
  UnitName: string; // stable unit id, e.g. "A14X01" (prefix = StationCode)
  UnitType: string; // "ELEVATOR" | "ESCALATOR"
  StationCode: string; // "A14"
  StationName: string; // often decorated: "Farragut North, L Street Entrance, ..."
  LocationDescription: string; // "Elevator between mezzanine and platform"
  SymptomDescription: string; // open-ended: "Service Call", "Modernization", ...
  DateOutOfServ: string; // "2026-07-03T11:52:00" (ET wall-clock)
  DateUpdated: string;
  EstimatedReturnToService: string; // date-level estimate, always T23:59:59
}

export interface WmataIncidentsResponse {
  ElevatorIncidents?: WmataIncidentRaw[];
}

/** Element of Rail.svc/json/jStations. */
export interface WmataStationRaw {
  Code: string; // "A01"
  Name: string; // "Metro Center"
  StationTogether1: string; // paired code at transfer stations ("" if none)
  Lat: number;
  Lon: number;
  Address?: { City?: string; State?: string };
}

export interface WmataStationsResponse {
  Stations?: WmataStationRaw[];
}
