import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { getSupabase } from "../lib/supabase.js";

// Weekly archive backup: dump every table to a dated XLSX (sheet per table) +
// an exact JSON snapshot, written to BACKUP_OUT_DIR (default ./backup-out). The
// backup workflow commits these to a private git repo — off-platform, versioned
// insurance against losing the Supabase archive. Run: npm run backup

// Ordered by a stable key so range-pagination stays correct even while the
// poller writes concurrently.
const TABLES: { name: string; order: string[] }[] = [
  { name: "systems", order: ["id"] },
  { name: "stations", order: ["id"] },
  { name: "units", order: ["id"] },
  { name: "outage_events", order: ["id"] },
  { name: "offline_events", order: ["id"] },
  { name: "upcoming_outages", order: ["id"] },
  { name: "poll_runs", order: ["id"] },
  { name: "redundancy_flags", order: ["id"] },
  { name: "daily_rollups", order: ["unit_id", "day"] },
];

type Row = Record<string, unknown>;

async function fetchAll(db: NonNullable<ReturnType<typeof getSupabase>>, t: { name: string; order: string[] }): Promise<Row[]> {
  const page = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += page) {
    let q = db.from(t.name).select("*").range(from, from + page - 1);
    for (const col of t.order) q = q.order(col, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${t.name}: ${error.message}`);
    all.push(...((data as Row[]) ?? []));
    if (!data || data.length < page) break;
  }
  return all;
}

async function buildXlsx(dump: Record<string, Row[]>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const { name } of TABLES) {
    const rows = dump[name] ?? [];
    const ws = wb.addWorksheet(name);
    const cols = rows.length ? Object.keys(rows[0]!) : ["(empty)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: 18 }));
    for (const r of rows) ws.addRow(r);
    ws.getRow(1).font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function main(): Promise<void> {
  const db = getSupabase();
  if (!db) throw new Error("No SUPABASE_* env configured.");

  const dump: Record<string, Row[]> = {};
  for (const t of TABLES) {
    dump[t.name] = await fetchAll(db, t);
    console.log(`  ${t.name.padEnd(18)} ${dump[t.name]!.length} rows`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = join(process.env.BACKUP_OUT_DIR || "backup-out", date.slice(0, 4));
  mkdirSync(outDir, { recursive: true });

  const xlsx = await buildXlsx(dump);
  const json = Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), tables: dump }, null, 0));
  const xlsxPath = join(outDir, `elevator-archive-${date}.xlsx`);
  const jsonPath = join(outDir, `elevator-archive-${date}.json`);
  writeFileSync(xlsxPath, xlsx);
  writeFileSync(jsonPath, json);

  console.log(`  wrote ${xlsxPath} (${(xlsx.length / 1024).toFixed(0)} KB)`);
  console.log(`  wrote ${jsonPath} (${(json.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error("backup failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
