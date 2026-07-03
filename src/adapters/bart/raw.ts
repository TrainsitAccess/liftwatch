// BART's legacy API returns XML-converted-to-JSON, so nested values arrive as
// { "#cdata-section": "..." } and single-element lists may be an object, not an
// array. Types are loose to reflect that.

export type BartCdata = { "#cdata-section": string };
export type BartText = string | BartCdata;

export interface BartStationRaw {
  name: string;
  abbr: string; // stable station code, e.g. "MLBR"
  gtfs_latitude: string;
  gtfs_longitude: string;
  city?: string;
  county?: string;
  state?: string;
}

export interface BartStnResponse {
  root?: { stations?: { station?: BartStationRaw[] } };
}

// cmd=elev returns one (or more) free-text advisories listing stations with an
// elevator out of service — NOT per-elevator structured data.
export interface BartBsaRaw {
  station?: string;
  type?: string; // "ELEVATOR"
  description?: BartText;
  sms_text?: BartText;
  posted?: string;
  expires?: string;
}

export interface BartElevResponse {
  root?: { bsa?: BartBsaRaw | BartBsaRaw[] };
}
