// Gedeelde helpers voor de hooks. Alleen Node-ingebouwde modules, geen dependencies.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (process.env.CLAUDE_PROJECT_DIR) process.chdir(process.env.CLAUDE_PROJECT_DIR);

/** Leest de JSON die Claude Code via stdin meestuurt. */
export function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

/** Bestaat er een npm-script met deze naam? (Handig in fase 0, voordat alles bestaat.) */
export function hasScript(name) {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    return Boolean(pkg.scripts && pkg.scripts[name]);
  } catch {
    return false;
  }
}

export function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function tail(text, max = 3000) {
  return text.length > max ? "...\n" + text.slice(-max) : text;
}

/** Zijn er wijzigingen in code, content of config? Zo niet, dan hoeven we niet te testen. */
export function hasRelevantChanges() {
  const r = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (r.status !== 0) return true; // geen git? liever te veel dan te weinig controleren
  return /^.{2} "?(src\/|content\/|scripts\/|config\/|e2e\/|tests\/|package\.json|tsconfig|vite\.config)/m.test(
    r.stdout
  );
}
