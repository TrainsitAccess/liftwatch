// Raw shapes as they appear in the MTA JSON feeds. Strings throughout — the
// feeds encode booleans as "Y"/"N" and dates as US wall-clock text.

/** An entry in nyct_ene.json (current) and nyct_ene_upcoming.json (upcoming). */
export interface MtaOutageRaw {
  station: string;
  borough: string;
  trainno: string;
  equipment: string; // e.g. "EL290X"
  equipmenttype: string; // "EL" | "ES"
  serving: string;
  ADA: string; // "Y" | "N"
  outagedate: string; // "MM/DD/YYYY hh:mm:ss AM"
  estimatedreturntoservice: string;
  reason: string; // "Repair" | "Planned Work" | "Capital Replacement" | ...
  isupcomingoutage: string; // "Y" | "N"
  ismaintenanceoutage: string; // "Y" | "N"
}

/** An entry in nyct_ene_equipments.json (full inventory / denominator). */
export interface MtaEquipmentRaw {
  station: string;
  borough: string;
  trainno: string;
  equipmentno: string; // e.g. "EL293"  (note: different key than outages feed)
  equipmenttype: string; // "EL" | "ES"
  serving: string;
  ADA: string; // "Y" | "N"
  isactive: string; // "Y" | "N"
  nonNYCT: string; // "Y" | "N"
  shortdescription: string;
  linesservedbyelevator: string;
  elevatorsgtfsstopid: string;
  elevatormrn: string;
  stationcomplexid: string; // stable station id
  nextadanorth: string;
  nextadasouth: string;
  redundant: number; // 0 => no redundant unit (sole step-free access)
  busconnections: string;
  alternativeroute: string;
}
