/**
 * cagedTemplates.ts
 * ─────────────────────────────────────────────────────────────
 * Plantillas de desplazamientos relacionales (*Relative Offset Templates*)
 * para las 5 formas del sistema CAGED.
 *
 * Afinación estándar (índices pitch-class):
 *   Cuerda 0 (1ª e): 4   Cuerda 1 (2ª B): 11
 *   Cuerda 2 (3ª G): 7   Cuerda 3 (4ª D): 2
 *   Cuerda 4 (5ª A): 9   Cuerda 5 (6ª E): 4
 *
 * TUNING = [4, 11, 7, 2, 9, 4]  (índice 0 = cuerda más aguda)
 *
 * La tercera menor entre G (idx 2) y B (idx 1) implica que el
 * desplazamiento entre esas cuerdas es de 4 semitonos en lugar
 * de 5, por eso varias formas "bajan" un traste en cuerdas 0 y 1.
 *
 * TrasteAbsoluto = anchorFret + relativeFret
 * donde anchorFret = (rootPitchClass - TUNING[rootString] + 12) % 12
 */

import { TUNING } from "./data";

export type FingerNumber = 1 | 2 | 3 | 4;

/** Un punto de la digitación CAGED expresado en coordenadas relativas al ancla. */
export interface CagedNote {
  /** Índice de cuerda: 0 = 1ª (e), 5 = 6ª (E) */
  string: number;
  /** Desplazamiento de traste respecto al traste ancla de la forma */
  relativeFret: number;
  /** Función interválica del punto (0 = raíz, 4 = 3ª M, 7 = 5ª J, 10 = b7, 11 = 7M, 3 = b3, etc.) */
  interval: number;
  /** Dedo anatómico (1–4); las cuerdas al aire usan fret 0 y las cejillas se describen aparte. */
  finger: FingerNumber;
}

/** Cejilla opcional de la forma: describe la cápsula gráfica. */
export interface CagedBarre {
  /** Traste relativo al ancla donde cae la cejilla */
  relativeFret: number;
  /** Cuerda más grave cubierta (5 = 6ª E) */
  fromString: number;
  /** Cuerda más aguda cubierta (0 = 1ª e) */
  toString: number;
  finger: 1;
}

/** Recorta una cejilla en cuerdas al aire, muteadas o ausentes de la digitación. */
export function clipCagedBarre(
  barre: CagedBarre | undefined,
  anchorFret: number,
  notes: readonly { string: number; fret: number }[],
  mutedStrings: readonly number[],
): CagedBarre | undefined {
  if (!barre || anchorFret + barre.relativeFret <= 0) return undefined;
  const noteByString = new Map(notes.map((note) => [note.string, note]));
  let best: { fromString: number; toString: number; length: number } | undefined;
  let segmentStart: number | undefined;
  let segmentEnd: number | undefined;
  const saveSegment = (): void => {
    if (segmentStart === undefined || segmentEnd === undefined) return;
    const length = segmentStart - segmentEnd + 1;
    if (length >= 2 && (!best || length > best.length)) best = { fromString: segmentStart, toString: segmentEnd, length };
    segmentStart = undefined;
    segmentEnd = undefined;
  };

  for (let string = barre.fromString; string >= barre.toString; string -= 1) {
    const note = noteByString.get(string);
    const canBarre = Boolean(note)
      && !mutedStrings.includes(string)
      && note!.fret > 0
      && note!.fret >= anchorFret + barre.relativeFret;
    if (!canBarre) {
      saveSegment();
      continue;
    }
    segmentStart ??= string;
    segmentEnd = string;
  }
  saveSegment();
  return best ? { ...barre, fromString: best.fromString, toString: best.toString } : undefined;
}

export interface CagedTemplate {
  shape: "C" | "A" | "G" | "E" | "D";
  /** Índice de cuerda donde cae la nota raíz principal */
  rootString: number;
  /** Ventana de trastes relativos visible (start ≤ 0 ≤ end) */
  windowStart: number;
  windowEnd: number;
  /** Puntos de triada mayor */
  major: CagedNote[];
  /** Puntos de triada menor (solo los que difieren de major) */
  minorOverrides: Partial<CagedNote>[];
  /** Digitación menor completa cuando difiere estructuralmente de la forma mayor. */
  minorShape?: CagedNote[];
  /** Digitación min7 y cuerda raíz propias cuando difieren de la forma menor. */
  minor7Shape?: CagedNote[];
  minor7RootString?: number;
  minor7Barre?: CagedBarre;
  /** Barré si aplica */
  barre?: CagedBarre;
  /** Barré específico de la digitación menor; null indica que la forma no lleva cejilla. */
  minorBarre?: CagedBarre | null;
  /** Cuerdas mudas para la forma en posición abierta (array de índices) */
  muted: number[];
}

export type CagedQuality = "major" | "minor" | "dom7" | "Maj7" | "min7";

export function computeCagedAnchorFretForQuality(
  rootPitch: number,
  template: CagedTemplate,
  quality: CagedQuality,
  octaveShift = 0,
): number {
  const rootString = quality === "min7" ? template.minor7RootString ?? template.rootString : template.rootString;
  const anchor = computeAnchorFret(rootPitch, template, octaveShift, rootString);
  const canShiftMinorShape = quality === "minor" && template.shape === "C";
  const canShiftMinor7Shape = quality === "min7" && (template.shape === "C" || template.minor7Shape !== undefined);
  if (!canShiftMinorShape && !canShiftMinor7Shape) return anchor;
  const notes = shapeForQuality(template, quality).notes;
  if (!notes.some((note) => anchor + note.relativeFret < 0)) return anchor;
  const nextOctaveAnchor = anchor + 12;
  return notes.every((note) => nextOctaveAnchor + note.relativeFret >= 0 && nextOctaveAnchor + note.relativeFret <= 24)
    ? nextOctaveAnchor
    : anchor;
}

export interface ResolvedCagedShape {
  notes: Array<{ string: number; fret: number; interval: number; finger: number }>;
  complete: boolean;
  barre?: CagedBarre;
}

// ─── Forma C ──────────────────────────────────────────────────
// Ancla: cuerda 4 (5ª A, pitch 9). Root en A-string.
// Ejemplo: C mayor abierto (ancla en traste 3, A-string=C a traste 3)
const SHAPE_C: CagedTemplate = {
  shape: "C",
  rootString: 4,   // 5ª cuerda A
  windowStart: -3,
  windowEnd: 2,
  major: [
    { string: 4, relativeFret:  0, interval: 0, finger: 3 }, // raíz 5ª (ancla)
    { string: 3, relativeFret: -1, interval: 4, finger: 2 }, // 3M en 4ª cuerda
    { string: 2, relativeFret: -3, interval: 7, finger: 1 }, // 5ª en 3ª cuerda
    { string: 1, relativeFret: -2, interval: 0, finger: 1 }, // raíz en 2ª cuerda
    { string: 0, relativeFret: -3, interval: 4, finger: 1 }, // 3M en 1ª cuerda
  ],
  minorOverrides: [
    { string: 3, relativeFret: -2, interval: 3, finger: 1 }, // la 3.ª mayor propia de la forma C baja a b3
    { string: 1, finger: 2 }, // raíz en B necesita dedo separado de D1 por la cuerda G al aire
    { string: 0, relativeFret: 0, interval: 7, finger: 4 }, // G como quinta en la primera cuerda
  ],
  barre: { relativeFret: -3, fromString: 2, toString: 0, finger: 1 },
  minorBarre: null,
  muted: [5],
};

// ─── Forma A ──────────────────────────────────────────────────
// Ancla: cuerda 4 (5ª A, pitch 9). Root en A-string.
// Ejemplo: A mayor abierto (ancla traste 0) o cejilla en traste N.
const SHAPE_A: CagedTemplate = {
  shape: "A",
  rootString: 4,
  windowStart: 0,
  windowEnd: 4,
  major: [
    { string: 4, relativeFret: 0, interval: 0, finger: 1 }, // raíz 5ª (ancla)
    { string: 3, relativeFret: 2, interval: 7, finger: 3 }, // 5ª en 4ª
    { string: 2, relativeFret: 2, interval: 0, finger: 3 }, // raíz en 3ª
    { string: 1, relativeFret: 2, interval: 4, finger: 3 }, // 3M en 2ª
    { string: 0, relativeFret: 0, interval: 7, finger: 1 }, // 5ª bajo la cejilla
  ],
  minorOverrides: [
    { string: 1, relativeFret: 1, interval: 3, finger: 2 }, // b3 en 2ª cuerda
  ],
  barre: { relativeFret: 0, fromString: 4, toString: 0, finger: 1 },
  muted: [5],
};

// ─── Forma G ──────────────────────────────────────────────────
// Ancla: cuerda 5 (6ª E, pitch 4). Root en E-string.
// Ejemplo: G mayor abierto (ancla traste 3, E-string=G a traste 3).
// Compensación G-B: notas en cuerdas 0 y 1 van un traste más alto.
const SHAPE_G: CagedTemplate = {
  shape: "G",
  rootString: 5,
  windowStart: -3,
  windowEnd: 2,
  major: [
    { string: 5, relativeFret: 0, interval: 0, finger: 3 }, // raíz 6ª, G en traste 3
    { string: 4, relativeFret: -1, interval: 4, finger: 2 }, // 3M, B en traste 2
    { string: 3, relativeFret: -3, interval: 7, finger: 1 }, // 5ª, D al aire / cejilla al mover
    { string: 2, relativeFret: -3, interval: 0, finger: 1 }, // raíz, G al aire / cejilla al mover
    { string: 1, relativeFret: -3, interval: 4, finger: 1 }, // 3M, B al aire / cejilla al mover
    { string: 0, relativeFret: 0, interval: 0, finger: 4 }, // raíz 1ª, G en traste 3
  ],
  minorOverrides: [],
  minorShape: [
    { string: 5, relativeFret: 0, interval: 0, finger: 1 }, // raíz
    { string: 4, relativeFret: 2, interval: 7, finger: 3 }, // 5ª con dedo 3
    { string: 3, relativeFret: 2, interval: 0, finger: 4 }, // raíz con dedo 4
    { string: 2, relativeFret: 0, interval: 3, finger: 1 }, // b3 bajo la cejilla
    { string: 1, relativeFret: 0, interval: 7, finger: 1 }, // 5ª bajo la cejilla
    { string: 0, relativeFret: 0, interval: 0, finger: 1 }, // raíz bajo la cejilla
  ],
  minor7RootString: 2,
  minor7Shape: [
    { string: 3, relativeFret: 0, interval: 7, finger: 3 }, // quinta en D
    { string: 2, relativeFret: 0, interval: 0, finger: 2 }, // raíz en G
    { string: 1, relativeFret: -1, interval: 3, finger: 1 }, // b3 en B
    { string: 0, relativeFret: 1, interval: 10, finger: 4 }, // b7 en e
  ],
  barre: { relativeFret: -3, fromString: 3, toString: 1, finger: 1 },
  minorBarre: { relativeFret: 0, fromString: 5, toString: 0, finger: 1 },
  muted: [],
};

// ─── Forma E ──────────────────────────────────────────────────
// Ancla: cuerda 5 (6ª E, pitch 4). Root en E-string.
// Ejemplo: E mayor abierto (ancla traste 0).
const SHAPE_E: CagedTemplate = {
  shape: "E",
  rootString: 5,
  windowStart: 0,
  windowEnd: 4,
  major: [
    { string: 5, relativeFret: 0, interval: 0,  finger: 1 }, // raíz 6ª (ancla)
    { string: 4, relativeFret: 2, interval: 7,  finger: 3 }, // 5ª en 5ª
    { string: 3, relativeFret: 2, interval: 0,  finger: 4 }, // raíz en 4ª
    { string: 2, relativeFret: 1, interval: 4,  finger: 2 }, // 3M en 3ª cuerda
    { string: 1, relativeFret: 0, interval: 7,  finger: 1 }, // 5ª bajo la cejilla
    { string: 0, relativeFret: 0, interval: 0,  finger: 1 }, // raíz bajo la cejilla
  ],
  minorOverrides: [
    { string: 2, relativeFret: 0, interval: 3, finger: 1 }, // b3
  ],
  barre: { relativeFret: 0, fromString: 5, toString: 0, finger: 1 },
  muted: [],
};

// ─── Forma D ──────────────────────────────────────────────────
// Ancla: cuerda 3 (4ª D, pitch 2). Root en D-string.
// Ejemplo: D mayor abierto (ancla traste 0).
// Compensación G-B: cuerdas 0 y 1 van un traste más alto.
const SHAPE_D: CagedTemplate = {
  shape: "D",
  rootString: 3,
  windowStart: 0,
  windowEnd: 4,
  major: [
    { string: 3, relativeFret: 0, interval: 0, finger: 1 }, // raíz 4ª
    { string: 2, relativeFret: 2, interval: 7, finger: 3 }, // 5ª en 3ª
    { string: 1, relativeFret: 3, interval: 0, finger: 4 }, // raíz 2ª
    { string: 0, relativeFret: 2, interval: 4, finger: 2 }, // 3M en 1ª
  ],
  minorOverrides: [
    { string: 0, relativeFret: 1, interval: 3, finger: 2 }, // b3
  ],
  muted: [5, 4], // cuerdas 6ª y 5ª silenciadas
};

export const CAGED_TEMPLATES: Record<"C" | "A" | "G" | "E" | "D", CagedTemplate> = {
  C: SHAPE_C,
  A: SHAPE_A,
  G: SHAPE_G,
  E: SHAPE_E,
  D: SHAPE_D,
};

/**
 * Calcula el traste ancla para una raíz dada y una forma CAGED.
 * anchorFret = (rootPitch - TUNING[rootString] + 12) % 12
 * Luego se puede desplazar +12 para la octava alta.
 */
export function computeAnchorFret(
  rootPitch: number,
  template: CagedTemplate,
  octaveShift = 0,
  rootString = template.rootString,
): number {
  const openPitch = TUNING[rootString];
  return ((rootPitch - openPitch + 12) % 12) + octaveShift;
}

interface QualityShape {
  notes: CagedNote[];
  barre?: CagedBarre;
}

function shapeForQuality(template: CagedTemplate, quality: CagedQuality): QualityShape {
  let notes = template.major.map((note) => ({ ...note }));
  let barre = template.barre;
  if (quality === "min7" && template.minor7Shape) {
    return { notes: template.minor7Shape.map((note) => ({ ...note })), barre: template.minor7Barre };
  }
  if (quality === "minor" || quality === "min7") {
    notes = template.minorShape
      ? template.minorShape.map((note) => ({ ...note }))
      : applyOverrides(notes, template.minorOverrides);
    barre = template.minorBarre === null ? undefined : template.minorBarre ?? barre;
  }
  if (quality === "dom7" || quality === "Maj7" || quality === "min7") {
    notes = lowerRootToSeventh(notes, template, quality === "Maj7" ? 1 : 2, quality === "Maj7" ? 11 : 10);
  }
  return { notes, barre };
}

/** Devuelve las notas de la forma y señala si hubo que omitir puntos. */
export function resolveCagedShape(
  rootPitch: number,
  template: CagedTemplate,
  quality: CagedQuality = "major",
  octaveShift = 0,
): ResolvedCagedShape {
  const anchor = computeCagedAnchorFretForQuality(rootPitch, template, quality, octaveShift);
  const { notes: shape, barre } = shapeForQuality(template, quality);
  const playable = selectPlayableNotes(shape, template, quality, anchor);
  const notes = playable.notes
    .map((note) => ({
      string: note.string,
      fret: anchor + note.relativeFret,
      interval: note.interval,
      finger: note.finger,
    }))
    .filter((note) => note.fret >= 0 && note.fret <= 24);

  return { notes, complete: playable.complete && notes.length === shape.length, barre };
}

export function resolveCagedNotes(
  rootPitch: number,
  template: CagedTemplate,
  quality: CagedQuality = "major",
  octaveShift = 0,
): Array<{ string: number; fret: number; interval: number; finger: number }> {
  return resolveCagedShape(rootPitch, template, quality, octaveShift).notes;
}

function applyOverrides(notes: CagedNote[], overrides: Partial<CagedNote>[]): CagedNote[] {
  return notes.map((note) => {
    const override = overrides.find((candidate) => candidate.string === note.string);
    return override ? { ...note, ...override } : note;
  });
}

function lowerRootToSeventh(notes: CagedNote[], template: CagedTemplate, fretDrop: number, interval: number): CagedNote[] {
  const rootToLower = notes
    .filter((note) => note.interval === 0 && note.relativeFret - fretDrop >= template.windowStart)
    .sort((left, right) => right.relativeFret - left.relativeFret || left.string - right.string)[0];
  if (!rootToLower) return notes;
  return notes.map((note) => note === rootToLower
    ? { ...note, relativeFret: note.relativeFret - fretDrop, interval }
    : note);
}

function requiredIntervals(quality: CagedQuality): number[] {
  if (quality === "dom7") return [0, 4, 10];
  if (quality === "Maj7") return [0, 4, 11];
  if (quality === "min7") return [0, 3, 10];
  return quality === "minor" ? [0, 3] : [0, 4];
}

function isPlayableShape(notes: readonly CagedNote[], template: CagedTemplate, anchor: number): boolean {
  if (notes.length === 0) return false;
  const relativeFrets = notes.map((note) => note.relativeFret);
  const fretSpan = Math.max(...relativeFrets) - Math.min(...relativeFrets);
  const fingers = new Set(notes.map((note) => note.finger).filter((finger) => finger > 0));
  return fretSpan <= 4
    && fingers.size <= 4
    && notes.every((note) => note.relativeFret >= template.windowStart
      && note.relativeFret <= template.windowEnd
      && anchor + note.relativeFret >= 0
      && anchor + note.relativeFret <= 24);
}

function selectPlayableNotes(notes: CagedNote[], template: CagedTemplate, quality: CagedQuality, anchor: number): { notes: CagedNote[]; complete: boolean } {
  if (isPlayableShape(notes, template, anchor)) return { notes, complete: true };
  const required = requiredIntervals(quality);

  for (let retainedCount = notes.length - 1; retainedCount >= required.length; retainedCount -= 1) {
    for (let mask = 1; mask < 1 << notes.length; mask += 1) {
      const candidate = notes.filter((_, index) => (mask & (1 << index)) !== 0);
      if (candidate.length !== retainedCount) continue;
      if (!required.every((interval) => candidate.some((note) => note.interval === interval))) continue;
      if (isPlayableShape(candidate, template, anchor)) return { notes: candidate, complete: false };
    }
  }

  return { notes: [], complete: false };
}
