import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findDiatonicDoubleStopPairs,
  findDoubleStopPairs,
  type DiatonicDoubleStopInterval,
  type DoubleStopStringPairGroup,
  type DoubleStopStringPattern,
} from "../src/utils/domain";

// El mismo golden que usa la app de Flutter (ChordMaster-Free,
// test/fixtures/golden/double_stops.json). Allá se corrigió la 7ª diatónica del
// grado VII (menor, no disminuida) y se regeneraron esas filas; este test
// asegura que el sandbox dice lo mismo, caso por caso.
interface GoldenCase {
  kind: "diatonic" | "fixed";
  key: string;
  interval?: DiatonicDoubleStopInterval;
  distance?: number;
  pattern: DoubleStopStringPattern;
  range: { start: number; end: number };
  rows: unknown[][];
}

const cases: GoldenCase[] = JSON.parse(
  readFileSync(new URL("./fixtures/golden/double_stops.json", import.meta.url), "utf8"),
);

const rows = (groups: DoubleStopStringPairGroup[]): unknown[][] =>
  groups.flatMap((g) =>
    g.pairs.map((p) => [
      g.stringPair[0],
      g.stringPair[1],
      p.root.stringIndex,
      p.root.fret,
      p.interval.stringIndex,
      p.interval.fret,
      p.distance,
      p.intervalQuality,
      p.degree ?? null,
    ]),
  );

describe("double stops: el golden de la app", () => {
  it("118 casos y 1983 filas, iguales a los de la app", () => {
    expect(cases).toHaveLength(118);
    let total = 0;
    for (const c of cases) {
      const groups =
        c.kind === "diatonic"
          ? findDiatonicDoubleStopPairs(c.key, c.interval!, c.range, c.pattern)
          : findDoubleStopPairs(c.key, c.distance!, c.range, c.pattern);
      expect(rows(groups), JSON.stringify({ ...c, rows: undefined })).toEqual(c.rows);
      total += c.rows.length;
    }
    expect(total).toBe(1983);
  });

  it("la 7ª del grado VII en C es menor (B–A), no disminuida (B–G#)", () => {
    const pairs = findDiatonicDoubleStopPairs("C", "7th", { start: 0, end: 12 }).flatMap((g) => g.pairs);
    const seventh = pairs.filter((p) => p.degree === 7);
    expect(seventh.length).toBeGreaterThan(0);
    for (const p of seventh) {
      expect(p.distance).toBe(10);
      expect(p.intervalQuality).toBe("7ª menor");
      expect(p.root.note).toBe("B");
      expect(p.interval.note).toBe("A");
    }
  });
});
