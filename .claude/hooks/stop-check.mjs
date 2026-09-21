// Stop-hook: voordat Claude stopt, moeten typecheck, validate en test groen zijn
// (alleen als er relevante wijzigingen zijn). Exit 2 = niet stoppen, los het eerst op.
import { readInput, hasScript, run, tail, hasRelevantChanges } from "./lib.mjs";

const input = readInput();

// Voorkomt een oneindige lus: na één doorwerkronde mag Claude stoppen (en moet dan melden wat faalt).
if (input.stop_hook_active) process.exit(0);
if (!hasRelevantChanges()) process.exit(0);

const failures = [];
for (const script of ["typecheck", "validate", "test"]) {
  if (!hasScript(script)) continue;
  const r = run("npm", ["run", "-s", script]);
  if (!r.ok) failures.push(`✗ npm run ${script}\n${tail(r.output)}`);
}

if (failures.length > 0) {
  console.error("Kwaliteitscheck faalt. Los dit op voordat je stopt:\n\n" + failures.join("\n\n"));
  process.exit(2);
}
process.exit(0);
