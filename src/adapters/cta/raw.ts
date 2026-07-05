// Raw shapes from CTA's Customer Alerts API (alerts.aspx?outputType=JSON),
// live-verified 2026-07-05. No API key needed (Terms of Use only). Dates are
// ISO-8601 WITHOUT an offset — local America/Chicago wall-clock, e.g.
// "2026-06-29T09:29:00" (confirmed: response TimeStamp vs. real UTC clock at
// fetch time showed exactly a 5-hour CDT offset).

export interface CtaServiceRaw {
  ServiceType: string; // "T" (train station) | "R" (train route) | "B" (bus route) | "X" (systemwide)
  ServiceTypeDescription: string;
  ServiceName: string; // e.g. "Howard"
  ServiceId: string; // station: GTFS parent-station id (4xxxx); route: e.g. "Red"
}

export interface CtaAlertRaw {
  AlertId: string;
  Headline: string;
  ShortDescription: string; // the genuine signal for planned/unplanned classification
  // FullDescription carries a boilerplate "...repair and upgrade elevators"
  // footer link on nearly every alert regardless of cause — live-verified
  // false-positive trap; never text-classify against this field.
  FullDescription?: { "#cdata-section"?: string } | string;
  Impact: string; // one of 10 values; "Elevator Status" is exact and exclusive
  EventStart: string; // ISO, no offset, America/Chicago wall-clock
  EventEnd: string | null; // null/absent when open-ended (TBD=1)
  TBD: string; // "0" | "1"
  ImpactedService: { Service: CtaServiceRaw | CtaServiceRaw[] };
}

export interface CtaAlertsResponse {
  CTAAlerts: {
    TimeStamp: string;
    ErrorCode: string;
    Alert?: CtaAlertRaw[];
  };
}
