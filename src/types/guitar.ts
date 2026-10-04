import type { Note } from "../data/data";

export type KeySignature = Note;

export type ProgressionLabel = "I-vi-IV-V" | "I-V-vi-IV" | "I-IV-V";
export type ProgressionID = ProgressionLabel | "v1-1" | "v1-2" | "v1-3";

/** Ordinal del mapa de cinco posiciones CAGED: 1=C, 2=A, 3=G, 4=E, 5=D. */
export type CAGEDPositionIndex = 1 | 2 | 3 | 4 | 5;

export type CAGEDShapeName = "C" | "A" | "G" | "E" | "D";
export type ProgressionDegree = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";
export type FretValue = number | "x";

export interface ProgressionChordShape {
  degree: ProgressionDegree;
  chordName: string;
  /** Traste base indicado para esta digitación. */
  fretNumber: number;
  romanFret: string;
  /** Frets de las cuerdas en orden 6ª a 1ª; x = muteada y 0 = al aire. */
  strings: readonly FretValue[];
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
