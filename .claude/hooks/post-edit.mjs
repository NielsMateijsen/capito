// PostToolUse-hook: valideert content direct na elke edit, zodat schemafouten meteen terugkomen.
import { readInput, hasScript, run, tail } from "./lib.mjs";

const input = readInput();
const file = String(input.tool_input?.file_path ?? "").replace(/\\/g, "/");

if (!/(^|\/)content\/.+\.(json|md)$/.test(file)) process.exit(0);
if (!hasScript("validate")) process.exit(0);

const r = run("npm", ["run", "-s", "validate"]);
if (!r.ok) {
  console.error(`Content-validatie faalt na wijziging van ${file}:\n\n${tail(r.output)}`);
  process.exit(2);
}
process.exit(0);
