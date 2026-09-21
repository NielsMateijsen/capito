// PreToolUse-hook: blokkeert gevaarlijke acties, ongeacht wat het model besluit.
// Exit 2 = blokkeren; de tekst op stderr gaat terug naar Claude.
import { readInput } from "./lib.mjs";

const input = readInput();
const tool = input.tool_name;
const ti = input.tool_input ?? {};

function block(reason) {
  console.error(`Geblokkeerd door guard-hook: ${reason}`);
  process.exit(2);
}

if (tool === "Bash") {
  const cmd = String(ti.command ?? "");

  // rm -r(f) is alleen toegestaan op bouw- en cachemappen.
  const SAFE = new Set(["node_modules", "dist", "build", "coverage", ".vite", "playwright-report", "test-results"]);
  for (const m of cmd.matchAll(/\brm\s+([^;&|\n]*)/g)) {
    const tokens = m[1].trim().split(/\s+/).filter(Boolean);
    const recursive = tokens.some((t) => /^-[a-zA-Z]*[rR]/.test(t) || t === "--recursive");
    if (!recursive) continue;
    const targets = tokens
      .filter((t) => !t.startsWith("-"))
      .map((t) => t.replace(/^\.\//, "").replace(/\/+$/, ""));
    if (targets.length === 0 || targets.some((t) => !SAFE.has(t))) {
      block("recursief verwijderen is alleen toegestaan voor node_modules, dist, build, coverage, .vite, playwright-report en test-results. Vraag de gebruiker.");
    }
  }

  const rules = [
    [/\bgit\s+push\b[^;&|\n]*(--force\b|--force-with-lease\b|\s-f\b)/, "force-push is niet toegestaan."],
    [/\bgit\s+push\b[^;&|\n]*\s(?:\S+:)?(main|master)(?=\s|$)/, "push nooit direct naar main/master. Werk via een branch; de gebruiker merget."],
    [/\bgit\s+reset\s+--hard\b/, "git reset --hard gooit werk weg. Vraag de gebruiker."],
    [/\bgit\s+clean\s+-[a-zA-Z]*f/, "git clean -f verwijdert bestanden. Vraag de gebruiker."],
    [/\b(curl|wget)\b[^|;\n]*\|\s*(sudo\s+)?(ba)?sh\b/, "geen pipe-naar-shell installaties."],
  ];
  for (const [re, why] of rules) if (re.test(cmd)) block(why);
}

if (["Edit", "Write", "MultiEdit"].includes(tool)) {
  const f = String(ti.file_path ?? "").replace(/\\/g, "/");
  if (/(^|\/)content\/id-registry\.json$/.test(f)) {
    block("content/id-registry.json wordt nooit handmatig bewerkt. Gebruik `npm run validate -- --update-registry`.");
  }
  if (/(^|\/)\.env(\..*)?$/.test(f)) {
    block(".env-bestanden mogen niet door agents worden aangepast.");
  }
}

process.exit(0);
