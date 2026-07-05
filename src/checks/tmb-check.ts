import { readFileSync } from "node:fs";
import type { TmbCatalogUnit } from "../adapters/tmb/raw.js";

// Asserting regression check for the TMB elevator catalog (scripts/tmb-import.mjs).
// Unlike TfL, TMB has no verified per-direction topology yet, so this checks
// catalog INTEGRITY (uniqueness, sane counts, known real units) rather than
// redundancy — a redundancy check can be added once a real signal exists
// (see src/adapters/tmb/index.ts). Run: npm run check:tmb

const units: TmbCatalogUnit[] = JSON.parse(
  readFileSync(new URL("../catalog/tmb-data/units.json", import.meta.url), "utf8"),
);

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`    ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

console.log("\n  Catalog integrity:");
check("catalog is non-empty", units.length > 0, `${units.length} units`);
check("every unit has a real ID_ACCES_FISIC id", units.every((u) => /^\d+$/.test(u.id)));
check("no duplicate unit ids", new Set(units.map((u) => u.id)).size === units.length);
check(
  "every unit has station + entrance identity",
  units.every((u) => u.stationGroupId && u.stationName && u.codiAcces && u.entranceName),
);

console.log("\n  Known real units (live-verified 2026-07-05):");
const byId = new Map(units.map((u) => [u.id, u]));

const bellvitge = byId.get("720");
check(
  "Hospital de Bellvitge — Residència sanitària (id 720)",
  bellvitge?.stationName === "Hospital de Bellvitge" && bellvitge?.codiAcces === "11101",
);

const paral = byId.get("662");
check(
  "Paral·lel — Avinguda Paral·lel (id 662)",
  paral?.stationName === "Paral·lel" && paral?.stationGroupId === "6660210",
);

// Església Major's "Mossèn Camil Rossell" access has 3 physical elevator
// units sharing one entrance code (94301) — live-verified via both the
// Accessos and Accessos Físics endpoints independently. This is NOT
// evidence of redundancy on its own (same trap as TfL's Kingsbury — "2+
// units at one access" doesn't mean parallel/redundant paths), just a real
// count this check locks in so a future import doesn't silently drop units.
const esglesiaMajor = units.filter((u) => u.stationName === "Església Major");
check("Església Major has 3 elevator units at one access (94301)", esglesiaMajor.length === 3);

console.log(`\n  catalog size: ${new Set(units.map((u) => u.stationGroupId)).size} stations, ${units.length} elevators`);

if (failures) {
  console.error(`\n  ${failures} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`\n  all checks passed\n`);
}
