import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Evaluates the ExtendScript helper that keyframes.ts injects, against a Dehancer-shaped component (section headers follow an
// empty-named separator; names like "Profile" repeat per section). Captured from Dehancer Pro 7.4.0 in Premiere 26.5 on 2026-11-09.
function loadHelper(): (comp: unknown, name: string, index: number | null) => any {
  const src = readFileSync(join(__dirname, "..", "src", "tools", "keyframes.ts"), "utf8");
  const start = src.indexOf("return `", src.indexOf("function effectPropertyPathScript")) + "return `".length;
  const end = src.indexOf("`;", start);
  const extendScript = eval("`" + src.slice(start, end) + "`") as string;
  return new Function("comp", "name", "index", `${extendScript}; return __resolveProp(comp, name, index);`) as any;
}

const names = ["Input", "Source", "", "Film", "Profile", "Enable", "", "Film Grain", "Profile", "Amount", "Enabled"];
const comp = { properties: Object.assign(names.map((displayName) => ({ displayName })), { numItems: names.length }) };

describe("effect property section paths", () => {
  const resolve = loadHelper();

  it("resolves a Section/Name path to exactly one property", () => {
    expect(resolve(comp, "Film Grain/Amount", null).info).toEqual({ index: 9, name: "Amount", section: "Film Grain", path: "Film Grain/Amount" });
    expect(resolve(comp, "Film/Profile", null).info.index).toBe(4);
  });

  it("refuses an ambiguous bare name and lists the candidate paths", () => {
    expect(resolve(comp, "Profile", null).error).toContain("Film/Profile [4], Film Grain/Profile [8]");
  });

  it("keeps unique bare names working and lets property_index override the name", () => {
    expect(resolve(comp, "Amount", null).info.path).toBe("Film Grain/Amount");
    expect(resolve(comp, "ignored", 8).info.path).toBe("Film Grain/Profile");
    expect(resolve(comp, "x", 99).error).toContain("out of range");
  });
});
