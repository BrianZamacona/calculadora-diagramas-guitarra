import {
  ARPEGGIOS, CHORD_GLOSSARY, CAGED_QUALITIES, CAGED_SHAPES, FRET_COUNT,
  NOTES, SCALES, TUNING,
  type CagedLayer, type CagedQuality, type CagedShape, type Note, type ScaleId
} from "../data/data";
import { maxFretSpanForPosition } from "./ergonomicsEngine";

export type MarkKind = "root" | "chord" | "scale" | "blue";
export interface FretMark { stringIndex: number; fret: number; note: Note; interval: string; kind: MarkKind; }
export interface Range { start: number; end: number; }
export interface DoubleStopPair {
  root: FretMark;
  interval: FretMark;
  distance: number;
  intervalQuality: string;
  degree?: number;
}
export type DiatonicDoubleStopInterval = "2nd" | "3rd" | "4th" | "5th" | "6th" | "7th";
export type DoubleStopStringPattern = "adjacent" | "skip-one";
export interface DoubleStopStringPairGroup {
  stringPair: [number, number];
  pairs: DoubleStopPair[];
}

interface DiatonicIntervalDefinition {
  distance: number;
  quality: string;
}

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const DIATONIC_DEFAULT_STRING_PATTERN: Record<DiatonicDoubleStopInterval, DoubleStopStringPattern> = {
  "2nd": "adjacent", "3rd": "adjacent", "4th": "adjacent", "5th": "adjacent",
  "6th": "skip-one", "7th": "skip-one",
};
const DIATONIC_DOUBLE_STOP_INTERVALS: Record<DiatonicDoubleStopInterval, readonly DiatonicIntervalDefinition[]> = {
  "2nd": [
    { distance: 2, quality: "2ª mayor" }, { distance: 2, quality: "2ª mayor" },
    { distance: 1, quality: "2ª menor" }, { distance: 2, quality: "2ª mayor" },
    { distance: 2, quality: "2ª mayor" }, { distance: 2, quality: "2ª mayor" },
    { distance: 1, quality: "2ª menor" },
  ],
  "3rd": [
    { distance: 4, quality: "3ª mayor" }, { distance: 3, quality: "3ª menor" },
    { distance: 3, quality: "3ª menor" }, { distance: 4, quality: "3ª mayor" },
    { distance: 4, quality: "3ª mayor" }, { distance: 3, quality: "3ª menor" },
    { distance: 3, quality: "3ª menor" },
  ],
  "4th": [
    { distance: 5, quality: "4ª justa" }, { distance: 5, quality: "4ª justa" },
    { distance: 5, quality: "4ª justa" }, { distance: 6, quality: "4ª aumentada" },
    { distance: 5, quality: "4ª justa" }, { distance: 5, quality: "4ª justa" },
    { distance: 5, quality: "4ª justa" },
  ],
  "5th": [
    { distance: 7, quality: "5ª justa" }, { distance: 7, quality: "5ª justa" },
    { distance: 7, quality: "5ª justa" }, { distance: 7, quality: "5ª justa" },
    { distance: 7, quality: "5ª justa" }, { distance: 7, quality: "5ª justa" },
    { distance: 6, quality: "5ª disminuida" },
  ],
  "6th": [
    { distance: 9, quality: "6ª mayor" }, { distance: 9, quality: "6ª mayor" },
    { distance: 8, quality: "6ª menor" }, { distance: 9, quality: "6ª mayor" },
    { distance: 9, quality: "6ª mayor" }, { distance: 8, quality: "6ª menor" },
    { distance: 8, quality: "6ª menor" },
  ],
  "7th": [
    { distance: 11, quality: "7ª mayor" }, { distance: 10, quality: "7ª menor" },
    { distance: 10, quality: "7ª menor" }, { distance: 11, quality: "7ª mayor" },
    { distance: 10, quality: "7ª menor" }, { distance: 10, quality: "7ª menor" },
    { distance: 9, quality: "7ª disminuida" },
  ],
};

const OPEN_STRING_MIDI_STANDARD_TUNING = [64, 59, 55, 50, 45, 40] as const;

export type ChordBase = "major" | "minor" | "sus2" | "sus4" | "aug" | "dim";
export type FifthModifier = "none" | "b5" | "5" | "#5";
export type SeventhModifier = "none" | "6" | "7" | "7M";
export type ExtensionModifier = "none" | "b9" | "9" | "#9" | "b11" | "11" | "#11" | "b13" | "13" | "#13";
export type AdditionModifier = "add2" | "add4" | "add6" | "add9" | "add11" | "add13";
export interface ChordBuilderState {
  root: string;
  base: ChordBase;
  bass?: string;
  fifth: FifthModifier;
  seventh: SeventhModifier;
  extensions: readonly ExtensionModifier[];
  additions: readonly AdditionModifier[];
}
export interface BuiltChord {
  name: string;
  notes: Note[];
  intervals: number[];
  bass?: Note;
}
export type FretPosition = number | "x";
export interface ChordVoicing {
  title: string;
  fretPositions: readonly FretPosition[];
  fingerPositions: readonly number[];
  baseFret: number;
  position: "abierta" | "cejilla" | "movible";
  barre?: { fret: number; fromString: number; toString: number };
}
export interface NoteSetSuggestion {
  kind: "escala" | "arpegio" | "acorde";
  name: string;
  root: Note;
  exact: boolean;
  matched: number;
  missing: number;
  extra: number;
}

const BASE_INTERVALS: Record<ChordBase, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], sus2: [0, 2, 7], sus4: [0, 5, 7], aug: [0, 4, 8], dim: [0, 3, 6],
};
const FIFTH_INTERVALS: Record<Exclude<FifthModifier, "none">, number> = { b5: 6, "5": 7, "#5": 8 };
const SEVENTH_INTERVALS: Record<Exclude<SeventhModifier, "none">, number> = { "6": 9, "7": 10, "7M": 11 };
const EXTENSION_INTERVALS: Record<Exclude<ExtensionModifier, "none">, number> = { b9: 1, "9": 2, "#9": 3, b11: 4, "11": 5, "#11": 6, b13: 8, "13": 9, "#13": 10 };
const ADDITION_INTERVALS: Record<AdditionModifier, number> = { add2: 2, add4: 5, add6: 9, add9: 2, add11: 5, add13: 9 };

function uniqueIntervals(intervals: number[]): number[] { return intervals.filter((interval, index) => intervals.indexOf(interval) === index); }
function extensionLabel(extension: ExtensionModifier): string { return extension === "none" ? "" : extension; }

// Mapeo de semitonos a especificación de grado diatónico (steps = grado - 1)
const INTERVAL_TO_STEPS: Record<number, number> = {
  0: 0,   // Unísono (1)
  1: 1,   // 2da menor (b2)
  2: 1,   // 2da mayor (2/9)
  3: 2,   // 3ra menor (b3)
  4: 2,   // 3ra mayor (3)
  5: 3,   // 4ta perfecta (4/11)
  6: 3,   // 4ta aumentada / 5ta disminuida (#4/b5) -> 4ta o 5ta según contexto
  7: 4,   // 5ta perfecta (5)
  8: 4,   // 5ta aumentada / 6ta menor (#5/b6)
  9: 5,   // 6ta mayor / 7ma disminuida (6/bb7)
  10: 6,  // 7ma menor (b7)
  11: 6,  // 7ma mayor (7M)
};

function chordIntervals(state: ChordBuilderState): number[] {
  const intervals = [...BASE_INTERVALS[state.base]];
  if (state.fifth !== "none") intervals[intervals.length - 1] = FIFTH_INTERVALS[state.fifth];
  if (state.seventh !== "none") intervals.push(SEVENTH_INTERVALS[state.seventh]);
  state.extensions
    .filter((extension) => extension !== "none")
    .forEach((extension) => intervals.push(EXTENSION_INTERVALS[extension]));
  state.additions.forEach((addition) => intervals.push(ADDITION_INTERVALS[addition]));
  return uniqueIntervals(intervals);
}

function chordNotes(state: ChordBuilderState, intervals: readonly number[]): Note[] {
  const rootNote = MusicNote.parse(state.root);
  return intervals.map((semitones) => {
    let steps = INTERVAL_TO_STEPS[semitones] ?? 0;
    if (semitones === 6 && state.fifth === "b5") steps = 4;
    return addInterval(rootNote, { steps, semitones }).toString() as Note;
  });
}

function chordBass(state: ChordBuilderState): Note | undefined {
  if (!state.bass || state.bass === "none" || noteIndex(state.bass) < 0) return undefined;
  return state.bass as Note;
}

function chordQualitySuffix(state: ChordBuilderState, intervals: readonly number[]): string {
  const baseSuffix: Record<ChordBase, string> = {
    major: "", minor: "m", sus2: "sus2", sus4: "sus4", aug: "aug", dim: "dim",
  };
  const isDominantNinth = state.seventh === "7"
    && state.extensions.includes("9")
    && state.base === "major"
    && intervals.includes(4)
    && intervals.includes(10);
  const isMajorNinth = state.seventh === "7M"
    && state.extensions.includes("9")
    && state.base === "major";
  let suffix = baseSuffix[state.base];

  if (isDominantNinth) suffix = "9";
  else if (isMajorNinth) suffix = "maj9";
  else suffix = appendSeventhSuffix(suffix, state.seventh);

  return suffix;
}

function appendSeventhSuffix(suffix: string, seventh: SeventhModifier): string {
  if (seventh === "7M") return `${suffix}maj7`;
  if (seventh === "7") return `${suffix}7`;
  if (seventh === "6") return `${suffix}6`;
  return suffix;
}

function appendAlterationSuffix(suffix: string, state: ChordBuilderState): string {
  if (state.fifth === "b5" && state.base !== "dim") suffix += "b5";
  if (state.fifth === "#5" && state.base !== "aug") suffix += "#5";
  return suffix;
}

function appendExtensionSuffix(suffix: string, state: ChordBuilderState): string {
  const ninthAlreadyIncluded = state.base === "major"
    && state.extensions.includes("9")
    && (state.seventh === "7" || state.seventh === "7M");
  state.extensions
    .filter((extension) => extension !== "none")
    .forEach((extension) => {
      if (!(ninthAlreadyIncluded && extension === "9")) suffix += extensionLabel(extension);
    });
  return suffix;
}

function appendAdditionSuffix(suffix: string, additions: readonly AdditionModifier[]): string {
  additions.forEach((addition) => {
    if (!suffix.includes(addition)) suffix += addition;
  });
  return suffix;
}

function chordName(state: ChordBuilderState, bass: Note | undefined, intervals: readonly number[]): string {
  let suffix = chordQualitySuffix(state, intervals);
  suffix = appendAlterationSuffix(suffix, state);
  suffix = appendExtensionSuffix(suffix, state);
  suffix = appendAdditionSuffix(suffix, state.additions);

  const isPlainMajor = state.base === "major"
    && state.fifth === "5"
    && state.seventh === "none"
    && state.extensions.length === 0
    && state.additions.length === 0
    && !intervals.includes(3);
  if (isPlainMajor) suffix = "";

  const chordRootAndQuality = state.root + suffix;
  return bass ? chordRootAndQuality + "/" + bass : chordRootAndQuality;
}

export function buildChord(state: ChordBuilderState): BuiltChord {
  if (noteIndex(state.root) < 0) return { name: "", notes: [], intervals: [] };
  const intervals = chordIntervals(state);
  const notes = chordNotes(state, intervals);
  const bass = chordBass(state);
  return { name: chordName(state, bass, intervals), notes, intervals, bass };
}

const MAX_VOICING_FRET = 12;
const MAX_FRET_SPAN = 3;
const MAX_FINGERS = 4;
const MIN_SOUNDING_STRINGS = 3;
const MAX_VOICING_RESULTS = 12;
const MAX_RAW_VOICINGS = 300;
const MAX_BUILDER_RAW_PER_ZONE = 100;
const BUILDER_FRET_ZONES = [
  { firstFret: 1, maxFret: 4 },
  { firstFret: 5, maxFret: 11 },
  { firstFret: 12, maxFret: 24 },
].map((zone) => ({ ...zone, maxFretSpan: maxFretSpanForPosition(zone.firstFret) }));

interface RawVoicing {
  frets: FretPosition[];
  coverage: number;
  soundingStrings: number;
  baseFret: number;
  fingerCount: number;
  splitFretGroups: number;
  realisticFingerAssignments: boolean;
}

interface FretStringGroup {
  fret: number;
  stringIndices: number[];
}

interface FretFingerAction extends FretStringGroup {
  isBarre: boolean;
  barreRange?: { fromString: number; toString: number };
}

interface FingerAssignment {
  fingerPositions: number[];
  fingerCount: number;
  barre: ChordVoicing["barre"];
}

interface VoicingSearchOptions {
  maxRawResults?: number;
  maxFret?: number;
  maxFretSpan?: number;
  firstFret?: number;
  realisticFingerAssignments?: boolean;
}

function contiguousFretGroups(frets: readonly FretPosition[]): FretStringGroup[] {
  const stringsByFret = new Map<number, number[]>();
  frets.forEach((fret, stringIndex) => {
    if (typeof fret !== "number" || fret <= 0) return;
    const strings = stringsByFret.get(fret) ?? [];
    strings.push(stringIndex);
    stringsByFret.set(fret, strings);
  });

  const groups: FretStringGroup[] = [];
  stringsByFret.forEach((strings, fret) => {
    let current: number[] = [];
    strings.forEach((stringIndex) => {
      const previousString = current.at(-1);
      if (previousString !== undefined && stringIndex !== previousString + 1) {
        groups.push({ fret, stringIndices: current });
        current = [];
      }
      current.push(stringIndex);
    });
    if (current.length > 0) groups.push({ fret, stringIndices: current });
  });
  return groups;
}

function assignFingers(frets: readonly FretPosition[]): FingerAssignment {
  const groups = contiguousFretGroups(frets);
  const barreCandidates: FretFingerAction[] = [];
  const fretLevels = [...new Set(frets.filter((fret): fret is number => typeof fret === "number" && fret > 0))];
  fretLevels.forEach((barreFret) => {
    let segmentStart: number | undefined;
    let segmentEnd: number | undefined;
    let barreNotes: number[] = [];
    const saveSegment = (): void => {
      if (barreNotes.length >= 2 && segmentStart !== undefined && segmentEnd !== undefined) {
        barreCandidates.push({
          fret: barreFret,
          stringIndices: barreNotes,
          isBarre: true,
          barreRange: { fromString: segmentStart, toString: segmentEnd },
        });
      }
      segmentStart = undefined;
      segmentEnd = undefined;
      barreNotes = [];
    };
    frets.forEach((fret, stringIndex) => {
      if (typeof fret !== "number" || fret < barreFret || fret === 0) {
        saveSegment();
        return;
      }
      segmentStart ??= stringIndex;
      segmentEnd = stringIndex;
      if (fret === barreFret) barreNotes.push(stringIndex);
    });
    saveSegment();
  });
  barreCandidates.sort((left, right) => right.stringIndices.length - left.stringIndices.length
    || (right.barreRange!.toString - right.barreRange!.fromString) - (left.barreRange!.toString - left.barreRange!.fromString)
    || left.fret - right.fret);
  const barreAction = barreCandidates[0];
  const barreStrings = new Set(barreAction?.stringIndices ?? []);
  const remainingGroupActions = (group: FretStringGroup): FretFingerAction[] => {
    const runs: number[][] = [];
    group.stringIndices.filter((stringIndex) => !barreStrings.has(stringIndex)).forEach((stringIndex) => {
      const run = runs.at(-1);
      if (run && stringIndex === run.at(-1)! + 1) run.push(stringIndex);
      else runs.push([stringIndex]);
    });
    return runs.map((stringIndices) => ({
      fret: group.fret,
      stringIndices,
      isBarre: stringIndices.length > 1,
      ...(stringIndices.length > 1 ? { barreRange: { fromString: stringIndices[0], toString: stringIndices.at(-1)! } } : {}),
    }));
  };
  const actions: FretFingerAction[] = [
    ...(barreAction ? [barreAction] : []),
    ...groups.flatMap(remainingGroupActions),
  ];
  actions.sort((left, right) => left.fret - right.fret
    || Number(right.isBarre) - Number(left.isBarre)
    || Math.min(...left.stringIndices) - Math.min(...right.stringIndices));
  const fingerPositions = frets.map(() => 0);
  actions.forEach((action, index) => action.stringIndices.forEach((stringIndex) => { fingerPositions[stringIndex] = index + 1; }));
  const barre = barreAction?.barreRange ? { fret: barreAction.fret, ...barreAction.barreRange } : undefined;
  return { fingerPositions, fingerCount: actions.length, barre };
}

function assignLegacyFingers(frets: readonly FretPosition[]): FingerAssignment {
  const distinctFrets = [...new Set(frets.filter((fret): fret is number => typeof fret === "number" && fret > 0))]
    .sort((left, right) => left - right);
  const fingerByFret = new Map(distinctFrets.map((fret, index) => [fret, index + 1]));
  const fingerPositions = frets.map((fret) => (typeof fret === "number" && fret > 0 ? fingerByFret.get(fret) ?? 0 : 0));
  const lowestFret = distinctFrets[0];
  const soundingStrings = frets.flatMap((fret, stringIndex) => fret === "x" ? [] : [stringIndex]);
  const lowestFretCount = frets.filter((fret) => fret === lowestFret).length;
  const barre = lowestFret !== undefined && lowestFretCount >= 2 && soundingStrings.length > 0
    ? { fret: lowestFret, fromString: soundingStrings[0], toString: soundingStrings.at(-1)! }
    : undefined;
  return { fingerPositions, fingerCount: distinctFrets.length, barre };
}

function splitFretActionCount(frets: readonly FretPosition[], fingerPositions: readonly number[]): number {
  const fingersByFret = new Map<number, Set<number>>();
  frets.forEach((fret, stringIndex) => {
    if (typeof fret !== "number" || fret <= 0) return;
    const fingers = fingersByFret.get(fret) ?? new Set<number>();
    fingers.add(fingerPositions[stringIndex]);
    fingersByFret.set(fret, fingers);
  });
  return [...fingersByFret.values()].reduce((total, fingers) => total + fingers.size - 1, 0);
}

function searchVoicings(
  rootIndex: number,
  mustHave: readonly number[],
  niceToHave: readonly number[],
  bassIndex: number,
  options: VoicingSearchOptions = {},
): RawVoicing[] {
  const {
    maxRawResults = MAX_RAW_VOICINGS,
    maxFret: maxFretLimit = MAX_VOICING_FRET,
    maxFretSpan = MAX_FRET_SPAN,
    firstFret = 1,
    realisticFingerAssignments = false,
  } = options;
    const rawResultLimit = realisticFingerAssignments ? maxRawResults * 3 : maxRawResults;
  const must = new Set(mustHave.map((interval) => (rootIndex + interval + 1200) % 12));
  const nice = new Set(niceToHave.map((interval) => (rootIndex + interval + 1200) % 12));
  const allowed = new Set<number>([...must, ...nice]);
  const results: RawVoicing[] = [];
  if (must.size > 6) return results;
  const frets: FretPosition[] = ["x", "x", "x", "x", "x", "x"];

  const finalize = (soundingStrings: number, covered: Set<number>): void => {
    if (soundingStrings < MIN_SOUNDING_STRINGS) return;
    for (const pitch of must) if (!covered.has(pitch)) return;
    const fingering = realisticFingerAssignments ? assignFingers(frets) : assignLegacyFingers(frets);
    if (fingering.fingerCount > MAX_FINGERS) return;
    const fretted = frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
    const baseFret = fretted.length > 0 ? Math.min(...fretted) : 0;
    const splitFretGroups = realisticFingerAssignments ? splitFretActionCount(frets, fingering.fingerPositions) : 0;
    let coverage = 0;
    covered.forEach((pitch) => { if (nice.has(pitch)) coverage += 1; });
    results.push({ frets: [...frets], coverage, soundingStrings, baseFret, fingerCount: fingering.fingerCount, splitFretGroups, realisticFingerAssignments });
  };

  const recurse = (stringIndex: number, bassFound: boolean, minFret: number, maxFret: number, soundingStrings: number, covered: Set<number>): void => {
    if (results.length >= rawResultLimit) return;
    if (stringIndex < 0) { finalize(soundingStrings, covered); return; }
    frets[stringIndex] = "x";
    recurse(stringIndex - 1, bassFound, minFret, maxFret, soundingStrings, covered);
    const openPitch = TUNING[stringIndex];
    const openValid = bassFound ? allowed.has(openPitch) : openPitch === bassIndex;
    if (openValid) {
      frets[stringIndex] = 0;
      const nextCovered = covered.has(openPitch) ? covered : new Set(covered).add(openPitch);
      recurse(stringIndex - 1, true, minFret, maxFret, soundingStrings + 1, nextCovered);
    }
    for (let fret = Math.max(1, firstFret); fret <= maxFretLimit; fret += 1) {
      const pitch = (TUNING[stringIndex] + fret) % 12;
      const valid = bassFound ? allowed.has(pitch) : pitch === bassIndex;
      if (!valid) continue;
      const nextMin = Math.min(minFret, fret);
      const nextMax = Math.max(maxFret, fret);
      if (nextMax - nextMin > maxFretSpan) continue;
      frets[stringIndex] = fret;
      const nextCovered = covered.has(pitch) ? covered : new Set(covered).add(pitch);
      recurse(stringIndex - 1, true, nextMin, nextMax, soundingStrings + 1, nextCovered);
    }
    frets[stringIndex] = "x";
  };

  recurse(5, false, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, new Set());
  return results;
}

function isBetterVoicing(candidate: RawVoicing, current: RawVoicing): boolean {
  if (candidate.coverage !== current.coverage) return candidate.coverage > current.coverage;
  if (candidate.realisticFingerAssignments && candidate.splitFretGroups !== current.splitFretGroups) return candidate.splitFretGroups < current.splitFretGroups;
  if (candidate.soundingStrings !== current.soundingStrings) return candidate.soundingStrings > current.soundingStrings;
  return candidate.fingerCount < current.fingerCount;
}

function toVoicing(raw: RawVoicing): ChordVoicing {
  const frets = raw.frets;
  const fingering = raw.realisticFingerAssignments ? assignFingers(frets) : assignLegacyFingers(frets);
  const { fingerPositions, barre } = fingering;
  let position: ChordVoicing["position"] = "movible";
  if (raw.baseFret === 0) position = "abierta";
  else if (barre) position = "cejilla";
  let title = `Posición · traste ${raw.baseFret}`;
  if (position === "abierta") title = "Posición abierta";
  else if (barre && raw.realisticFingerAssignments) title = `Cejilla (${Math.min(barre.fromString, barre.toString) + 1}ª-${Math.max(barre.fromString, barre.toString) + 1}ª cuerda) · traste ${barre.fret}`;
  else if (barre) {
    let rootStringIndex = 0;
    for (let stringIndex = frets.length - 1; stringIndex >= 0; stringIndex -= 1) {
      if (frets[stringIndex] !== "x") { rootStringIndex = stringIndex; break; }
    }
    title = `Cejilla (${rootStringIndex + 1}ª cuerda) · traste ${raw.baseFret}`;
  }
  return { title, fretPositions: frets, fingerPositions, baseFret: raw.baseFret, position, barre };
}

// Se agrupa por traste base y se elige la mejor digitación de cada posición (más notas de color,
// más cuerdas sonando y menos dedos), para cubrir todo el mástil sin saturar de variantes casi iguales.
function selectVoicings(raws: readonly RawVoicing[], maxResults: number): ChordVoicing[] {
  const byBaseFret = new Map<number, RawVoicing>();
  raws.forEach((raw) => {
    const current = byBaseFret.get(raw.baseFret);
    if (!current || isBetterVoicing(raw, current)) byBaseFret.set(raw.baseFret, raw);
  });
  return [...byBaseFret.values()].sort((left, right) => left.baseFret - right.baseFret).slice(0, maxResults).map(toVoicing);
}

function builderZoneIndex(baseFret: number): number {
  if (baseFret <= 4) return 0;
  if (baseFret <= 11) return 1;
  return 2;
}

function selectVoicingsAcrossNeck(raws: readonly RawVoicing[], maxResults: number): ChordVoicing[] {
  const byBaseFret = new Map<number, RawVoicing>();
  raws.forEach((raw) => {
    const current = byBaseFret.get(raw.baseFret);
    if (!current || isBetterVoicing(raw, current)) byBaseFret.set(raw.baseFret, raw);
  });
  const zones: RawVoicing[][] = [[], [], []];
  [...byBaseFret.values()].sort((left, right) => left.baseFret - right.baseFret).forEach((raw) => {
    zones[builderZoneIndex(raw.baseFret)].push(raw);
  });
  const selected: RawVoicing[] = [];
  while (selected.length < maxResults && zones.some((zone) => zone.length > 0)) {
    zones.forEach((zone) => {
      if (selected.length < maxResults && zone.length > 0) selected.push(zone.shift()!);
    });
  }
  selected.sort((left, right) => left.baseFret - right.baseFret);
  return selected.map(toVoicing);
}

// La raíz, el tono que define la calidad (3ª/sus) y la séptima o sexta pedida nunca se omiten.
// La quinta justa y las tensiones (9/11/13, add) son "color" opcional: suman cuando caben en el
// tramo de 4 trastes, pero se pueden dejar fuera para que aparezcan muchas más posiciones jugables.
function classifyBuilderIntervals(state: ChordBuilderState): { mustHave: number[]; niceToHave: number[] } {
  const base = BASE_INTERVALS[state.base];
  const fifth = state.fifth === "none" ? base[2] : FIFTH_INTERVALS[state.fifth];
  const rawMustHave = [0, base[1]];
  const rawNiceToHave: number[] = [];
  if (fifth === 7) rawNiceToHave.push(fifth); else rawMustHave.push(fifth);
  if (state.seventh !== "none") rawMustHave.push(SEVENTH_INTERVALS[state.seventh]);
  state.extensions.filter((extension) => extension !== "none").forEach((extension) => rawNiceToHave.push(EXTENSION_INTERVALS[extension]));
  state.additions.forEach((addition) => rawNiceToHave.push(ADDITION_INTERVALS[addition]));
  const mustHave = uniqueIntervals(rawMustHave);
  const niceToHave = uniqueIntervals(rawNiceToHave).filter((interval) => !mustHave.includes(interval));
  return { mustHave, niceToHave };
}

export function findChordVoicings(state: ChordBuilderState, maxResults = MAX_VOICING_RESULTS): ChordVoicing[] {
  const rootIndex = noteIndex(state.root);
  const bassIndex = state.bass && state.bass !== "none" ? noteIndex(state.bass) : rootIndex;
  if (rootIndex < 0 || bassIndex < 0) return [];
  const { mustHave, niceToHave } = classifyBuilderIntervals(state);
  const rawVoicings = BUILDER_FRET_ZONES.flatMap((zone) => searchVoicings(rootIndex, mustHave, niceToHave, bassIndex, {
    maxRawResults: MAX_BUILDER_RAW_PER_ZONE,
    maxFret: zone.maxFret,
    maxFretSpan: zone.maxFretSpan,
    firstFret: zone.firstFret,
    realisticFingerAssignments: true,
  }));
  return selectVoicingsAcrossNeck(rawVoicings, maxResults);
}

// Variante genérica para el glosario y cualquier acorde definido solo por su lista de intervalos:
// con más de dos notas, la quinta justa pasa a "color" opcional (igual que en el constructor).
export function findVoicingsForIntervals(
  root: string,
  intervals: readonly number[],
  bass?: string,
  maxResults = MAX_VOICING_RESULTS,
  maxRawResults = MAX_RAW_VOICINGS,
): ChordVoicing[] {
  const rootIndex = noteIndex(root);
  const bassIndex = bass ? noteIndex(bass) : rootIndex;
  if (rootIndex < 0 || bassIndex < 0 || intervals.length === 0) return [];
  const canDropFifth = intervals.length > 2 && intervals.includes(7);
  const mustHave = canDropFifth ? intervals.filter((interval) => interval !== 7) : [...intervals];
  const niceToHave = canDropFifth ? [7] : [];
  return selectVoicings(searchVoicings(rootIndex, mustHave, niceToHave, bassIndex, { maxRawResults }), maxResults);
}

/** Devuelve alternativas por cuerda sin colapsarlas a un único voicing por traste base. */
export function findAllVoicingsForIntervals(
  root: string,
  intervals: readonly number[],
  bass?: string,
  maxRawResults = MAX_RAW_VOICINGS,
  maxFret = MAX_VOICING_FRET,
  maxFretSpan = MAX_FRET_SPAN,
  minFret = 1,
): ChordVoicing[] {
  const rootIndex = noteIndex(root);
  const bassIndex = bass ? noteIndex(bass) : rootIndex;
  if (rootIndex < 0 || bassIndex < 0 || intervals.length === 0) return [];
  const canDropFifth = intervals.length > 2 && intervals.includes(7);
  const mustHave = canDropFifth ? intervals.filter((interval) => interval !== 7) : [...intervals];
  const niceToHave = canDropFifth ? [7] : [];
  const rawVoicings = searchVoicings(rootIndex, mustHave, niceToHave, bassIndex, { maxRawResults, maxFret, maxFretSpan, firstFret: minFret });
  const unique = new Map<string, RawVoicing>();
  rawVoicings.forEach((raw) => unique.set(raw.frets.join(","), raw));
  return [...unique.values()]
    .map(toVoicing)
    .sort((left, right) => left.baseFret - right.baseFret || left.fretPositions.join(",").localeCompare(right.fretPositions.join(",")));
}

function pitchSet(intervals: readonly number[], rootIndex: number): Set<number> {
  return new Set(intervals.map((interval) => (rootIndex + interval) % 12));
}

export function suggestNoteSets(selectedNotes: readonly string[]): NoteSetSuggestion[] {
  const selected = new Set(selectedNotes.map((note) => noteIndex(note)).filter((index) => index >= 0));
  if (selected.size === 0) return [];
  const candidates: Array<{ kind: NoteSetSuggestion["kind"]; name: string; intervals: readonly number[] }> = [];
  Object.values(SCALES).forEach((scale) => candidates.push({ kind: "escala", name: scale.label, intervals: scale.blue === undefined ? scale.intervals : [...scale.intervals, scale.blue] }));
  Object.values(ARPEGGIOS).forEach((arpeggio) => candidates.push({ kind: "arpegio", name: arpeggio.label, intervals: arpeggio.intervals }));
  CHORD_GLOSSARY.forEach((chord) => candidates.push({ kind: "acorde", name: chord.name, intervals: chord.intervals }));
  const suggestions: NoteSetSuggestion[] = [];
  NOTES.forEach((root, rootIndex) => candidates.forEach((candidate) => {
    const candidateSet = pitchSet(candidate.intervals, rootIndex);
    const matched = [...selected].filter((note) => candidateSet.has(note)).length;
    const missing = [...candidateSet].filter((note) => !selected.has(note)).length;
    const extra = [...selected].filter((note) => !candidateSet.has(note)).length;
    suggestions.push({ kind: candidate.kind, name: candidate.name, root, exact: missing === 0 && extra === 0, matched, missing, extra });
  }));
  suggestions.sort((left, right) => Number(right.exact) - Number(left.exact) || (right.matched - right.missing - right.extra) - (left.matched - left.missing - left.extra));
  return suggestions.slice(0, 12);
}

export function noteIndex(note: string): number { return NOTES.indexOf(note as Note); }
export function clampRange(start: number, end: number): Range {
  const safeStart = Math.max(0, Math.min(FRET_COUNT - 3, Number.isFinite(start) ? start : 0));
  const safeEnd = Math.max(safeStart + 3, Math.min(FRET_COUNT, Number.isFinite(end) ? end : FRET_COUNT));
  return { start: safeStart, end: safeEnd };
}
export function noteAt(stringIndex: number, fret: number): Note { return NOTES[(TUNING[stringIndex] + fret) % NOTES.length]; }
export function intervalLabel(interval: number): string { return ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"][interval] ?? ""; }

function markKind(distance: number, intervalCount: number, isBlue: boolean): MarkKind {
  if (isBlue) return "blue";
  if (distance === 0) return "root";
  return intervalCount <= 5 ? "scale" : "chord";
}

function findStringMarks(rootIndex: number, intervals: readonly number[], stringIndex: number, range: Range, blue?: number): FretMark[] {
  const marks: FretMark[] = [];
  for (let fret = range.start; fret <= range.end; fret += 1) {
    const distance = (TUNING[stringIndex] + fret - rootIndex + 24) % 12;
    const isBlue = blue === distance;
    if (intervals.includes(distance) || isBlue) {
      marks.push({ stringIndex, fret, note: noteAt(stringIndex, fret), interval: intervalLabel(distance), kind: markKind(distance, intervals.length, isBlue) });
    }
  }
  return marks;
}

export function findMarks(root: string, intervals: readonly number[], range: Range, blue?: number): FretMark[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0) return [];
  return TUNING.flatMap((_, stringIndex) => findStringMarks(rootIndex, intervals, stringIndex, range, blue));
}

function intervalQualityForDistance(distance: number): string {
  const names: Record<number, string> = {
    1: "2ª menor", 2: "2ª mayor", 3: "3ª menor", 4: "3ª mayor", 5: "4ª justa",
    6: "4ª aumentada", 7: "5ª justa", 8: "6ª menor", 9: "6ª mayor",
    10: "7ª menor", 11: "7ª mayor",
  };
  return names[distance] ?? `${distance} semitonos`;
}

function stringPairsForPattern(pattern: DoubleStopStringPattern): Array<[number, number]> {
  return pattern === "adjacent"
    ? Array.from({ length: 5 }, (_, index): [number, number] => [index, index + 1])
    : Array.from({ length: 4 }, (_, index): [number, number] => [index, index + 2]);
}

function searchDoubleStopPairs(
  root: string,
  distance: number,
  intervalQuality: string,
  range: Range,
  pattern: DoubleStopStringPattern,
  degree?: number,
): DoubleStopStringPairGroup[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0 || !Number.isInteger(distance) || distance <= 0 || distance >= NOTES.length) return [];
  const stringPairs = stringPairsForPattern(pattern);
  const groups: DoubleStopStringPairGroup[] = stringPairs.map((stringPair) => ({ stringPair, pairs: [] }));

  groups.forEach(({ stringPair, pairs }) => {
    const [companionString, baseString] = stringPair;
    for (let fret = range.start; fret <= range.end; fret += 1) {
      const rootPitch = OPEN_STRING_MIDI_STANDARD_TUNING[baseString] + fret;
      const baseDistance = (rootPitch - rootIndex + 12) % 12;
      if (baseDistance !== 0) continue;
      for (let companionFret = range.start; companionFret <= range.end; companionFret += 1) {
        const intervalPitch = OPEN_STRING_MIDI_STANDARD_TUNING[companionString] + companionFret;
        if (intervalPitch - rootPitch !== distance) continue;
        if (Math.abs(companionFret - fret) > 4 && fret !== 0 && companionFret !== 0) continue;
        pairs.push({
          root: { stringIndex: baseString, fret, note: noteAt(baseString, fret), interval: intervalLabel(baseDistance), kind: "root" },
          interval: { stringIndex: companionString, fret: companionFret, note: noteAt(companionString, companionFret), interval: intervalLabel(distance), kind: "chord" },
          distance,
          intervalQuality,
          ...(degree === undefined ? {} : { degree }),
        });
      }
    }
  });
  return groups;
}

export function findDoubleStopPairs(
  root: string,
  distance: number,
  range: Range,
  pattern: DoubleStopStringPattern = "adjacent",
): DoubleStopStringPairGroup[] {
  return searchDoubleStopPairs(root, distance, intervalQualityForDistance(distance), range, pattern);
}

export function findDiatonicDoubleStopPairs(
  key: string,
  intervalType: DiatonicDoubleStopInterval,
  range: Range,
  pattern: DoubleStopStringPattern = DIATONIC_DEFAULT_STRING_PATTERN[intervalType],
): DoubleStopStringPairGroup[] {
  const keyIndex = noteIndex(key);
  const intervals = DIATONIC_DOUBLE_STOP_INTERVALS[intervalType];
  if (keyIndex < 0 || !intervals) return [];
  const groups: DoubleStopStringPairGroup[] = stringPairsForPattern(pattern).map((stringPair) => ({ stringPair, pairs: [] }));
  intervals.forEach(({ distance, quality }, index) => {
    const degreeRoot = NOTES[(keyIndex + MAJOR_SCALE_STEPS[index]) % NOTES.length];
    const degreeGroups = searchDoubleStopPairs(degreeRoot, distance, quality, range, pattern, index + 1);
    degreeGroups.forEach((group, groupIndex) => groups[groupIndex].pairs.push(...group.pairs));
  });
  return groups;
}

export function findVoicingMarks(root: string, intervals: readonly number[], firstString: number, range: Range): FretMark[] {
  const marks = findMarks(root, intervals, range);
  const strings = Array.from({ length: intervals.length }, (_, index) => firstString + index);
  const candidates = strings.map((stringIndex) => marks.filter((mark) => mark.stringIndex === stringIndex));
  const selected = new Set<string>();
  const visit = (index: number, frets: number[], combination: FretMark[]): void => {
    if (index === candidates.length) {
      const soundingFrets = frets.filter((fret) => fret !== 0);
      const isClosed = soundingFrets.length === 0 || Math.max(...soundingFrets) - Math.min(...soundingFrets) <= 4;
      if (isClosed) combination.forEach((mark) => selected.add(`${mark.stringIndex}:${mark.fret}`));
      return;
    }
    candidates[index].forEach((mark) => visit(index + 1, [...frets, mark.fret], [...combination, mark]));
  };
  if (candidates.every((items) => items.length > 0)) visit(0, [], []);
  return marks.filter((mark) => selected.has(`${mark.stringIndex}:${mark.fret}`));
}

export type ScaleSystem = "all" | `block-${number}` | `3nps-${number}` | `4nps-${number}`;
export function findScaleMarks(root: string, intervals: readonly number[], system: ScaleSystem, range: Range, blue?: number): FretMark[] {
  const marks = findMarks(root, intervals, range, blue);
  if (system === "all") return marks;
  const position = Number(system.split("-")[1]) || 0;
  const rootIndex = noteIndex(root);
  const anchor = (rootIndex - TUNING[5] + 12) % 12;
  let width = 4;
  if (system.startsWith("4nps")) width = 6;
  else if (system.startsWith("3nps")) width = 5;
  const start = anchor + ((position * 2) % 12);
  return marks.filter((mark) => mark.fret >= start && mark.fret <= start + width);
}

export interface CagedWindow { shape: Exclude<CagedShape, "ALL">; start: number; end: number; }
function cagedWindows(rootIndex: number, shape: CagedShape): CagedWindow[] {
  const shapes = shape === "ALL" ? CAGED_SHAPES : CAGED_SHAPES.filter((item) => item.id === shape);
  const windows: CagedWindow[] = [];
  shapes.forEach((item) => {
    const anchor = (rootIndex - TUNING[item.rootString] + 12) % 12;
    [0, 12].forEach((shift) => {
      windows.push({ shape: item.id as Exclude<CagedShape, "ALL">, start: anchor + item.startOffset + shift, end: anchor + item.endOffset + shift });
    });
  });
  return windows;
}

// bloques visibles para dibujar los recuadros CAGED, recortados al rango de trastes mostrado
export function findCagedBoxes(root: string, shape: CagedShape, range: Range): CagedWindow[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0) return [];
  return cagedWindows(rootIndex, shape)
    .filter((window) => window.end >= range.start && window.start <= range.end)
    .map((window) => ({ shape: window.shape, start: Math.max(window.start, range.start), end: Math.min(window.end, range.end) }));
}

export function findCagedMarks(root: string, shape: CagedShape, range: Range): FretMark[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0) return [];
  const windows = cagedWindows(rootIndex, shape);
  const marks = findMarks(root, [0, 4, 7], range);
  return marks.filter((mark) => windows.some((window) => mark.fret >= window.start && mark.fret <= window.end));
}

export function findCagedLayerMarks(root: string, shape: CagedShape, quality: CagedQuality, layer: CagedLayer, range: Range): FretMark[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0) return [];
  const definition = CAGED_QUALITIES[quality];
  let intervals = definition.scale;
  if (layer === "chord") intervals = definition.chord;
  else if (layer === "pentatonic") intervals = definition.pentatonic;
  const windows = cagedWindows(rootIndex, shape);
  const chordMarks = findMarks(root, definition.chord, range);
  return findMarks(root, intervals, range)
    .filter((mark) => windows.some((window) => mark.fret >= window.start && mark.fret <= window.end))
    .map((mark) => {
      const isChordTone = chordMarks.some((chord) => chord.stringIndex === mark.stringIndex && chord.fret === mark.fret);
      return isChordTone ? { ...mark, kind: mark.interval === "1" ? "root" as const : "chord" as const } : mark;
    });
}
// ==========================================
// MODELO DE 2 DIMENSIONES PARA src/domain.ts
// ==========================================

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = 'bb' | 'b' | '' | '#' | '##';

export interface LetterInfo {
  readonly index: number;
  readonly semitones: number;
}

export const LETTERS: Record<Letter, LetterInfo> = {
  C: { index: 0, semitones: 0 },
  D: { index: 1, semitones: 2 },
  E: { index: 2, semitones: 4 },
  F: { index: 3, semitones: 5 },
  G: { index: 4, semitones: 7 },
  A: { index: 5, semitones: 9 },
  B: { index: 6, semitones: 11 },
};

export const INDEX_TO_LETTER: Record<number, Letter> = {
  0: 'C', 1: 'D', 2: 'E', 3: 'F', 4: 'G', 5: 'A', 6: 'B',
};

export const ACCIDENTAL_VALUES: Record<Accidental, number> = {
  'bb': -2, 'b': -1, '': 0, '#': 1, '##': 2,
};

export const VALUE_TO_ACCIDENTAL: Record<number, Accidental> = {
  '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##',
};

export class MusicNote {
  constructor(
    public readonly letter: Letter,
    public readonly accidental: Accidental = '',
    public readonly octave: number = 4
  ) { }

  get absoluteSemitones(): number {
    return this.octave * 12 + LETTERS[this.letter].semitones + ACCIDENTAL_VALUES[this.accidental];
  }

  static parse(str: string, defaultOctave = 4): MusicNote {
    const match = /^([A-G])(bb|b|##|#)?(-?\d+)?$/.exec(str.trim());
    if (!match) throw new Error(`Nota inválida: ${str}`);
    return new MusicNote(
      match[1] as Letter,
      (match[2] || '') as Accidental,
      match[3] !== undefined ? Number.parseInt(match[3], 10) : defaultOctave
    );
  }

  toString(includeOctave = false): string {
    return `${this.letter}${this.accidental}${includeOctave ? this.octave : ''}`;
  }
}

export interface IntervalSpec {
  readonly steps: number;     // Grado diatónico (0 = Unísono, 1 = Segunda, 2 = Tercera...)
  readonly semitones: number; // Distancia cromática real
}

/**
 * ALGORITMO CORE: addInterval (3 pasos obligatorios)
 */
export function addInterval(root: MusicNote, interval: IntervalSpec): MusicNote {
  const rootInfo = LETTERS[root.letter];

  // Paso 1: Grado Diatónico (Módulo 7)
  const rawIndex = rootInfo.index + interval.steps;
  const newLetterIndex = ((rawIndex % 7) + 7) % 7;
  const newLetter = INDEX_TO_LETTER[newLetterIndex];

  // Paso 2: Cálculo de Octava
  const newOctave = root.octave + Math.floor(rawIndex / 7);

  // Paso 3: Ajuste Cromático (Diferencia de semitonos)
  const targetSemitones = root.absoluteSemitones + interval.semitones;
  const baseNaturalSemitones = newOctave * 12 + LETTERS[newLetter].semitones;
  const diff = targetSemitones - baseNaturalSemitones;

  const newAccidental = VALUE_TO_ACCIDENTAL[diff];
  if (newAccidental === undefined) {
    throw new Error(`Enarmonía no soportada (diferencia: ${diff})`);
  }

  return new MusicNote(newLetter, newAccidental, newOctave);
}

export interface ScaleFormula {
  readonly name: string;
  readonly description: string;
  readonly intervals: IntervalSpec[];
}

export const SCALES_2D: Record<ScaleId, ScaleFormula> = {
  "mayor": {
    name: "Mayor (Ionian)",
    description: "Alegría, estabilidad. La base de la música occidental.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 4 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 9 },
      { steps: 6, semitones: 11 },
    ]
  },
  "menor": {
    name: "Menor Natural (Aeolian)",
    description: "Tristeza, introspección. Tono nostálgico.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 8 },
      { steps: 6, semitones: 10 },
    ]
  },
  "armonica": {
    name: "Menor Armónica",
    description: "Sonido exótico, Oriente. Célula del tango y flamenco.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 8 },
      { steps: 6, semitones: 11 }, // 7b y 7# simultáneas en la fórmula
    ]
  },
  "melodica": {
    name: "Menor Melódica",
    description: "Elegancia jazzística. Ascendente: sube la 6ª y 7ª. Descendente: menor natural.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 9 }, // 6ª Mayor
      { steps: 6, semitones: 11 },// 7ª Mayor
    ]
  },
  "dorico": {
    name: "Dórico",
    description: "Suave, melancólico. Jazz, bossa nova, rock alternativo.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 9 },
      { steps: 6, semitones: 10 },
    ]
  },
  "frigio": {
    name: "Frigio",
    description: "Tensión, Flamenco, Metal. La segunda menor le da el color.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 1 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 8 },
      { steps: 6, semitones: 10 },
    ]
  },
  "lidio": {
    name: "Lidio",
    description: "Ensueño, magia. La cuarta aumentada flotante crea ingravidez.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 4 },
      { steps: 3, semitones: 6 },  // #4
      { steps: 4, semitones: 7 },  // 5ta justa
      { steps: 5, semitones: 9 },  // 6ta mayor
      { steps: 6, semitones: 11 }, // 7ma mayor
    ]
  },
  "mixolidio": {
    name: "Mixolidio",
    description: "Blues, Funk, Rock 'n Roll. Séptima menor sobre mayor.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 4 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 9 },
      { steps: 6, semitones: 10 },
    ]
  },
  "locrio": {
    name: "Locrio",
    description: "Tensión máxima. Inestable. Usado para disonancias deliberadas.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 1 },
      { steps: 2, semitones: 3 },
      { steps: 3, semitones: 5 },
      { steps: 4, semitones: 6 }, // b5
      { steps: 5, semitones: 8 },
      { steps: 6, semitones: 10 },
    ]
  },
  "pent-menor": {
    name: "Pentatónica Menor",
    description: "Blues y Rock clásico. La base de casi toda la guitarra eléctrica.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 3 },
      { steps: 2, semitones: 5 },
      { steps: 3, semitones: 7 },
      { steps: 4, semitones: 10 },
    ]
  },
  "pent-mayor": {
    name: "Pentatónica Mayor",
    description: "Sonido country y folk. Dulce y brillante.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 4 },
      { steps: 3, semitones: 7 },
      { steps: 4, semitones: 9 },
    ]
  },
  "blues-menor": {
    name: "Blues Menor",
    description: "Pentatónica menor + Blue note (tritono). El sonido del blues profundo.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 3 },  // b3
      { steps: 2, semitones: 5 },  // 4
      { steps: 3, semitones: 6 },  // Blue Note (b5) -> 3 pasos (grado 4/5)
      { steps: 4, semitones: 7 },  // 5
      { steps: 5, semitones: 10 }, // b7
    ]
  },
  "blues-mayor": {
    name: "Blues Mayor",
    description: "Pentatónica mayor con blue note. Sonido sureño y rockero.",
    intervals: [
      { steps: 0, semitones: 0 },
      { steps: 1, semitones: 2 },
      { steps: 2, semitones: 3 }, // Blue note
      { steps: 3, semitones: 4 },
      { steps: 4, semitones: 7 },
      { steps: 5, semitones: 9 },
    ]
  }
}