import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { getSupabase } from "../lib/supabase.js";
import { buildSiteData } from "./build-site-data.js";

// CLI wrapper: snapshot the archive into site/*.json. Run: npm run site:data
// Used for local preview (site:serve) and as the push-time deploy fallback —
// the LIVE site's data is refreshed every poll via Netlify Blobs instead
// (see build-site-data.ts's header and netlify/functions/poll.mts).

const db = getSupabase();
if (!db) {
  console.error("No SUPABASE_* env configured — fill in .env first.");
  process.exit(1);
}

const { data, systemDetails } = await buildSiteData(db);

mkdirSync("site/systems", { recursive: true });
for (const { id, detail } of systemDetails) {
  writeFileSync(`site/systems/${id}.json`, JSON.stringify(detail, null, 2));
}
writeFileSync("site/data.json", JSON.stringify(data, null, 2));

const totals = data.totals as { down: number; activeUnits: number; systems: number };
console.log(
  `site/data.json written — ${totals.down}/${totals.activeUnits} down across ${totals.systems} systems.`,
);
console.log(`site/systems/*.json written — ${systemDetails.length} per-system detail pages.`);
