// Types for TMB's bundled elevator catalog (src/catalog/tmb-data/units.json,
// built by scripts/tmb-import.mjs from the documented "transit" API's
// Estacions + Accessos Físics endpoints — see SPEC.md) and the live,
// UNDOCUMENTED alerts feed that actually powers TMB's own website elevator-
// status widget (found by inspecting real network traffic from a station
// page: https://www.tmb.cat/en/barcelona/metro/-/lineametro/L2/estacion/210
// — not published anywhere in developer.tmb.cat's docs).

export interface TmbCatalogUnit {
  id: string; // ID_ACCES_FISIC — TMB's own unique physical-access-unit id
  codiAcces: string; // CODI_ACCES — entrance-level code; joins to alerts' entrance_code
  stationGroupId: string; // CODI_GRUP_ESTACIO
  stationName: string; // NOM_ESTACIO
  entranceName: string; // NOM_ACCES
  latitude: number | null;
  longitude: number | null;
}

/** One entity an alert applies to, from GET /v1/alerts/metro/channels/WEB. */
export interface TmbAlertEntity {
  direction_code?: string;
  direction_name?: string;
  entrance_code?: string; // CODI_ACCES, or "ALL" for a station-wide effect
  entrance_name?: string;
  line_code: string;
  line_name: string;
  station_code: string;
  station_name: string;
}

export interface TmbAlertPublication {
  headerCa?: string;
  headerEn?: string;
  headerEs?: string;
  textCa?: string;
  textEn?: string;
  textEs?: string;
  begin_date: number; // epoch ms
  end_date: number; // epoch ms
}

export interface TmbAlertRaw {
  id: number;
  disruption_dates: { begin_date: number; end_date: number }[];
  entities: TmbAlertEntity[];
  publications: TmbAlertPublication[];
  categories: {
    effect_code: string; // "PP8" = elevators out of service — the only code LiftWatch ingests
    effect_type: string;
    cause_code: string;
    effect_status: string;
  };
}

export interface TmbAlertsResponse {
  status: string;
  data: { alerts: TmbAlertRaw[] };
}
