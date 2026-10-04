import { NOTES } from "./data";
import type {
  CAGEDPositionIndex,
  CAGEDShapeName,
  KeySignature,
  ProgressionDatabase,
  ProgressionChordShape,
  ProgressionDegree,
  ProgressionID,
  ProgressionLabel,
  ProgressionPositionShapes,
} from "../types/guitar";

interface ChordSeed extends ProgressionChordShape {
  relativeSemitones: number;
}

interface PositionSeed {
  positionIndex: CAGEDPositionIndex;
  anchorFret: number;
  cagedShapeName: CAGEDShapeName;
  standardShapes: ChordSeed[];
  alternateShapes: ChordSeed[];
}

export type ClassicAlternateShapesDatabase = Partial<ProgressionDatabase>;

const DEGREE_SEMITONES: Record<ProgressionDegree, number> = {
  I: 0, ii: 2, iii: 4, IV: 5, V: 7, vi: 9, "vii°": 11,
};

function chordSeed(
  degree: ProgressionDegree,
  chordName: string,
  fretNumber: number,
  romanFret: string,
  strings: ProgressionChordShape["strings"],
): ChordSeed {
  return { degree, chordName, fretNumber, romanFret, strings, relativeSemitones: DEGREE_SEMITONES[degree] };
}

const C_KEY_PROGRESSIONS: Partial<Record<ProgressionLabel, PositionSeed[]>> = {
  "I-vi-IV-V": [{
    positionIndex: 1,
    anchorFret: 0,
    cagedShapeName: "C",
    standardShapes: [
      chordSeed("I", "C", 0, "0", ["x", 3, 2, 0, 1, 0]),
      chordSeed("vi", "Am", 0, "0", ["x", 0, 2, 2, 1, 0]),
      chordSeed("IV", "F", 1, "I", [1, 3, 3, 2, 1, 1]),
      chordSeed("V", "G", 0, "0", [3, 2, 0, 0, 0, 3]),
    ],
    alternateShapes: [
      chordSeed("I", "Csus2", 1, "I", ["x", 3, 0, 0, 1, 3]),
      chordSeed("vi", "Am7", 1, "I", ["x", 0, 2, 0, 1, 0]),
      chordSeed("IV", "FM9", 1, "I", [1, "x", 2, 2, 1, 3]),
      chordSeed("V", "Gsus4", 1, "I", [3, 3, 0, 0, 1, 3]),
    ],
  }],
  "I-V-vi-IV": [
    {
      positionIndex: 1,
      anchorFret: 7,
      cagedShapeName: "G",
      standardShapes: [
        chordSeed("I", "C", 7, "VII", ["x", 10, 9, 7, 8, 7]),
        chordSeed("V", "G", 7, "VII", ["x", 10, 9, 7, 8, 7]),
        chordSeed("vi", "Am", 7, "VII", ["x", 7, 7, 9, 10, 8]),
        chordSeed("IV", "F", 8, "VIII", ["x", 8, 10, 10, 10, 8]),
      ],
      alternateShapes: [
        chordSeed("I", "C", 7, "VII", ["x", 10, 9, 7, 8, 7]),
        chordSeed("V", "G", 7, "VII", ["x", 10, 9, 7, 8, 7]),
        chordSeed("vi", "Am", 7, "VII", ["x", 7, 7, 9, 10, 8]),
        chordSeed("IV", "Fsus4", 7, "VII", [8, "x", 8, 10, 8, 8]),
      ],
    },
    {
      positionIndex: 3,
      anchorFret: 3,
      cagedShapeName: "C",
      standardShapes: [
        chordSeed("I", "C", 3, "III", ["x", 3, 2, 0, 1, 0]),
        chordSeed("V", "G", 3, "III", [3, 2, 0, 0, 0, 3]),
        chordSeed("vi", "Am", 3, "III", ["x", 0, 2, 2, 1, 0]),
        chordSeed("IV", "F", 8, "VIII", ["x", 8, 10, 10, 10, 8]),
      ],
      alternateShapes: [
        chordSeed("I", "C", 3, "III", ["x", 3, 2, 0, 1, 0]),
        chordSeed("V", "Gsus4", 3, "III", [3, 2, 0, 0, 1, 3]),
        chordSeed("vi", "Am7", 3, "III", ["x", 0, 2, 0, 1, 0]),
        chordSeed("IV", "FM9", 3, "III", ["x", 3, 3, 0, 1, 0]),
      ],
    },
  ],
  "I-IV-V": [{
    positionIndex: 1,
    anchorFret: 0,
    cagedShapeName: "C",
    standardShapes: [
      chordSeed("I", "C", 0, "0", ["x", 3, 2, 0, 1, 0]),
      chordSeed("IV", "F", 1, "I", [1, 3, 3, 2, 1, 1]),
      chordSeed("V", "G", 0, "0", [3, 2, 0, 0, 0, 3]),
    ],
    alternateShapes: [
      chordSeed("I", "Cadd9", 1, "I", ["x", 3, 2, 0, 3, 3]),
      chordSeed("IV", "FM9", 1, "I", [1, "x", 2, 2, 1, 3]),
      chordSeed("V", "Gsus4", 1, "I", [3, 3, 0, 0, 1, 3]),
    ],
  }],
};

const PROGRESSION_ALIASES: Partial<Record<ProgressionID, ProgressionLabel>> = {
  "I-vi-IV-V": "I-vi-IV-V",
  "I-V-vi-IV": "I-V-vi-IV",
  "I-IV-V": "I-IV-V",
  "v1-1": "I-vi-IV-V",
  "v1-2": "I-V-vi-IV",
  "v1-3": "I-IV-V",
};

const ROMAN_FRETS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];

function transposeChordShape(seed: ChordSeed, key: KeySignature, shift: number): ProgressionChordShape {
  const referenceRoot = NOTES[seed.relativeSemitones];
  const suffix = seed.chordName.slice(referenceRoot.length);
  const root = NOTES[(NOTES.indexOf(key) + seed.relativeSemitones) % NOTES.length];
  const strings = seed.strings.map((fret) => fret === "x" ? "x" : fret + shift);
  const fretNumber = seed.fretNumber + shift;
  return {
    degree: seed.degree,
    chordName: `${root}${suffix}`,
    fretNumber,
    romanFret: ROMAN_FRETS[fretNumber] ?? String(fretNumber),
    strings,
  };
}

function transposePosition(position: PositionSeed, key: KeySignature): ProgressionPositionShapes {
  const shift = NOTES.indexOf(key);
  return {
    ...position,
    anchorFret: position.anchorFret + shift,
    standardShapes: position.standardShapes.map((shape) => transposeChordShape(shape, key, shift)),
    alternateShapes: position.alternateShapes.map((shape) => transposeChordShape(shape, key, shift)),
  };
}

function buildKeyData(key: KeySignature): Partial<Record<ProgressionID, ProgressionPositionShapes[]>> {
  return Object.fromEntries(
    Object.entries(C_KEY_PROGRESSIONS).map(([progression, positions]) => [
      progression,
      positions?.map((position) => transposePosition(position, key)),
    ]),
  ) as Partial<Record<ProgressionID, ProgressionPositionShapes[]>>;
}

export const CLASSIC_ALTERNATE_SHAPES_DB: Partial<ProgressionDatabase> = Object.fromEntries(
  NOTES.map((key) => [key, buildKeyData(key)]),
) as Partial<ProgressionDatabase>;

export function getAlternateShapeData(
  key: KeySignature,
  progressionId: ProgressionID,
  position: CAGEDPositionIndex,
): ProgressionChordShape[] | null {
  const progression = PROGRESSION_ALIASES[progressionId];
  if (!progression) return null;
  const positionData = CLASSIC_ALTERNATE_SHAPES_DB[key]?.[progression]?.find((item) => item.positionIndex === position);
  return positionData?.alternateShapes ?? null;
}
