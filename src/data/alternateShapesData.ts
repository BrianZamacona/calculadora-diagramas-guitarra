import { NOTES, TUNING, type Note } from "./data";
import { CAGED_TEMPLATES, computeAnchorFret } from "./cagedTemplates";
import { findAllVoicingsForIntervals, type ChordVoicing } from "../utils/domain";
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
  SixStringFretNumbers,
} from "../types/guitar";

type TriadQuality = "major" | "minor" | "diminished";
type AlternateColor = "sus2" | "sus4" | "add2" | "m7" | "7" | "M9" | "m11";

interface ProgressionStep {
  degree: ProgressionDegree;
  semitones: number;
  quality: TriadQuality;
}

interface ProgressionSpec {
  degrees: readonly ProgressionStep[];
  alternate: readonly AlternateColor[];
}

interface CagedWindow {
  positionIndex: CAGEDPositionIndex;
  shape: CAGEDShapeName;
  anchorFret: number;
  start: number;
  end: number;
}

const PROGRESSION_SPECS: Record<ProgressionLabel, ProgressionSpec> = {
  "I-vi-IV-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "vi", semitones: 9, quality: "minor" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["sus2", "m7", "M9", "sus4"],
  },
  "I-V-vi-IV": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
      { degree: "vi", semitones: 9, quality: "minor" },
      { degree: "IV", semitones: 5, quality: "major" },
    ],
    alternate: ["add2", "sus4", "m7", "M9"],
  },
  "I-IV-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["add2", "M9", "sus4"],
  },
  "I-vi-ii-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "vi", semitones: 9, quality: "minor" },
      { degree: "ii", semitones: 2, quality: "minor" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["sus2", "m7", "m11", "7"],
  },
  "I-IV-vi-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "vi", semitones: 9, quality: "minor" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["add2", "M9", "m7", "sus4"],
  },
  "I-IV-I-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["sus2", "M9", "add2", "7"],
  },
  "I-V-vi-iii": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
      { degree: "vi", semitones: 9, quality: "minor" },
      { degree: "iii", semitones: 4, quality: "minor" },
    ],
    alternate: ["add2", "7", "m7", "m11"],
  },
  "I-IV-ii-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "ii", semitones: 2, quality: "minor" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["sus2", "M9", "m7", "sus4"],
  },
  "I-iii-IV-V": {
    degrees: [
      { degree: "I", semitones: 0, quality: "major" },
      { degree: "iii", semitones: 4, quality: "minor" },
      { degree: "IV", semitones: 5, quality: "major" },
      { degree: "V", semitones: 7, quality: "major" },
    ],
    alternate: ["add2", "m7", "M9", "sus4"],
  },
};

const PROGRESSION_ALIASES: Partial<Record<ProgressionID, ProgressionLabel>> = {
  "I-vi-IV-V": "I-vi-IV-V", "I-V-vi-IV": "I-V-vi-IV", "I-IV-V": "I-IV-V",
  "I-vi-ii-V": "I-vi-ii-V", "I-IV-vi-V": "I-IV-vi-V", "I-IV-I-V": "I-IV-I-V",
  "I-V-vi-iii": "I-V-vi-iii", "I-IV-ii-V": "I-IV-ii-V", "I-iii-IV-V": "I-iii-IV-V",
  "v1-1": "I-vi-IV-V", "v1-2": "I-V-vi-IV", "v1-3": "I-IV-V",
  "v2-1": "I-vi-ii-V", "v2-2": "I-IV-vi-V", "v2-3": "I-IV-I-V",
  "v3-1": "I-V-vi-iii", "v3-2": "I-IV-ii-V", "v3-3": "I-iii-IV-V",
};

const STANDARD_INTERVALS: Record<TriadQuality, readonly number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6],
};
const ALTERNATE_INTERVALS: Record<AlternateColor, readonly number[]> = {
  sus2: [0, 2, 7], sus4: [0, 5, 7], add2: [0, 2, 4, 7],
  m7: [0, 3, 7, 10], "7": [0, 4, 7, 10], M9: [0, 2, 4, 7, 11], m11: [0, 2, 3, 5, 7, 10],
};

const ROMAN_FRETS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];
const CAGED_SHAPES = Object.entries(CAGED_TEMPLATES) as Array<[CAGEDShapeName, (typeof CAGED_TEMPLATES)[CAGEDShapeName]]>;
const CANDIDATE_CACHE = new Map<string, ChordVoicing[]>();

function romanFret(fret: number): string {
  return ROMAN_FRETS[fret] ?? String(fret);
}

function cagedWindowsForKey(key: KeySignature): CagedWindow[] {
  const rootPitch = NOTES.indexOf(key);
  const orderedWindows = CAGED_SHAPES.map(([shape, template]) => {
    const anchorFret = computeAnchorFret(rootPitch, template);
    const start = Math.max(0, anchorFret - 2);
    const end = Math.min(24, Math.max(start + 4, anchorFret + 2));
    return {
      shape,
      anchorFret,
      start,
      end,
      center: (start + end) / 2,
    };
  }).sort((left, right) => left.anchorFret - right.anchorFret || left.center - right.center || left.start - right.start);

  return orderedWindows.map((ordered, index) => ({
    shape: ordered.shape,
    anchorFret: ordered.anchorFret,
    start: ordered.start,
    end: ordered.end,
    positionIndex: (index + 1) as CAGEDPositionIndex,
  }));
}

function chordRoot(key: KeySignature, semitones: number): Note {
  return NOTES[(NOTES.indexOf(key) + semitones) % NOTES.length];
}

function colorChordName(root: Note, color: AlternateColor): string {
  const suffix: Record<AlternateColor, string> = {
    sus2: "sus2", sus4: "sus4", add2: "add2", m7: "m7", "7": "7", M9: "M9", m11: "m11",
  };
  return `${root}${suffix[color]}`;
}

function candidateCacheKey(root: Note, intervals: readonly number[], window: CagedWindow): string {
  return `${root}:${[...intervals].sort((left, right) => left - right).join(",")}:${window.start}-${window.end}`;
}

function candidatesForChord(root: Note, intervals: readonly number[], window: CagedWindow): ChordVoicing[] {
  const cacheKey = candidateCacheKey(root, intervals, window);
  const cached = CANDIDATE_CACHE.get(cacheKey);
  if (cached) return cached;
  const rootIndex = NOTES.indexOf(root);
  const bassIntervals = [...new Set([0, ...intervals.filter((interval) => interval !== 0 && interval !== 7)])];
  const candidates = bassIntervals.flatMap((interval) =>
    findAllVoicingsForIntervals(
      root,
      intervals,
      NOTES[(rootIndex + interval) % NOTES.length],
      600,
      window.end,
      Math.min(4, window.end - window.start),
      Math.max(1, window.start),
    ),
  );
  const uniqueCandidates = new Map(candidates.map((candidate) => [candidate.fretPositions.join(","), candidate]));
  const result = [...uniqueCandidates.values()];
  CANDIDATE_CACHE.set(cacheKey, result);
  return result;
}

function fitsWindow(voicing: ChordVoicing, window: CagedWindow): boolean {
  return voicing.fretPositions.every((fret) => {
    if (fret === "x") return true;
    if (fret === 0) return window.start === 0;
    return fret >= window.start && fret <= window.end;
  });
}

function constrainVoicingToWindow(
  voicing: ChordVoicing,
  root: Note,
  intervals: readonly number[],
  window: CagedWindow,
): ChordVoicing | undefined {
  const rootPitch = NOTES.indexOf(root);
  const fretPositions = voicing.fretPositions.map((fret) => {
    if (fret === "x") return "x";
    if (fret === 0) return window.start === 0 ? 0 : "x";
    return fret >= window.start && fret <= window.end ? fret : "x";
  });
  const playedIntervals = new Set<number>();
  fretPositions.forEach((fret, stringIndex) => {
    if (fret !== "x") playedIntervals.add((TUNING[stringIndex] + fret - rootPitch + 24) % 12);
  });
  const essentialIntervals = intervals.filter((interval) => interval !== 7);
  if (!essentialIntervals.every((interval) => playedIntervals.has(interval))) return undefined;
  if (fretPositions.filter((fret) => fret !== "x").length < 3) return undefined;

  const fretted = fretPositions.filter((fret): fret is number => typeof fret === "number" && fret > 0);
  const baseFret = fretted.length > 0 ? Math.min(...fretted) : 0;
  const fingerByFret = new Map([...new Set(fretted)].sort((left, right) => left - right).map((fret, index) => [fret, index + 1]));
  const fingerPositions = fretPositions.map((fret) => typeof fret === "number" && fret > 0 ? fingerByFret.get(fret) ?? 0 : 0);
  return { ...voicing, fretPositions, fingerPositions, baseFret };
}

function voiceLeadingCost(candidate: ChordVoicing, previous: ChordVoicing | undefined, anchorFret: number): number {
  if (!previous) return Math.abs(candidate.baseFret - anchorFret) * 4;
  let cost = 0;
  for (let index = 0; index < candidate.fretPositions.length; index += 1) {
    const fret = candidate.fretPositions[index];
    const priorFret = previous.fretPositions[index];
    if (fret === "x" && priorFret === "x") continue;
    if (fret === "x" || priorFret === "x") cost += 4;
    else cost += Math.abs(fret - priorFret);
  }
  return cost;
}

function chooseVoicing(root: Note, intervals: readonly number[], window: CagedWindow, previous?: ChordVoicing): ChordVoicing | undefined {
  const candidates = candidatesForChord(root, intervals, window);
  const regional = candidates.filter((candidate) => fitsWindow(candidate, window));
  const partial = regional.length > 0
    ? []
    : candidates.map((candidate) => constrainVoicingToWindow(candidate, root, intervals, window)).filter((candidate): candidate is ChordVoicing => candidate !== undefined);
  const choices = regional.length > 0 ? regional : partial;
  return [...choices].sort((left, right) =>
    voiceLeadingCost(left, previous, window.anchorFret) - voiceLeadingCost(right, previous, window.anchorFret),
  )[0];
}

function chordShape(degree: ProgressionDegree, root: Note, chordName: string, voicing: ChordVoicing): ProgressionChordShape {
  const [highE, b, g, d, a, lowE] = voicing.fretPositions;
  const strings: SixStringFretNumbers = [lowE, a, d, g, b, highE];
  let bassString = voicing.fretPositions.length - 1;
  while (bassString >= 0 && voicing.fretPositions[bassString] === "x") bassString -= 1;
  const bassFret = voicing.fretPositions[bassString];
  const bass = typeof bassFret === "number" ? NOTES[(TUNING[bassString] + bassFret) % NOTES.length] : root;
  return {
    degree,
    chordName: bass === root ? chordName : `${chordName}/${bass}`,
    fretNumber: voicing.baseFret,
    romanFret: romanFret(voicing.baseFret),
    strings,
  };
}

function standardSuffix(quality: TriadQuality): string {
  if (quality === "minor") return "m";
  return quality === "diminished" ? "dim" : "";
}

function progressionPosition(key: KeySignature, progression: ProgressionSpec, window: CagedWindow): ProgressionPositionShapes {
  const standardShapes: ProgressionChordShape[] = [];
  const alternateShapes: ProgressionChordShape[] = [];
  let previousStandard: ChordVoicing | undefined;
  let previousAlternate: ChordVoicing | undefined;

  progression.degrees.forEach((step, index) => {
    const root = chordRoot(key, step.semitones);
    const standard = chooseVoicing(root, STANDARD_INTERVALS[step.quality], window, previousStandard);
    const alternateColor = progression.alternate[index];
    const alternate = chooseVoicing(root, ALTERNATE_INTERVALS[alternateColor], window, previousAlternate);
    if (standard) {
      standardShapes.push(chordShape(step.degree, root, root + standardSuffix(step.quality), standard));
      previousStandard = standard;
    }
    if (alternate) {
      alternateShapes.push(chordShape(step.degree, root, colorChordName(root, alternateColor), alternate));
      previousAlternate = alternate;
    }
  });

  return {
    positionIndex: window.positionIndex,
    anchorFret: window.anchorFret,
    cagedShapeName: window.shape,
    standardShapes,
    alternateShapes,
  };
}

function buildKeyData(key: KeySignature): Partial<Record<ProgressionID, ProgressionPositionShapes[]>> {
  const result: Partial<Record<ProgressionID, ProgressionPositionShapes[]>> = {};
  const windows = cagedWindowsForKey(key);
  for (const progressionId of Object.keys(PROGRESSION_SPECS) as ProgressionLabel[]) {
    const positions = windows.map((window) => progressionPosition(key, PROGRESSION_SPECS[progressionId], window));
    result[progressionId] = positions;
    for (const [alias, label] of Object.entries(PROGRESSION_ALIASES)) {
      if (label === progressionId) result[alias as ProgressionID] = positions;
    }
  }
  return result;
}

export const CLASSIC_ALTERNATE_SHAPES_DB: ProgressionDatabase = Object.fromEntries(
  NOTES.map((key) => [key, buildKeyData(key)]),
) as ProgressionDatabase;

export function getAlternateShapeData(key: KeySignature, progressionId: ProgressionID, position: CAGEDPositionIndex): ProgressionChordShape[] | null {
  const label = PROGRESSION_ALIASES[progressionId];
  if (!label) return null;
  const positionData = CLASSIC_ALTERNATE_SHAPES_DB[key]?.[label]?.find((item) => item.positionIndex === position);
  return positionData?.alternateShapes ?? null;
}

export function getClassicAlternatePosition(key: KeySignature, progressionId: ProgressionID, position: CAGEDPositionIndex): ProgressionPositionShapes | null {
  const label = PROGRESSION_ALIASES[progressionId];
  if (!label) return null;
  return CLASSIC_ALTERNATE_SHAPES_DB[key]?.[label]?.find((item) => item.positionIndex === position) ?? null;
}

export function getCAGEDPositionIndex(key: KeySignature, shape: CAGEDShapeName): CAGEDPositionIndex | null {
  const positions = CLASSIC_ALTERNATE_SHAPES_DB[key]?.["I-vi-IV-V"];
  return positions?.find((position) => position.cagedShapeName === shape)?.positionIndex ?? null;
}
