import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// CLAUDE-NOTE (2026-11-09, hoodtronik: "see if you can operate the dehancer plugin ... if not, extend your mcp capabilities"):
// third-party effects register display names that are easy to get wrong (Dehancer = "Dehancer Pro  v7.4.0", TWO spaces, version in
// the name, which changes on every update) but a stable matchName ("AE.Dehancer v7"). Premiere's own plugin cache in the Windows
// registry maps one to the other, so callers can pass the matchName and we resolve the current display name host-side.
export interface CachedEffect {
  name: string;
  matchName: string;
  category?: string;
}

let cache: CachedEffect[] | null = null;

export function normalizeEffectName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function parsePluginCache(regOutput: string): CachedEffect[] {
  const out: CachedEffect[] = [];
  let current: Partial<CachedEffect> = {};
  const flush = () => {
    if (current.name && current.matchName && !out.some((e) => e.matchName === current.matchName)) {
      out.push({ name: current.name, matchName: current.matchName, category: current.category });
    }
    current = {};
  };
  for (const raw of regOutput.split(/\r?\n/)) {
    if (raw.startsWith("HKEY_")) {
      flush();
      continue;
    }
    const m = raw.match(/^\s+(Name|MatchName|Category)\s+REG_SZ\s+(.*)$/);
    if (!m) continue;
    if (m[1] === "Name") current.name = m[2];
    else if (m[1] === "MatchName") current.matchName = m[2];
    else current.category = m[2];
  }
  flush();
  return out;
}

export async function loadPluginCache(force = false): Promise<CachedEffect[]> {
  if (cache && !force) return cache;
  if (process.platform !== "win32") return (cache = []);
  const found: CachedEffect[] = [];
  try {
    const { stdout: versions } = await execFileAsync("reg", ["query", "HKCU\\Software\\Adobe\\Premiere Pro"], { windowsHide: true });
    const keys = versions.split(/\r?\n/).filter((l) => /\\Premiere Pro\\\d+\.\d+$/.test(l.trim())).sort().reverse();
    for (const key of keys) {
      try {
        const { stdout } = await execFileAsync("reg", ["query", `${key.trim()}\\PluginCache`, "/s"], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
        for (const e of parsePluginCache(stdout)) if (!found.some((f) => f.matchName === e.matchName)) found.push(e);
      } catch {
        /* that Premiere version has no plugin cache */
      }
    }
  } catch {
    /* Premiere not installed for this user */
  }
  return (cache = found);
}

/** Map a matchName (AE.xxx) or a loosely spaced display name to the display name Premiere's QE lookup expects. */
export async function resolveEffectDisplayName(requested: string): Promise<{ name: string; matchName?: string; via: string }> {
  // Only a matchName needs the registry (a full PluginCache scan takes seconds); display-name spacing is handled in the QE catalog scan.
  if (!/^AE\./.test(requested) || process.env.VITEST) return { name: requested, via: "as given" };
  const effects = await loadPluginCache();
  const byMatch = effects.find((e) => e.matchName === requested);
  if (byMatch) return { name: byMatch.name, matchName: byMatch.matchName, via: "plugin-cache matchName" };
  const want = normalizeEffectName(requested);
  const byName = effects.find((e) => normalizeEffectName(e.name) === want);
  if (byName) return { name: byName.name, matchName: byName.matchName, via: "plugin-cache name" };
  return { name: requested, via: "as given" };
}
