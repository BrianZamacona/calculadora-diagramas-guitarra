import { describe, expect, it } from "vitest";
import { buildChord, clampRange, findChordPositions, findCagedMarks, findDoubleStops, findMarks, findScaleMarks, suggestNoteSets } from "../src/domain";

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

  it("genera variantes de un acorde hasta el traste 12", () => {
    const positions = findChordPositions("C", [0, 4, 7], 12);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((position) => position.end <= 12 && position.marks.length > 0)).toBe(true);
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
});