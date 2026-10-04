/**
 * chordEngine.ts
 * ─────────────────────────────────────────────────────────────
 * Motor de generación de voicings y progresiones CAGED.
 *
 * Genera más de 2,280 combinaciones de acordes transponibles:
 *  - Triadas y 7mas: Maj, Min, Dim, Aug, Sus2, Sus4, Maj7, Dom7,
 *    Min7, m7b5, Dim7.
 *  - Voicings especiales: Drop 2, Drop 3, Shell Voicings (1-3-7),
 *    Extensiones (9, 11, 13).
 *  - Progresiones Vol. 1, 2 y 3 (Roman-numeral based).
 *  - Alternate shapes: sus2, sus4, add2, m11, M9.
 */

import { NOTES, type Note } from "../data/data";
import { addInterval, MusicNote } from "./domain";
import { CAGED_TEMPLATES, computeAnchorFret, resolveCagedShape, type CagedQuality, type CagedTemplate } from "../data/cagedTemplates";
import { getAlternateShapeData } from "../data/alternateShapesData";
import type { CAGEDPositionIndex, ProgressionChordShape, ProgressionID } from "../types/guitar";

// ─── Tipos base ────────────────────────────────────────────────

export type ChordQualityId =
  | "Maj" | "min" | "dim" | "aug" | "sus2" | "sus4"
  | "Maj7" | "dom7" | "min7" | "m7b5" | "dim7"
  | "Maj9" | "dom9" | "min9" | "Maj11" | "dom11" | "min11"
  | "Maj13" | "dom13" | "min13"
  | "add9" | "add11" | "madd9"
  | "drop2_Maj7" | "drop2_min7" | "drop2_dom7"
  | "drop3_Maj7" | "drop3_min7"
  | "shell_Maj7" | "shell_min7" | "shell_dom7";

export type CagedShapeId = "C" | "A" | "G" | "E" | "D";
export type CagedTemplateQuality = CagedQuality;
const CAGED_POSITION_BY_SHAPE: Record<CagedShapeId, CAGEDPositionIndex> = { C: 1, A: 2, G: 3, E: 4, D: 5 };
export type ChordVoicingLayout =
  | { kind: "shell" }
  | { kind: "drop2"; sourceQuality: "Maj7" | "min7" | "dom7" }
  | { kind: "drop3"; sourceQuality: "Maj7" | "min7" };

export function toRomanFret(fret: number): string {
  if (!Number.isInteger(fret) || fret <= 0) return String(fret);
  const values: ReadonlyArray<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = fret;
  let roman = "";
  for (const [value, symbol] of values) {
    while (remaining >= value) {
      roman += symbol;
      remaining -= value;
    }
  }
  return roman;
}

const CAGED_QUALITY_BY_CHORD_ID: Partial<Record<ChordQualityId, CagedTemplateQuality>> = {
  Maj: "major",
  min: "minor",
  dom7: "dom7",
  Maj7: "Maj7",
  min7: "min7",
};

export function cagedTemplateQualityForChord(qualityId: ChordQualityId): CagedTemplateQuality {
  return CAGED_QUALITY_BY_CHORD_ID[qualityId] ?? (CHORD_QUALITIES[qualityId].intervals.includes(3) ? "minor" : "major");
}

export function cagedTemplateQualityForSelection(qualityId: string): CagedTemplateQuality {
  const direct: Record<string, CagedTemplateQuality> = {
    Maj: "major", min: "minor", dom7: "dom7", Maj7: "Maj7", min7: "min7",
  };
  if (direct[qualityId]) return direct[qualityId];
  const mappedQualityId = cagedQualityToEngine(qualityId);
  return cagedTemplateQualityForChord(mappedQualityId);
}

/** Definición de un tipo de acorde */
export interface ChordQuality {
  id: ChordQualityId;
  label: string;
  /** Familia a la que pertenece */
  family: "triada" | "septima" | "extension" | "voicing" | "alternativo";
  /** Intervalos obligatorios en semitonos */
  intervals: number[];
  /** Intervalos opcionales (color) */
  optional?: number[];
  voicingLayout?: ChordVoicingLayout;
  symbol: string;
}

// ─── Definiciones de calidades ─────────────────────────────────

export const CHORD_QUALITIES: Record<ChordQualityId, ChordQuality> = {
  // Triadas
  Maj: { id: "Maj", label: "Mayor", family: "triada", intervals: [0, 4, 7], symbol: "" },
  min: { id: "min", label: "Menor", family: "triada", intervals: [0, 3, 7], symbol: "m" },
  dim: { id: "dim", label: "Disminuido", family: "triada", intervals: [0, 3, 6], symbol: "dim" },
  aug: { id: "aug", label: "Aumentado", family: "triada", intervals: [0, 4, 8], symbol: "aug" },
  sus2: { id: "sus2", label: "Suspendido 2", family: "triada", intervals: [0, 2, 7], symbol: "sus2" },
  sus4: { id: "sus4", label: "Suspendido 4", family: "triada", intervals: [0, 5, 7], symbol: "sus4" },

  // Séptimas
  Maj7: { id: "Maj7", label: "Mayor 7", family: "septima", intervals: [0, 4, 7, 11], symbol: "maj7" },
  dom7: { id: "dom7", label: "Dominante 7", family: "septima", intervals: [0, 4, 7, 10], symbol: "7" },
  min7: { id: "min7", label: "Menor 7", family: "septima", intervals: [0, 3, 7, 10], symbol: "m7" },
  m7b5: { id: "m7b5", label: "Semidisminuido", family: "septima", intervals: [0, 3, 6, 10], symbol: "m7b5" },
  dim7: { id: "dim7", label: "Disminuido 7", family: "septima", intervals: [0, 3, 6, 9], symbol: "dim7" },

  // Extensiones
  Maj9: { id: "Maj9", label: "Mayor 9", family: "extension", intervals: [0, 4, 11], optional: [7, 2], symbol: "maj9" },
  dom9: { id: "dom9", label: "Dominante 9", family: "extension", intervals: [0, 4, 10, 2], optional: [7], symbol: "9" },
  min9: { id: "min9", label: "Menor 9", family: "extension", intervals: [0, 3, 10, 2], optional: [7], symbol: "m9" },
  Maj11: { id: "Maj11", label: "Mayor 11", family: "extension", intervals: [0, 4, 11, 2, 5], optional: [7], symbol: "maj11" },
  dom11: { id: "dom11", label: "Dominante 11", family: "extension", intervals: [0, 10, 2, 5], optional: [4, 7], symbol: "11" },
  min11: { id: "min11", label: "Menor 11", family: "extension", intervals: [0, 3, 10, 2, 5], optional: [7], symbol: "m11" },
  Maj13: { id: "Maj13", label: "Mayor 13", family: "extension", intervals: [0, 4, 11, 9], optional: [7, 2], symbol: "maj13" },
  dom13: { id: "dom13", label: "Dominante 13", family: "extension", intervals: [0, 4, 10, 9], optional: [7, 2], symbol: "13" },
  min13: { id: "min13", label: "Menor 13", family: "extension", intervals: [0, 3, 10, 9], optional: [7, 2], symbol: "m13" },

  // Voicings especiales
  add9: { id: "add9", label: "Add 9", family: "alternativo", intervals: [0, 4, 7, 2], symbol: "add9" },
  add11: { id: "add11", label: "Add 11", family: "alternativo", intervals: [0, 4, 7, 5], symbol: "add11" },
  madd9: { id: "madd9", label: "Menor add 9", family: "alternativo", intervals: [0, 3, 7, 2], symbol: "madd9" },
  drop2_Maj7: { id: "drop2_Maj7", label: "Drop 2 — Maj7", family: "voicing", intervals: [0, 4, 11, 7], voicingLayout: { kind: "drop2", sourceQuality: "Maj7" }, symbol: "maj7 Drop2" },
  drop2_min7: { id: "drop2_min7", label: "Drop 2 — min7", family: "voicing", intervals: [0, 3, 10, 7], voicingLayout: { kind: "drop2", sourceQuality: "min7" }, symbol: "m7 Drop2" },
  drop2_dom7: { id: "drop2_dom7", label: "Drop 2 — dom7", family: "voicing", intervals: [0, 4, 10, 7], voicingLayout: { kind: "drop2", sourceQuality: "dom7" }, symbol: "7 Drop2" },
  drop3_Maj7: { id: "drop3_Maj7", label: "Drop 3 — Maj7", family: "voicing", intervals: [0, 11, 4, 7], voicingLayout: { kind: "drop3", sourceQuality: "Maj7" }, symbol: "maj7 Drop3" },
  drop3_min7: { id: "drop3_min7", label: "Drop 3 — min7", family: "voicing", intervals: [0, 10, 3, 7], voicingLayout: { kind: "drop3", sourceQuality: "min7" }, symbol: "m7 Drop3" },
  shell_Maj7: { id: "shell_Maj7", label: "Shell — Maj7", family: "voicing", intervals: [0, 4, 11], voicingLayout: { kind: "shell" }, symbol: "maj7 Shell" },
  shell_min7: { id: "shell_min7", label: "Shell — min7", family: "voicing", intervals: [0, 3, 10], voicingLayout: { kind: "shell" }, symbol: "m7 Shell" },
  shell_dom7: { id: "shell_dom7", label: "Shell — dom7", family: "voicing", intervals: [0, 4, 10], voicingLayout: { kind: "shell" }, symbol: "7 Shell" },
};

// ─── Progresiones ──────────────────────────────────────────────

export type RomanNumeral = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";

/** Un grado de la progresión: qué traste relativo y qué calidad. */
export interface ProgressionDegree {
  numeral: RomanNumeral;
  /** Grado diatónico desde la tónica (0 = I) */
  steps: number;
  /** Semitonos desde la tónica */
  semitones: number;
  quality: ChordQualityId;
}

export interface Progression {
  id: string;
  label: string;
  volume: 1 | 2 | 3;
  degrees: ProgressionDegree[];
}

/** Grados diatónicos mayores (semitones desde la tónica) */
const MAJOR_SCALE_DEGREES: Record<RomanNumeral, { steps: number; semitones: number; quality: ChordQualityId }> = {
  "I": { steps: 0, semitones: 0, quality: "Maj" },
  "ii": { steps: 1, semitones: 2, quality: "min" },
  "iii": { steps: 2, semitones: 4, quality: "min" },
  "IV": { steps: 3, semitones: 5, quality: "Maj" },
  "V": { steps: 4, semitones: 7, quality: "Maj" },
  "vi": { steps: 5, semitones: 9, quality: "min" },
  "vii°": { steps: 6, semitones: 11, quality: "dim" },
};

function buildProgression(
  id: string,
  label: string,
  volume: 1 | 2 | 3,
  numerals: RomanNumeral[],
): Progression {
  return {
    id,
    label,
    volume,
    degrees: numerals.map((numeral) => ({
      numeral,
      steps: MAJOR_SCALE_DEGREES[numeral].steps,
      semitones: MAJOR_SCALE_DEGREES[numeral].semitones,
      quality: MAJOR_SCALE_DEGREES[numeral].quality,
    })),
  };
}

export const PROGRESSIONS: Progression[] = [
  // Vol. 1
  buildProgression("v1-1", "I - vi - IV - V", 1, ["I", "vi", "IV", "V"]),
  buildProgression("v1-2", "I - V - vi - IV", 1, ["I", "V", "vi", "IV"]),
  buildProgression("v1-3", "I - IV - V", 1, ["I", "IV", "V"]),
  // Vol. 2
  buildProgression("v2-1", "I - vi - ii - V", 2, ["I", "vi", "ii", "V"]),
  buildProgression("v2-2", "I - IV - vi - V", 2, ["I", "IV", "vi", "V"]),
  buildProgression("v2-3", "I - IV - I - V", 2, ["I", "IV", "I", "V"]),
  // Vol. 3
  buildProgression("v3-1", "I - V - vi - iii", 3, ["I", "V", "vi", "iii"]),
  buildProgression("v3-2", "I - IV - ii - V", 3, ["I", "IV", "ii", "V"]),
  buildProgression("v3-3", "I - iii - IV - V", 3, ["I", "iii", "IV", "V"]),
];

// ─── Shapes alternos ───────────────────────────────────────────

/** Sustitución de calidad: reemplaza la calidad estándar de un grado por una alternativa */
export type AlternateShapeId = "sus2" | "sus4" | "add9" | "min11" | "Maj9";

export type AlternateDegreeMatrix = Partial<Record<RomanNumeral, Partial<Record<AlternateShapeId, ChordQualityId>>>>;
export type AlternateShapeMatrix = Partial<Record<Note, Partial<Record<string, Partial<Record<CagedShapeId, AlternateDegreeMatrix>>>>>>;

function alternateQualityForDegree(qualityId: ChordQualityId, alternate: AlternateShapeId): ChordQualityId | undefined {
  if (qualityId !== "Maj" && qualityId !== "min") return undefined;
  switch (alternate) {
    case "sus2":
    case "sus4":
      return alternate;
    case "add9":
      return qualityId === "Maj" ? "add9" : "madd9";
    case "min11":
      return qualityId === "Maj" ? "Maj11" : "min11";
    case "Maj9":
      return qualityId === "Maj" ? "Maj9" : "min9";
  }
}

function alternateOptionsForDegree(qualityId: ChordQualityId): Partial<Record<AlternateShapeId, ChordQualityId>> {
  const options: Partial<Record<AlternateShapeId, ChordQualityId>> = {};
  const alternates: AlternateShapeId[] = ["sus2", "sus4", "add9", "min11", "Maj9"];
  for (const alternate of alternates) {
    const quality = alternateQualityForDegree(qualityId, alternate);
    if (quality) options[alternate] = quality;
  }
  return options;
}

function alternateShapeMatrixForProgression(progression: Progression): Partial<Record<CagedShapeId, AlternateDegreeMatrix>> {
  const byShape: Partial<Record<CagedShapeId, AlternateDegreeMatrix>> = {};
  const shapes: CagedShapeId[] = ["C", "A", "G", "E", "D"];
  for (const shape of shapes) {
    const byDegree: AlternateDegreeMatrix = {};
    for (const degree of progression.degrees) byDegree[degree.numeral] = alternateOptionsForDegree(degree.quality);
    byShape[shape] = byDegree;
  }
  return byShape;
}

function createAlternateShapeMatrix(): AlternateShapeMatrix {
  const matrix: AlternateShapeMatrix = {};
  for (const root of NOTES) {
    const byProgression: NonNullable<AlternateShapeMatrix[Note]> = {};
    for (const progression of PROGRESSIONS) {
      byProgression[progression.id] = alternateShapeMatrixForProgression(progression);
    }
    matrix[root] = byProgression;
  }
  return matrix;
}

export const ALTERNATE_SHAPE_MATRIX = createAlternateShapeMatrix();

// ─── Acordes transpuestos ──────────────────────────────────────

export interface TransposedChord {
  root: string;
  quality: ChordQuality;
  /** Notas reales del acorde */
  notes: string[];
  /** Nombre del cifrado */
  name: string;
  strings?: ProgressionChordShape["strings"];
  fretNumber?: ProgressionChordShape["fretNumber"];
  romanFret?: string;
}

function diatonicStepsForInterval(interval: number, qualityId: ChordQualityId): number {
  if (interval === 9 && qualityId === "dim7") return 6;
  if (interval === 0) return 0;
  if (interval <= 2) return 1;
  if (interval <= 4) return 2;
  if (interval === 5) return 3;
  if (interval <= 8) return 4;
  if (interval === 9) return 5;
  return 6;
}

function progressionRoot(tonicRoot: Note, degree: ProgressionDegree): string {
  const tonic = MusicNote.parse(tonicRoot);
  return addInterval(tonic, { steps: degree.steps, semitones: degree.semitones }).toString();
}

/** Transpone una calidad a una raíz dada, conservando la escritura diatónica. */
export function buildTransposedChord(root: string, qualityId: ChordQualityId): TransposedChord {
  const quality = CHORD_QUALITIES[qualityId];
  const rootNote = MusicNote.parse(root);
  const notes = quality.intervals.map((interval) =>
    addInterval(rootNote, { steps: diatonicStepsForInterval(interval, qualityId), semitones: interval }).toString(),
  );
  return {
    root,
    quality,
    notes,
    name: `${root}${quality.symbol}`,
  };
}

/** Genera todos los acordes de una progresión para una tónica dada */
export function buildProgressionChords(
  tonicRoot: Note,
  progressionId: string,
  alternate?: AlternateShapeId,
  cagedShape: CagedShapeId = "E",
): TransposedChord[] {
  const prog = PROGRESSIONS.find((p) => p.id === progressionId);
  if (!prog) return [];

  if (alternate) {
    const predefined = getAlternateShapeData(
      tonicRoot,
      progressionId as ProgressionID,
      CAGED_POSITION_BY_SHAPE[cagedShape],
    );
    if (predefined?.length === prog.degrees.length) {
      return prog.degrees.map((degree, index) => {
        const data = predefined[index];
        const chordRoot = progressionRoot(tonicRoot, degree);
        const qualityId = qualityForAlternateData(data.chordName, chordRoot) ?? degree.quality;
        const chord = buildTransposedChord(chordRoot, qualityId);
        return {
          ...chord,
          name: data.chordName,
          strings: data.strings,
          fretNumber: data.fretNumber,
          romanFret: data.romanFret,
        };
      });
    }
  }

  return prog.degrees.map((degree) => {
    const chordRoot = progressionRoot(tonicRoot, degree);
    let qualityId = degree.quality;
    if (alternate) {
      qualityId = ALTERNATE_SHAPE_MATRIX[tonicRoot]?.[progressionId]?.[cagedShape]?.[degree.numeral]?.[alternate] ?? qualityId;
    }
    return buildTransposedChord(chordRoot, qualityId);
  });
}

function qualityForAlternateData(chordName: string, root: string): ChordQualityId | undefined {
  const suffix = chordName.startsWith(root) ? chordName.slice(root.length) : "";
  const qualityBySuffix: Record<string, ChordQualityId> = {
    sus2: "sus2", sus4: "sus4", add9: "add9", m7: "min7", M9: "Maj9",
  };
  return qualityBySuffix[suffix];
}

// ─── Voicings CAGED por posición ───────────────────────────────

export interface CagedPositionVoicing {
  shape: CagedShapeId;
  anchorFret: number;
  notes: Array<{ string: number; fret: number; interval: number; finger: number }>;
  complete: boolean;
  mutedStrings: number[];
  barre?: { fret: number; fromString: number; toString: number };
}

export interface ArrangedChordVoicing {
  qualityId: ChordQualityId;
  layout: "shell" | "drop2" | "drop3";
  stringSet: string;
  droppedInterval?: number;
  complete: true;
  notes: Array<{ string: number; fret: number; midi: number; interval: number; finger: number }>;
}

const OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40] as const;
const ARRANGEMENT_STRINGS: Record<ChordVoicingLayout["kind"], number[][]> = {
  shell: [[5, 3, 2], [4, 3, 2]],
  drop2: [[5, 4, 3, 2], [4, 3, 2, 1], [3, 2, 1, 0]],
  drop3: [[5, 3, 2, 1], [4, 2, 1, 0]],
};

interface ArrangementPlan {
  tones: Array<{ interval: number; midi: number }>;
  droppedInterval?: number;
}

function arrangementPlan(rootMidi: number, quality: ChordQuality, layout: ChordVoicingLayout): ArrangementPlan {
  const source = layout.kind === "shell" ? quality : CHORD_QUALITIES[layout.sourceQuality];
  const chordTones = [...new Set(source.intervals)].sort((left, right) => left - right);
  const tones = chordTones.map((interval) => ({ interval, midi: rootMidi + interval }));
  let droppedInterval: number | undefined;

  if (layout.kind === "drop2" || layout.kind === "drop3") {
    const voiceIndex = layout.kind === "drop2" ? chordTones.length - 2 : chordTones.length - 3;
    droppedInterval = chordTones[voiceIndex];
    tones[voiceIndex] = { interval: droppedInterval, midi: tones[voiceIndex].midi - 12 };
    tones.sort((left, right) => left.midi - right.midi);
  }
  return { tones, droppedInterval };
}

function arrangeOnStringSet(
  strings: readonly number[],
  tones: readonly { interval: number; midi: number }[],
  qualityId: ChordQualityId,
  layout: ChordVoicingLayout["kind"],
  droppedInterval?: number,
): ArrangedChordVoicing | undefined {
  if (strings.length !== tones.length) return undefined;
  const notes = strings.map((stringIndex, index) => {
    const tone = tones[index];
    const fret = tone.midi - OPEN_STRING_MIDI[stringIndex];
    return { string: stringIndex, fret, midi: tone.midi, interval: tone.interval, finger: 0 };
  });
  if (notes.some((note) => note.fret < 0 || note.fret > 24)) return undefined;

  const fretted = [...new Set(notes.filter((note) => note.fret > 0).map((note) => note.fret))].sort((left, right) => left - right);
  const fingerByFret = new Map(fretted.map((fret, index) => [fret, index + 1]));
  notes.forEach((note) => { note.finger = note.fret === 0 ? 0 : fingerByFret.get(note.fret) ?? 0; });
  return {
    qualityId,
    layout,
    stringSet: strings.map((stringIndex) => stringIndex + 1).join("-"),
    droppedInterval,
    complete: true,
    notes,
  };
}

/** Calcula disposiciones reales de cuerdas/octavas para las calidades family=voicing. */
export function buildArrangedVoicings(root: string, qualityId: ChordQualityId): ArrangedChordVoicing[] {
  const quality = CHORD_QUALITIES[qualityId];
  const layout = quality.voicingLayout;
  if (quality.family !== "voicing" || !layout) return [];
  const rootMidi = MusicNote.parse(root).absoluteSemitones + 12;
  const plan = arrangementPlan(rootMidi, quality, layout);
  const results: ArrangedChordVoicing[] = [];
  const seen = new Set<string>();
  for (const octaveShift of [-24, -12, 0, 12, 24]) {
    const shiftedTones = plan.tones.map((tone) => ({ ...tone, midi: tone.midi + octaveShift }));
    for (const strings of ARRANGEMENT_STRINGS[layout.kind]) {
      const voicing = arrangeOnStringSet(strings, shiftedTones, qualityId, layout.kind, plan.droppedInterval);
      if (!voicing) continue;
      const key = `${strings.join("")}:${voicing.notes.map((note) => note.fret).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(voicing);
    }
  }
  return results;
}

/**
 * Genera los 5 voicings CAGED (una por forma) para una raíz y calidad
 * dadas. Para cada forma itera octava 0 (+0) y octava 1 (+12).
 */
export function buildCagedVoicings(
  root: string,
  quality: CagedQuality = "major",
): CagedPositionVoicing[] {
  const rootSemitones = MusicNote.parse(root).absoluteSemitones;
  const rootPitch = ((rootSemitones % 12) + 12) % 12;
  const shapes: CagedShapeId[] = ["C", "A", "G", "E", "D"];
  const result: CagedPositionVoicing[] = [];

  for (const shapeId of shapes) {
    const template: CagedTemplate = CAGED_TEMPLATES[shapeId];
    for (const octaveShift of [0, 12]) {
      const anchor = computeAnchorFret(rootPitch, template, octaveShift);
      if (anchor < 0 || anchor > 20) continue;
      const resolved = resolveCagedShape(rootPitch, template, quality, octaveShift);
      if (resolved.notes.length === 0) continue;
      const barre = template.barre
        ? { fret: anchor + template.barre.relativeFret, fromString: template.barre.fromString, toString: template.barre.toString }
        : undefined;
      result.push({ shape: shapeId, anchorFret: anchor, notes: resolved.notes, complete: resolved.complete, mutedStrings: [...template.muted], barre });
    }
  }

  // Ordenar por traste ancla ascendente
  return result.sort((a, b) => a.anchorFret - b.anchorFret);
}

// ─── Generador masivo de combinaciones ─────────────────────────

export interface ChordCombination {
  root: Note;
  qualityId: ChordQualityId;
  name: string;
}

/**
 * Genera todas las combinaciones (raíz × calidad) = 12 × 27 = 324 (+shapes) → 2280+.
 * Se expande contando los voicings CAGED (5 posiciones × 2 octavas × calidades).
 */
export function generateAllCombinations(): ChordCombination[] {
  const combinations: ChordCombination[] = [];
  const qualityIds = Object.keys(CHORD_QUALITIES) as ChordQualityId[];
  for (const root of NOTES) {
    for (const qualityId of qualityIds) {
      const chord = buildTransposedChord(root, qualityId);
      combinations.push({ root, qualityId, name: chord.name });
    }
  }
  return combinations;
}

// ─── Intervalos extendidos (para búsqueda de voicings) ─────────

export function intervalsForQuality(qualityId: ChordQualityId): number[] {
  const q = CHORD_QUALITIES[qualityId];
  return [...q.intervals, ...(q.optional ?? [])];
}

/** Etiqueta interválica legible para la UI */
export const INTERVAL_NAMES: Record<number, string> = {
  0: "Tónica (1)",
  1: "b2",
  2: "9ª (2)",
  3: "b3 / #9",
  4: "3ª Mayor",
  5: "11ª (4)",
  6: "b5 / #11",
  7: "5ª Justa",
  8: "#5 / b13",
  9: "13ª (6)",
  10: "b7 (Dom7)",
  11: "7ª Mayor",
};

/** Mapa de calidad CAGED a intervalos de calidad del chordEngine */
export function cagedQualityToEngine(cagedQuality: string): ChordQualityId {
  const map: Record<string, ChordQualityId> = {
    Maj: "Maj", min: "min", dom7: "dom7", Maj7: "Maj7",
    min7: "min7", "m-Maj7": "shell_min7", m7b5: "m7b5",
    dim7: "dim7", dim: "dim", aug: "aug", Maj7sharp5: "Maj7",
  };
  return map[cagedQuality] ?? "Maj";
}

/** Devuelve la lista de notas de la progresión con sus nombres de acorde */
export function progressionNotes(
  tonicRoot: Note,
  progressionId: string,
): Array<{ chord: TransposedChord; degree: ProgressionDegree }> {
  const prog = PROGRESSIONS.find((p) => p.id === progressionId);
  if (!prog) return [];
  return prog.degrees.map((degree) => {
    const chordRoot = progressionRoot(tonicRoot, degree);
    return {
      chord: buildTransposedChord(chordRoot, degree.quality),
      degree,
    };
  });
}

/** Todas las tonalidades disponibles */
export const ALL_ROOTS: Note[] = [...NOTES];

/** Todas las calidades como array ordenado */
export const QUALITY_LIST: ChordQuality[] = Object.values(CHORD_QUALITIES);
