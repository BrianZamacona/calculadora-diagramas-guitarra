import { describe, expect, it } from "vitest";
import { buildChord, clampRange, findCagedMarks, findChordVoicings, findDoubleStops, findMarks, findScaleMarks, findVoicingsForIntervals, noteAt, suggestNoteSets } from "../src/domain";

describe("domain musical", () => {
  it("normaliza rangos fuera de los límites del mástil", () => {
    expect(clampRange(-4, 2)).toEqual({ start: 0, end: 3 });
    expect(clampRange(24, 40)).toEqual({ start: 21, end: 24 });
  });

  it("encuentra la raíz C en el traste 8 de la sexta cuerda", () => {
    expect(findMarks("C", [0], { start: 8, end: 8 })).toContainEqual({ stringIndex: 5, fret: 8, note: "C", interval: "1", kind: "root" });
  });

  it("genera double stops con raíz e intervalo", () => {
    const marks = findDoubleStops("C", 4, { start: 0, end: 12 });
    expect(marks.some((mark) => mark.kind === "root")).toBe(true);
    expect(marks.some((mark) => mark.interval === "3")).toBe(true);
    expect(marks.some((mark) => mark.stringIndex === 0)).toBe(true);
  });

  it("acepta el patrón 4NPS y limita sus marcas a una ventana más amplia", () => {
    const marks = findScaleMarks("C", [0, 2, 4, 5, 7, 9, 11], "4nps-0", { start: 0, end: 24 });
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((mark) => mark.fret >= 8 && mark.fret <= 14)).toBe(true);
  });

  it("construye D9 desde mayor, séptima menor y novena", () => {
    const chord = buildChord({ root: "D", base: "major", fifth: "5", seventh: "7", extensions: ["9"], additions: [] });
    expect(chord.name).toBe("D9");
    expect(chord.intervals).toEqual([0, 4, 7, 10, 2]);
    expect(chord.notes).toEqual(["D", "F#", "A", "C", "E"]);
  });

  it("incluye la alteración de quinta en el cifrado", () => {
    expect(buildChord({ root: "C", base: "major", fifth: "b5", seventh: "none", extensions: [], additions: [] }).name).toBe("Cb5");
    expect(buildChord({ root: "C", base: "major", fifth: "#5", seventh: "none", extensions: [], additions: [] }).name).toBe("C#5");
  });

  it("genera varias digitaciones de un acorde en distintas posiciones del mástil", () => {
    const voicings = findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    expect(voicings.length).toBeGreaterThanOrEqual(5);
    const baseFrets = voicings.map((voicing) => voicing.baseFret);
    expect(new Set(baseFrets).size).toBe(baseFrets.length);
    expect(baseFrets).toEqual([...baseFrets].sort((left, right) => left - right));
  });

  it("no duplica la novena al combinarla con una quinta alterada", () => {
    expect(buildChord({ root: "C", base: "major", fifth: "#5", seventh: "7", extensions: ["9"], additions: [] }).name).toBe("C9#5");
  });

  it("sugiere C mayor como coincidencia exacta para sus notas", () => {
    const suggestions = suggestNoteSets(["C", "D", "E", "F", "G", "A", "B"]);
    expect(suggestions.some((suggestion) => suggestion.exact && suggestion.kind === "escala" && suggestion.root === "C" && suggestion.name === "Mayor (Jónico)")).toBe(true);
  });

  it("no confunde una pentatónica con una escala blues sin su blue note", () => {
    const suggestions = suggestNoteSets(["C", "D#", "F", "G", "A#"]);
    const blues = suggestions.find((suggestion) => suggestion.kind === "escala" && suggestion.root === "C" && suggestion.name === "Blues menor");
    expect(blues?.exact).toBe(false);
    expect(blues?.missing).toBe(1);
  });

  it("repite la forma CAGED una octava más arriba", () => {
    const marks = findCagedMarks("C", "E", { start: 0, end: 24 });
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((mark) => (mark.fret >= 8 && mark.fret <= 12) || (mark.fret >= 20 && mark.fret <= 24))).toBe(true);
    expect(marks.some((mark) => mark.fret >= 20)).toBe(true);
  });

  it("nunca suena una nota ajena al acorde ni un bajo distinto de la raíz", () => {
    const voicings = findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    const allowed = new Set(["C", "E", "G"]);
    voicings.forEach((voicing) => {
      let bassString = -1;
      for (let index = 5; index >= 0; index -= 1) { if (voicing.fretPositions[index] !== -1) { bassString = index; break; } }
      expect(bassString).toBeGreaterThanOrEqual(0);
      expect(noteAt(bassString, voicing.fretPositions[bassString] as number)).toBe("C");
      voicing.fretPositions.forEach((fret, stringIndex) => { if (fret !== -1) expect(allowed.has(noteAt(stringIndex, fret))).toBe(true); });
    });
  });

  it("respeta el ancho de 4 trastes y el máximo de 4 dedos (sin contar cejilla) en cada digitación", () => {
    const voicings = findChordVoicings({ root: "G", base: "major", bass: undefined, fifth: "5", seventh: "7M", extensions: ["9"], additions: [] });
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      const fretted = voicing.fretPositions.filter((fret): fret is number => fret > 0);
      if (fretted.length > 0) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      expect(new Set(fretted).size).toBeLessThanOrEqual(4);
    });
  });

  it("ya no devuelve cero digitaciones para acordes con séptima, sexta o tensiones", () => {
    expect(findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "7M", extensions: [], additions: [] }).length).toBeGreaterThan(0);
    expect(findChordVoicings({ root: "A", base: "minor", bass: undefined, fifth: "5", seventh: "7", extensions: [], additions: [] }).length).toBeGreaterThan(0);
    expect(findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "6", extensions: [], additions: [] }).length).toBeGreaterThan(0);
    expect(findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: ["add9"] }).length).toBeGreaterThan(0);
    expect(findChordVoicings({ root: "G", base: "major", bass: undefined, fifth: "5", seventh: "7", extensions: ["9"], additions: [] }).length).toBeGreaterThan(0);
    expect(findChordVoicings({ root: "C", base: "sus4", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] }).length).toBeGreaterThan(0);
  });

  it("marca cejilla al mover una forma movible por el mástil (F mayor, forma E)", () => {
    const voicings = findChordVoicings({ root: "F", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    const barreVoicing = voicings.find((voicing) => voicing.baseFret === 1);
    expect(barreVoicing?.position).toBe("cejilla");
    expect(barreVoicing?.barre?.fret).toBe(1);
    expect(barreVoicing?.barre?.fromString).toBe(0);
    expect(barreVoicing?.barre?.toString).toBe(5);
  });

  it("no omite ninguna nota de un acorde de dos notas (quinta de poder)", () => {
    const voicings = findVoicingsForIntervals("E", [0, 7]);
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      const notes = voicing.fretPositions.reduce<string[]>((acc, fret, stringIndex) => { if (fret !== -1) acc.push(noteAt(stringIndex, fret)); return acc; }, []);
      expect(notes).toContain("E");
      expect(notes).toContain("B");
    });
  });

  it("respeta el bajo explícito de un acorde slash (C/E)", () => {
    const voicings = findVoicingsForIntervals("C", [0, 4, 7], "E");
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      let bassString = -1;
      for (let index = 5; index >= 0; index -= 1) { if (voicing.fretPositions[index] !== -1) { bassString = index; break; } }
      expect(noteAt(bassString, voicing.fretPositions[bassString] as number)).toBe("E");
    });
  });
});