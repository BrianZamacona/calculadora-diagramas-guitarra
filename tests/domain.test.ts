import { describe, expect, it } from "vitest";
import { buildChord, clampRange, findCagedMarks, findChordVoicings, findDoubleStopPairs, findMarks, findScaleMarks, findVoicingsForIntervals, noteAt, noteIndex, suggestNoteSets } from "../src/utils/domain";
import { maxFretSpanForPosition } from "../src/utils/ergonomicsEngine";

describe("domain musical", () => {
  it("normaliza rangos fuera de los límites del mástil", () => {
    expect(clampRange(-4, 2)).toEqual({ start: 0, end: 3 });
    expect(clampRange(24, 40)).toEqual({ start: 21, end: 24 });
  });

  it("encuentra la raíz C en el traste 8 de la sexta cuerda", () => {
    expect(findMarks("C", [0], { start: 8, end: 8 })).toContainEqual({ stringIndex: 5, fret: 8, note: "C", interval: "1", kind: "root" });
  });

  it("genera parejas de double stops con la distancia ascendente exacta", () => {
    const pairs = findDoubleStopPairs("C", 4, { start: 0, end: 12 });
    const openStringMidi = [64, 59, 55, 50, 45, 40];
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every(({ root, interval }) => openStringMidi[interval.stringIndex] + interval.fret - openStringMidi[root.stringIndex] - root.fret === 4)).toBe(true);
    expect(pairs).toContainEqual({
      root: { stringIndex: 2, fret: 5, note: "C", interval: "1", kind: "root" },
      interval: { stringIndex: 0, fret: 0, note: "E", interval: "3", kind: "chord" },
    });
  });

  it("no acepta como tercera mayor una nota al aire que queda debajo de la raíz", () => {
    const pairs = findDoubleStopPairs("C", 4, { start: 0, end: 24 });
    expect(pairs).not.toContainEqual(expect.objectContaining({
      root: expect.objectContaining({ stringIndex: 2, fret: 17, note: "C" }),
      interval: expect.objectContaining({ stringIndex: 0, fret: 0, note: "E" }),
    }));
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

  it("incluye posiciones altas sin exceder el alcance ergonómico de trastes XII-XXIV", () => {
    const voicings = findChordVoicings({ root: "C", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    const upperPositions = voicings.filter((voicing) => voicing.baseFret >= 12);
    expect(upperPositions.length).toBeGreaterThan(0);
    upperPositions.forEach((voicing) => {
      const fretted = voicing.fretPositions.filter((fret): fret is number => typeof fret === "number" && fret > 0);
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(5);
    });
  });

  it("puede generar voicings de referencia de las guías A, C, D, E y G", () => {
    const references = [
      { root: "A", base: "major", bass: "E", frets: [0, 2, 2, 2, 0, 0] },
      { root: "C", base: "sus2", bass: undefined, frets: [8, 8, 7, 10, "x", "x"] },
      { root: "D", base: "minor", bass: undefined, frets: [1, 3, 2, 0, "x", "x"] },
      { root: "E", base: "major", bass: undefined, frets: [0, 0, 1, 2, 2, 0] },
    ] as const;

    references.forEach((reference) => {
      const voicings = findChordVoicings({
        root: reference.root,
        base: reference.base,
        bass: reference.bass,
        fifth: "5",
        seventh: "none",
        extensions: [],
        additions: [],
      });
      expect(voicings.some((voicing) => voicing.fretPositions.join(",") === reference.frets.join(",")), `${reference.root}: ${voicings.map((voicing) => voicing.fretPositions.join(",")).join(" | ")}`).toBe(true);
    });

    const gMajorVoicings = findChordVoicings({ root: "G", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    expect(gMajorVoicings.length).toBeGreaterThan(0);
    gMajorVoicings.forEach((voicing) => voicing.fretPositions.forEach((fret, string) => {
      if (fret === "x") return;
      const interval = (noteIndex(noteAt(string, fret)) - noteIndex("G") + 12) % 12;
      expect([0, 4, 7]).toContain(interval);
    }));
  });

  it("asigna una cejilla parcial y dedos separados a Csus2 en traste VII", () => {
    const voicings = findChordVoicings({ root: "C", base: "sus2", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] });
    const voicing = voicings.find((candidate) => candidate.baseFret === 7);
    expect(voicing?.fretPositions).toEqual([8, 8, 7, 10, "x", "x"]);
    expect(voicing?.barre).toEqual({ fret: 8, fromString: 0, toString: 1 });
    expect(voicing?.fingerPositions).toEqual([2, 2, 1, 3, 0, 0]);
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
      for (let index = 5; index >= 0; index -= 1) { if (voicing.fretPositions[index] !== "x") { bassString = index; break; } }
      expect(bassString).toBeGreaterThanOrEqual(0);
      expect(noteAt(bassString, voicing.fretPositions[bassString] as number)).toBe("C");
      voicing.fretPositions.forEach((fret, stringIndex) => { if (fret !== "x") expect(allowed.has(noteAt(stringIndex, fret))).toBe(true); });
    });
  });

  it("respeta el alcance ergonómico por zona y el máximo de 4 dedos", () => {
    const voicings = findChordVoicings({ root: "G", base: "major", bass: undefined, fifth: "5", seventh: "7M", extensions: ["9"], additions: [] });
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      const fretted = voicing.fretPositions.filter((fret): fret is number => typeof fret === "number" && fret > 0);
      if (fretted.length > 0) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(maxFretSpanForPosition(voicing.baseFret));
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
    expect(barreVoicing?.fretPositions).toEqual([1, 1, 2, 3, 3, 1]);
    expect(barreVoicing?.position).toBe("cejilla");
    expect(barreVoicing?.barre?.fret).toBe(1);
    expect(barreVoicing?.barre?.fromString).toBe(0);
    expect(barreVoicing?.barre?.toString).toBe(5);
  });

  it("no omite ninguna nota de un acorde de dos notas (quinta de poder)", () => {
    const voicings = findVoicingsForIntervals("E", [0, 7]);
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      const notes = voicing.fretPositions.reduce<string[]>((acc, fret, stringIndex) => { if (fret !== "x") acc.push(noteAt(stringIndex, fret)); return acc; }, []);
      expect(notes).toContain("E");
      expect(notes).toContain("B");
    });
  });

  it("respeta el bajo explícito de un acorde slash (C/E)", () => {
    const voicings = findVoicingsForIntervals("C", [0, 4, 7], "E");
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      let bassString = -1;
      for (let index = 5; index >= 0; index -= 1) { if (voicing.fretPositions[index] !== "x") { bassString = index; break; } }
      expect(noteAt(bassString, voicing.fretPositions[bassString] as number)).toBe("E");
    });
  });
});