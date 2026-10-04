import type { FretPosition } from "./domain";

export interface ErgonomicFretboardVoicing {
  fretPositions: readonly FretPosition[];
  fingerPositions?: readonly number[];
  barre?: { fret: number; fromString: number; toString: number };
}

export interface ErgonomicOptions {
  rootPitchClass?: number;
  requiredIntervals?: readonly number[];
  optionalIntervals?: readonly number[];
  allowRootless?: boolean;
  allowAdjacentUnisons?: boolean;
  maxFingerCount?: number;
}

export const STANDARD_OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40] as const;
const MAX_FRET = 24;
const MUTED_INTERMEDIATE_STRING_COST = 1.5;
const REGISTER_BIAS_COST = 2;
const OPTIONAL_FIFTH_COST = 3;

interface VoicedPitch {
  string: number;
  fret: number;
  midi: number;
}

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function maxFretSpanForPosition(lowestFret: number): number {
  if (lowestFret <= 4) return 3;
  if (lowestFret <= 11) return 4;
  return 5;
}

function soundingPitches(voicing: ErgonomicFretboardVoicing): VoicedPitch[] | undefined {
  if (voicing.fretPositions.length !== STANDARD_OPEN_STRING_MIDI.length) return undefined;
  const pitches: VoicedPitch[] = [];
  for (const [stringText, fret] of voicing.fretPositions.entries()) {
    if (fret === "x") continue;
    if (!Number.isInteger(fret) || fret < 0 || fret > MAX_FRET) return undefined;
    pitches.push({ string: stringText, fret, midi: STANDARD_OPEN_STRING_MIDI[stringText] + fret });
  }
  return pitches.length > 0 ? pitches : undefined;
}

function countUsedFingers(voicing: ErgonomicFretboardVoicing, pitches: readonly VoicedPitch[]): number {
  if (voicing.fingerPositions) {
    return new Set(voicing.fingerPositions.filter((finger) => finger > 0)).size;
  }
  return new Set(pitches.filter((pitch) => pitch.fret > 0).map((pitch) => pitch.fret)).size;
}

function hasForbiddenAdjacentUnison(pitches: readonly VoicedPitch[]): boolean {
  const byString = new Map(pitches.map((pitch) => [pitch.string, pitch.midi]));
  for (let string = 0; string < STANDARD_OPEN_STRING_MIDI.length - 1; string += 1) {
    if (byString.has(string) && byString.get(string) === byString.get(string + 1)) return true;
  }
  return false;
}

function hasRequiredIntervals(pitches: readonly VoicedPitch[], options: ErgonomicOptions): boolean {
  const required = options.requiredIntervals;
  if (!required || required.length === 0) return true;
  if (options.rootPitchClass === undefined || !Number.isInteger(options.rootPitchClass)) return false;
  const root = pitchClass(options.rootPitchClass);
  const present = new Set(pitches.map((pitch) => (pitchClass(pitch.midi) - root + 12) % 12));
  return required
    .filter((interval) => !(options.allowRootless && interval % 12 === 0))
    .every((interval) => present.has(((interval % 12) + 12) % 12));
}

function mutedIntermediateStrings(voicing: ErgonomicFretboardVoicing, pitches: readonly VoicedPitch[]): number {
  const lowestString = Math.min(...pitches.map((pitch) => pitch.string));
  const highestString = Math.max(...pitches.map((pitch) => pitch.string));
  return voicing.fretPositions.filter((fret, string) => string > lowestString && string < highestString && fret === "x").length;
}

function barreDifficulty(voicing: ErgonomicFretboardVoicing): number {
  if (!voicing.barre) return 0;
  const { fret, fromString, toString } = voicing.barre;
  if (fret < 1 || fret > MAX_FRET || fromString < 0 || fromString > 5 || toString < 0 || toString > 5) return Number.POSITIVE_INFINITY;
  const width = Math.abs(fromString - toString) + 1;
  return Math.max(0, width - 2) * 0.75 + (fret <= 2 ? 1 : 0);
}

function fretStretchCost(pitches: readonly VoicedPitch[]): number | undefined {
  const fretted = pitches.filter((pitch) => pitch.fret > 0).map((pitch) => pitch.fret);
  if (fretted.length === 0) return 0;
  const lowestFret = Math.min(...fretted);
  const fretSpan = Math.max(...fretted) - lowestFret;
  return fretSpan <= maxFretSpanForPosition(lowestFret) ? fretSpan ** 2 : undefined;
}

function registerPreferenceCost(pitches: readonly VoicedPitch[]): number {
  const firstPitch = pitches[0];
  const soprano = pitches.reduce((highest, pitch) => pitch.midi > highest.midi ? pitch : highest, firstPitch);
  const bass = pitches.reduce((lowest, pitch) => pitch.midi < lowest.midi ? pitch : lowest, firstPitch);
  return (soprano.string >= 3 ? REGISTER_BIAS_COST : 0)
    + (bass.string <= 2 ? REGISTER_BIAS_COST : 0);
}

function optionalFifthPenalty(pitches: readonly VoicedPitch[], fingerCount: number, options: ErgonomicOptions): number {
  const allIntervals = [...(options.requiredIntervals ?? []), ...(options.optionalIntervals ?? [])];
  const chordToneCount = new Set(allIntervals.map((interval) => ((interval % 12) + 12) % 12)).size;
  const hasOptionalFifth = options.optionalIntervals?.some((interval) => ((interval % 12) + 12) % 12 === 7) ?? false;
  if (chordToneCount < 5 || !hasOptionalFifth || fingerCount < (options.maxFingerCount ?? 4) || options.rootPitchClass === undefined) return 0;
  const root = pitchClass(options.rootPitchClass);
  return pitches.some((pitch) => (pitchClass(pitch.midi) - root + 12) % 12 === 7) ? OPTIONAL_FIFTH_COST : 0;
}

/** Returns Infinity when a voicing violates a hard physical or harmonic constraint. */
export function calculateErgonomicCost(
  voicing: ErgonomicFretboardVoicing,
  options: ErgonomicOptions = {},
): number {
  const pitches = soundingPitches(voicing);
  if (!pitches || !hasRequiredIntervals(pitches, options)) return Number.POSITIVE_INFINITY;
  if (!options.allowAdjacentUnisons && hasForbiddenAdjacentUnison(pitches)) return Number.POSITIVE_INFINITY;
  const stretchCost = fretStretchCost(pitches);
  if (stretchCost === undefined) return Number.POSITIVE_INFINITY;
  const maxFingerCount = options.maxFingerCount ?? 4;
  const fingerCount = countUsedFingers(voicing, pitches);
  if (fingerCount > maxFingerCount) return Number.POSITIVE_INFINITY;
  return stretchCost
    + mutedIntermediateStrings(voicing, pitches) * MUTED_INTERMEDIATE_STRING_COST
    + barreDifficulty(voicing)
    + registerPreferenceCost(pitches)
    + optionalFifthPenalty(pitches, fingerCount, options);
}
