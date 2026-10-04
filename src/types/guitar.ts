import type { Note } from "../data/data";

export type KeySignature = Note;

export type ProgressionLabel =
  | "I-vi-IV-V" | "I-V-vi-IV" | "I-IV-V"
  | "I-vi-ii-V" | "I-IV-vi-V" | "I-IV-I-V"
  | "I-V-vi-iii" | "I-IV-ii-V" | "I-iii-IV-V";
export type ProgressionID = ProgressionLabel
  | "v1-1" | "v1-2" | "v1-3"
  | "v2-1" | "v2-2" | "v2-3"
  | "v3-1" | "v3-2" | "v3-3";

/** Ordinal relativo, ordenado por la región de anclaje del I en la tonalidad activa. */
export type CAGEDPositionIndex = 1 | 2 | 3 | 4 | 5;

export type CAGEDShapeName = "C" | "A" | "G" | "E" | "D";
export type ProgressionDegree = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";
export type FretValue = number | "x";
export type SixStringFretNumbers = readonly [FretValue, FretValue, FretValue, FretValue, FretValue, FretValue];

export interface ProgressionChordShape {
  degree: ProgressionDegree;
  chordName: string;
  /** Traste base indicado para esta digitación. */
  fretNumber: number;
  romanFret: string;
  /** Frets de las cuerdas en orden 6ª a 1ª; x = muteada y 0 = al aire. */
  strings: SixStringFretNumbers;
}

export interface ProgressionPositionShapes {
  positionIndex: CAGEDPositionIndex;
  anchorFret: number;
  cagedShapeName: CAGEDShapeName;
  standardShapes: ProgressionChordShape[];
  alternateShapes: ProgressionChordShape[];
}

export type ProgressionDatabase = Partial<Record<
  KeySignature,
  Partial<Record<ProgressionID, ProgressionPositionShapes[]>>
>>;
