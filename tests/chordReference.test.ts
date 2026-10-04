import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAGED_TEMPLATES, resolveCagedShape, type CagedQuality, type CagedTemplate } from "../src/data/cagedTemplates";
import { NOTES, TUNING, type Note } from "../src/data/data";

interface ChordReferenceFixture {
  root: Note;
  quality: CagedQuality;
  shape: keyof typeof CAGED_TEMPLATES;
  expectedFrets: Array<number | null>;
}

interface FormulaCheck {
  intervals: number[];
  unexpectedIntervals: number[];
  missingRequiredIntervals: number[];
  isMusicallyCorrect: boolean;
}

interface VoicingDivergence {
  shape: ChordReferenceFixture["shape"];
  root: Note;
  quality: CagedQuality;
  generatedFrets: Array<number | null>;
  documentFrets: Array<number | null>;
  generated: FormulaCheck;
  document: FormulaCheck;
}

const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/chord-reference/caged-positions.json", import.meta.url), "utf8"),
) as ChordReferenceFixture[];

const QUALITY_INTERVALS: Record<CagedQuality, { chord: readonly number[]; required: readonly number[] }> = {
  major: { chord: [0, 4, 7], required: [0, 4] },
  minor: { chord: [0, 3, 7], required: [0, 3] },
  dom7: { chord: [0, 4, 7, 10], required: [0, 4, 10] },
  Maj7: { chord: [0, 4, 7, 11], required: [0, 4, 11] },
  min7: { chord: [0, 3, 7, 10], required: [0, 3, 10] },
};

function fretVectorFromResolvedShape(notes: ReturnType<typeof resolveCagedShape>["notes"]): Array<number | null> {
  const frets: Array<number | null> = Array(6).fill(null);
  notes.forEach((note) => { frets[5 - note.string] = note.fret; });
  return frets;
}

function formulaCheck(frets: readonly (number | null)[], root: Note, quality: CagedQuality): FormulaCheck {
  const rootPitch = NOTES.indexOf(root);
  const intervals = [...new Set(frets.flatMap((fret, tabIndex) => {
    if (fret === null) return [];
    const stringIndex = 5 - tabIndex;
    return [(TUNING[stringIndex] + fret - rootPitch + 12) % 12];
  }))].sort((left, right) => left - right);
  const definition = QUALITY_INTERVALS[quality];
  const unexpectedIntervals = intervals.filter((interval) => !definition.chord.includes(interval));
  const missingRequiredIntervals = definition.required.filter((interval) => !intervals.includes(interval));
  return {
    intervals,
    unexpectedIntervals,
    missingRequiredIntervals,
    isMusicallyCorrect: unexpectedIntervals.length === 0 && missingRequiredIntervals.length === 0,
  };
}

function sameFrets(left: readonly (number | null)[], right: readonly (number | null)[]): boolean {
  return left.length === right.length && left.every((fret, index) => fret === right[index]);
}

function formatFrets(frets: readonly (number | null)[]): string {
  return frets.map((fret) => fret === null ? "x" : String(fret)).join("-");
}

function formatDivergence(divergence: VoicingDivergence): string {
  return `${divergence.root} ${divergence.quality} forma ${divergence.shape}: código ${formatFrets(divergence.generatedFrets)} [${divergence.generated.intervals.join(",")}] vs documento ${formatFrets(divergence.documentFrets)} [${divergence.document.intervals.join(",")}]`;
}

describe("CAGED chord references", () => {
  it("compares every extracted fixture and reports every voicing divergence", () => {
    expect(fixtures).toHaveLength(75);
    const codeIntervalErrors: VoicingDivergence[] = [];
    const codeWithoutVoicing: VoicingDivergence[] = [];
    const validVoicingVariants: VoicingDivergence[] = [];
    const inconsistentDocumentReferences: VoicingDivergence[] = [];

    fixtures.forEach((fixture) => {
      const rootPitch = NOTES.indexOf(fixture.root);
      const octaveResults = [0, 12].map((octaveShift) =>
        resolveCagedShape(rootPitch, CAGED_TEMPLATES[fixture.shape], fixture.quality, octaveShift),
      );
      const resolved = octaveResults.find((result) => result.notes.length > 0) ?? octaveResults[0];
      const generatedFrets = fretVectorFromResolvedShape(resolved.notes);
      if (sameFrets(generatedFrets, fixture.expectedFrets)) return;

      const divergence: VoicingDivergence = {
        shape: fixture.shape,
        root: fixture.root,
        quality: fixture.quality,
        generatedFrets,
        documentFrets: fixture.expectedFrets,
        generated: formulaCheck(generatedFrets, fixture.root, fixture.quality),
        document: formulaCheck(fixture.expectedFrets, fixture.root, fixture.quality),
      };
      if (generatedFrets.every((fret) => fret === null)) codeWithoutVoicing.push(divergence);
      else if (!divergence.generated.isMusicallyCorrect) codeIntervalErrors.push(divergence);
      else if (divergence.document.isMusicallyCorrect) validVoicingVariants.push(divergence);
      else inconsistentDocumentReferences.push(divergence);
    });

    const report = [
      `CAGED comparison: ${fixtures.length} fixtures; ${codeIntervalErrors.length + codeWithoutVoicing.length + validVoicingVariants.length + inconsistentDocumentReferences.length} divergences.`,
      `\nCódigo con notas de intervalos incorrectos (${codeIntervalErrors.length}):`,
      ...codeIntervalErrors.map(formatDivergence),
      `\nCódigo sin voicing generado (${codeWithoutVoicing.length}):`,
      ...codeWithoutVoicing.map(formatDivergence),
      `\nVariante de voicing: ambos musicalmente correctos (${validVoicingVariants.length}):`,
      ...validVoicingVariants.map(formatDivergence),
      `\nReferencia documental incompatible con la fórmula (${inconsistentDocumentReferences.length}):`,
      ...inconsistentDocumentReferences.map(formatDivergence),
    ].join("\n");
    console.info(report);
    expect(codeIntervalErrors.map(formatDivergence), report).toEqual([]);
    expect(codeWithoutVoicing.map(formatDivergence), report).toEqual([]);
  });
});
