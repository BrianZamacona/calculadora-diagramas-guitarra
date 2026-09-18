import { describe, expect, it } from "vitest";
import { clampRange, findCagedMarks, findDoubleStops, findMarks } from "../src/domain";

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
  });

  it("repite la forma CAGED una octava más arriba", () => {
    const marks = findCagedMarks("C", "E", { start: 0, end: 24 });
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((mark) => (mark.fret >= 8 && mark.fret <= 12) || (mark.fret >= 20 && mark.fret <= 24))).toBe(true);
    expect(marks.some((mark) => mark.fret >= 20)).toBe(true);
  });
});