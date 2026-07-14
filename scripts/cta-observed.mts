// Snapshot every CTA elevator identity ever OBSERVED — each distinct alert
// text from the archive (outage_events.reason, split on the " · " merge
// separator) plus the current live feed, parsed through the SAME identity
// parser the adapter uses — into src/catalog/cta-data/observed-units.json.
//
// Why this exists: CTA's alert text is the ONLY per-elevator signal the agency
// publishes (no ids, no inventory, no roster — re-verified 2026-07-13), so the
// observed corpus IS the vocabulary contract. The snapshot feeds check:cta
// (every archived phrasing must keep parsing to its known unit id — a parser
// tweak that re-slugs history fails loudly) and doubles as the curation aid
// for an eventual chains pass (it lists each station's known elevators and
// flags ambiguities like 43rd's two descriptions).
//
// Grows only — an identity once observed is never dropped. Usage:
//   npx tsx scripts/cta-observed.mts   (SUPABASE_* in .env optional — live-only
//   merge without; the committed snapshot is never shrunk)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { getSupabase } from "../src/lib/supabase.js";
import { parseCtaElevatorIdentity } from "../src/adapters/cta/location.js";

const outPath = fileURLToPath(new URL("../src/catalog/cta-data/observed-units.json", import.meta.url));

interface Observed { unitId: string; stationId: string; texts: string[]; firstObserved: string }
const byUnit = new Map<string, Observed>();
const add = (stationId: string, text: string, when: string) => {
  const t = text.trim();
  if (!t) return;
  const slug = parseCtaElevatorIdentity(t);
  const unitId = slug ? `${stationId}-${slug}` : stationId;
  const u = byUnit.get(unitId) ?? { unitId, stationId, texts: [], firstObserved: when };
  if (!u.texts.includes(t)) u.texts.push(t);
  if (when < u.firstObserved) u.firstObserved = when;
  byUnit.set(unitId, u);
};

// 1) previously committed snapshot (never lose an observation)
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, "utf8")) as { units: Observed[] };
  for (const u of prev.units) for (const t of u.texts) add(u.stationId, t, u.firstObserved);
}

// 2) the archive — every alert text ever ingested
const db = getSupabase();
if (db) {
  const { data, error } = await db
    .from("outage_events")
    .select("station_id, reason, started_at")
    .eq("system_id", "cta-chicago");
  if (error) throw new Error(`archive query failed: ${error.message}`);
  for (const o of data) {
    const stationId = (o.station_id ?? "").replace(/^cta-chicago:/, "");
    if (!stationId) continue;
    for (const part of (o.reason ?? "").split(" · ")) add(stationId, part, o.started_at ?? new Date().toISOString());
  }
} else {
  console.warn("no SUPABASE_* creds — merging live feed into the existing snapshot only");
}

// 3) the live feed
const res = await fetch("http://lapi.transitchicago.com/api/1.0/alerts.aspx?outputType=JSON&accessibility=true", {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) throw new Error(`CTA alerts feed HTTP ${res.status}`);
const alerts = ((await res.json()) as { CTAAlerts: { Alert?: unknown } }).CTAAlerts.Alert ?? [];
for (const a of Array.isArray(alerts) ? alerts : [alerts]) {
  const al = a as { Impact?: string; Headline?: string; ShortDescription?: string; ImpactedService?: { Service?: unknown } };
  if (al.Impact !== "Elevator Status") continue;
  const services = Array.isArray(al.ImpactedService?.Service) ? al.ImpactedService.Service : [al.ImpactedService?.Service];
  const station = (services as { ServiceType?: string; ServiceId?: string }[]).find((s) => s?.ServiceType === "T");
  if (!station?.ServiceId) continue;
  const text = [al.Headline, al.ShortDescription].map((s) => (s ?? "").trim()).filter(Boolean).join(" — ");
  add(station.ServiceId, text, new Date().toISOString());
}

const units = [...byUnit.values()].sort((a, b) => a.unitId.localeCompare(b.unitId));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  updatedAt: new Date().toISOString(),
  note: "Every CTA elevator identity ever observed (archive + live alert texts, parsed by src/adapters/cta/location.ts). Grows only. Regression fixture for check:cta and the curation aid for a future chains pass.",
  units,
}, null, 2) + "\n");
const identified = units.filter((u) => u.unitId !== u.stationId).length;
console.log(`observed-units.json: ${units.length} units (${identified} identified per-elevator, ${units.length - identified} station-level vague) across ${new Set(units.map((u) => u.stationId)).size} stations`);
