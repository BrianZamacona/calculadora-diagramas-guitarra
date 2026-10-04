import { describe, expect, it } from "vitest";
import { calculateErgonomicCost } from "../src/utils/ergonomicsEngine";
import { calculateVoiceLeadingCost, findOptimalProgressionPath, identifySopranoAndBass, type VoiceLeadingVoicing } from "../src/utils/voiceLeadingEngine";
import { buildOptimalProgressionVoicings, buildProgressionChords } from "../src/utils/chordEngine";

describe("ergonomicsEngine", () => {
  it("rechaza estiramientos fuera del alcance permitido según la zona", () => {
    expect(calculateErgonomicCost({ fretPositions: [1, "x", 5, "x", "x", "x"] })).toBe(Infinity);
    expect(calculateErgonomicCost({ fretPositions: [5, "x", 10, "x", "x", "x"] })).toBe(Infinity);
    expect(Number.isFinite(calculateErgonomicCost({ fretPositions: [12, "x", 17, "x", "x", "x"] }))).toBe(true);
  });

  it("rechaza unísonos MIDI exactos en cuerdas adyacentes salvo permiso explícito", () => {
    const voicing = { fretPositions: [0, 5, "x", "x", "x", "x"] } as const;
    expect(calculateErgonomicCost(voicing)).toBe(Infinity);
    expect(Number.isFinite(calculateErgonomicCost(voicing, { allowAdjacentUnisons: true }))).toBe(true);
  });

  it("mantiene intervalos obligatorios y permite omitir raíz en modo rootless", () => {
    const voicing = { fretPositions: ["x", 0, 9, "x", "x", "x"] } as const;
    const options = { rootPitchClass: 0, requiredIntervals: [0, 4, 11] };
    expect(calculateErgonomicCost(voicing, options)).toBe(Infinity);
    expect(Number.isFinite(calculateErgonomicCost(voicing, { ...options, allowRootless: true }))).toBe(true);
  });

  it("prioriza omitir la quinta justa en acordes densos cuando se usan los cuatro dedos", () => {
    const withFifth = { fretPositions: [6, "x", 7, 5, 7, 8] } as const;
    const withoutFifth = { fretPositions: [6, "x", 7, "x", 7, 8] } as const;
    const options = { rootPitchClass: 0, requiredIntervals: [0, 4, 10, 2], optionalIntervals: [7] };
    expect(calculateErgonomicCost(withoutFifth, options)).toBeLessThan(calculateErgonomicCost(withFifth, options));
  });
});

describe("voiceLeadingEngine", () => {
  it("traduce cuerdas y trastes a MIDI e identifica soprano y bajo", () => {
    const extremes = identifySopranoAndBass({ fretPositions: [12, "x", 9, 10, 7, 8], anchorFret: 7 });
    expect(extremes.soprano).toEqual({ stringIndex: 0, fret: 12, midi: 76 });
    expect(extremes.bass).toEqual({ stringIndex: 5, fret: 8, midi: 48 });
  });

  it("suma el salto cuadrático de soprano y el desplazamiento de traste", () => {
    const previous: VoiceLeadingVoicing = { fretPositions: [3, "x", "x", "x", "x", "x"], anchorFret: 3 };
    const next: VoiceLeadingVoicing = { fretPositions: [5, "x", "x", "x", "x", "x"], anchorFret: 5 };
    expect(calculateVoiceLeadingCost(previous, next)).toBe(8);
  });

  it("bonifica una cuerda al aire retenida entre acordes", () => {
    const previous: VoiceLeadingVoicing = { fretPositions: [0, 3, "x", "x", "x", "x"], anchorFret: 3 };
    const next: VoiceLeadingVoicing = { fretPositions: [0, 4, "x", "x", "x", "x"], anchorFret: 4 };
    expect(calculateVoiceLeadingCost(previous, next)).toBe(0.5);
  });

  it("elige texturas sus2, sus4, add9 y m7 que reducen el salto global de soprano", () => {
    const candidate = (quality: string, fret: number): VoiceLeadingVoicing & { quality: string } => ({
      quality,
      fretPositions: [fret, "x", "x", "x", "x", "x"],
      anchorFret: fret,
      individualCost: 0,
    });
    const alternatives = [candidate("Maj", 20), candidate("sus2", 7), candidate("sus4", 8), candidate("add9", 9), candidate("m7", 10)];
    const laterAlternatives = [candidate("Maj", 21), candidate("sus2", 12), candidate("sus4", 13), candidate("add9", 14), candidate("m7", 8)];
    const path = findOptimalProgressionPath([
      [candidate("G", 3)],
      alternatives,
      laterAlternatives,
    ]);
    expect(path.map((voicing) => (voicing as VoiceLeadingVoicing & { quality: string }).quality)).toEqual(["G", "sus2", "m7"]);
  });

  it("devuelve ruta vacía si una capa no tiene candidatos ergonómicos", () => {
    const impossible: VoiceLeadingVoicing = { fretPositions: [1, "x", 5, "x", "x", "x"], anchorFret: 1 };
    expect(findOptimalProgressionPath([[impossible]])).toEqual([]);
    expect(findOptimalProgressionPath([])).toEqual([]);
  });

  it("integra candidatos ergonómicos en una ruta física I-vi-IV-V", () => {
    const path = buildOptimalProgressionVoicings("C", "v1-1", { maxRawResultsPerPosition: 90, maxCandidatesPerQuality: 8 });
    expect(path).toHaveLength(4);
    expect(path.map((step) => step.degree.numeral)).toEqual(["I", "vi", "IV", "V"]);
    expect(path.every((step) => Number.isFinite(step.ergonomicCost) && step.voicing.fretPositions.length === 6)).toBe(true);
    expect(path.some((step) => ["sus2", "sus4", "add9", "madd9", "min7"].includes(step.chord.quality.id))).toBe(true);

    const theoreticalChords = buildProgressionChords("C", "v1-1");
    const standardPath = buildOptimalProgressionVoicings("C", "v1-1", { includeTexturalAlternatives: false, maxRawResultsPerPosition: 90 });
    expect(standardPath.map((step) => step.chord.name)).toEqual(theoreticalChords.map((chord) => chord.name));
  });
});
