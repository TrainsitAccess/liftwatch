import "dotenv/config";
import { getSupabase } from "../lib/supabase.js";

// Row counts per table + latest poll runs. Run: npm run db:status

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

const tables = [
  "systems",
  "stations",
  "units",
  "outage_events",
  "offline_events",
  "upcoming_outages",
  "poll_runs",
  "redundancy_flags",
  "daily_rollups",
];

console.log("\n  table counts:");
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`    ${t.padEnd(18)} ${error ? `ERR: ${error.message}` : count}`);
}

const runs = await db
  .from("poll_runs")
  .select("system_id, status, units_seen, outages_open, events_opened, events_closed, flags_raised, started_at, error")
  .order("started_at", { ascending: false })
  .limit(5);

console.log("\n  latest poll runs:");
for (const r of runs.data ?? []) {
  const line = r.status === "error"
    ? `ERROR — ${String(r.error).slice(0, 80)}`
    : `${r.status} · units ${r.units_seen} · open ${r.outages_open} · +${r.events_opened}/-${r.events_closed} events · flags ${r.flags_raised ?? 0}`;
  console.log(`    ${String(r.system_id).padEnd(15)} ${line}`);
}
console.log("");
