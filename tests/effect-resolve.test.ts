import { describe, expect, it } from "vitest";
import { normalizeEffectName, parsePluginCache } from "../src/tools/effect-resolve.js";

// Real `reg query ...\PluginCache /s` shape captured from Premiere 26.0 with Dehancer Pro 7.4.0 installed (2026-11-09).
const SAMPLE = `
HKEY_CURRENT_USER\\Software\\Adobe\\Premiere Pro\\26.0\\PluginCache\\en_US\\DehancerPro_v7.aex_552cb81d\\AfterEffects Video Filter.0
    AEVideoFilterModule.Index    REG_DWORD    0x0
    Name    REG_SZ    Dehancer Pro  v7.4.0
    MatchName    REG_SZ    AE.Dehancer v7
    Category    REG_SZ    Film Emulation

HKEY_CURRENT_USER\\Software\\Adobe\\Premiere Pro\\26.0\\PluginCache\\en_US\\DehancerPro_v7.aex_552cb81d\\GPUVideoFilter.0
    GPUVideoFilter.MatchName    REG_SZ    AE.Dehancer v7
    Name    REG_SZ    Dehancer Pro  v7.4.0
    MatchName    REG_SZ    AE.Dehancer v7
    Category    REG_SZ    Film Emulation

HKEY_CURRENT_USER\\Software\\Adobe\\Premiere Pro\\26.0\\PluginCache\\en_US\\FilmConvertNitrate.aex_1\\AfterEffects Video Filter.0
    Name    REG_SZ    FilmConvert Nitrate
    MatchName    REG_SZ    AE.FilmConvert Nitrate
`;

describe("effect-resolve", () => {
  it("parses display name, matchName and category per cache key, de-duplicated by matchName", () => {
    const effects = parsePluginCache(SAMPLE);
    expect(effects).toEqual([
      { name: "Dehancer Pro  v7.4.0", matchName: "AE.Dehancer v7", category: "Film Emulation" },
      { name: "FilmConvert Nitrate", matchName: "AE.FilmConvert Nitrate", category: undefined },
    ]);
  });

  it("normalizes spacing and case so 'Dehancer Pro v7.4.0' matches the two-space display name", () => {
    expect(normalizeEffectName("Dehancer Pro v7.4.0")).toBe(normalizeEffectName("Dehancer Pro  v7.4.0"));
  });
});
