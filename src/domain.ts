import { ARPEGGIOS, CHORD_GLOSSARY, CAGED_QUALITIES, CAGED_SHAPES, FRET_COUNT, NOTES, SCALES, TUNING, type CagedLayer, type CagedQuality, type CagedShape, type Note } from "./data";

export type MarkKind = "root" | "chord" | "scale" | "blue";
export interface FretMark { stringIndex: number; fret: number; note: Note; interval: string; kind: MarkKind; }
export interface Range { start: number; end: number; }

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
export interface ChordVoicing {
  title: string;
  fretPositions: readonly (number | -1)[];
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

export function buildChord(state: ChordBuilderState): BuiltChord {
  const rootIndex = noteIndex(state.root);
  if (rootIndex < 0) return { name: "", notes: [], intervals: [] };
  const intervals = [...BASE_INTERVALS[state.base]];
  if (state.fifth !== "none") intervals[intervals.length - 1] = FIFTH_INTERVALS[state.fifth];
  if (state.seventh !== "none") intervals.push(SEVENTH_INTERVALS[state.seventh]);
  state.extensions.filter((extension) => extension !== "none").forEach((extension) => intervals.push(EXTENSION_INTERVALS[extension]));
  state.additions.forEach((addition) => intervals.push(ADDITION_INTERVALS[addition]));
  const normalizedIntervals = uniqueIntervals(intervals);
  const notes = normalizedIntervals.map((interval) => NOTES[(rootIndex + interval) % NOTES.length]);
  const bass = state.bass && state.bass !== "none" && noteIndex(state.bass) >= 0 ? state.bass as Note : undefined;
  const hasMinorThird = normalizedIntervals.includes(3);
  const hasMajorThird = normalizedIntervals.includes(4);
  const hasFlatSeven = normalizedIntervals.includes(10);
  const isDominantNinth = state.seventh === "7" && state.extensions.includes("9") && state.base === "major" && hasMajorThird && hasFlatSeven;
  const isMajorNinth = state.seventh === "7M" && state.extensions.includes("9") && state.base === "major";
  let suffix = state.base === "minor" ? "m" : state.base === "sus2" ? "sus2" : state.base === "sus4" ? "sus4" : state.base === "aug" ? "aug" : state.base === "dim" ? "dim" : "";
  if (isDominantNinth) suffix = "9";
  else if (isMajorNinth) suffix = "maj9";
  else if (state.seventh === "7M") suffix += "maj7";
  else if (state.seventh === "7") suffix += "7";
  else if (state.seventh === "6") suffix += "6";
  if (state.fifth === "b5" && state.base !== "dim") suffix += "b5";
  if (state.fifth === "#5" && state.base !== "aug") suffix += "#5";
  state.extensions.filter((extension) => extension !== "none").forEach((extension) => {
    if (!(isDominantNinth && extension === "9") && !(isMajorNinth && extension === "9")) suffix += extensionLabel(extension);
  });
  state.additions.forEach((addition) => { if (!suffix.includes(addition)) suffix += addition; });
  if (state.base === "major" && state.fifth === "5" && state.seventh === "none" && state.extensions.length === 0 && state.additions.length === 0 && !hasMinorThird) suffix = "";
  const name = `${state.root}${suffix}${bass ? `/${bass}` : ""}`;
  return { name, notes, intervals: normalizedIntervals, bass };
}

const MAX_VOICING_FRET = 12;
const MAX_FRET_SPAN = 3;
const MAX_FINGERS = 4;
const MIN_SOUNDING_STRINGS = 3;
const MAX_VOICING_RESULTS = 12;
const MAX_RAW_VOICINGS = 300;

interface RawVoicing {
  frets: (number | -1)[];
  coverage: number;
  soundingStrings: number;
  baseFret: number;
  fingerCount: number;
}

// Recorre las 6 cuerdas probando silencio, cuerda al aire o traste 1-12 en cada una. Descarta
// combinaciones con notas ajenas al acorde, con el bajo equivocado, con más de 4 dedos libres
// (sin contar cejilla) o con un mástil de más de 4 trastes de ancho. Así se generan digitaciones
// reales en cualquier posición, igual que hacen los generadores de acordes tipo "Chord!".
function searchVoicings(rootIndex: number, mustHave: readonly number[], niceToHave: readonly number[], bassIndex: number): RawVoicing[] {
  const must = new Set(mustHave.map((interval) => (rootIndex + interval + 1200) % 12));
  const nice = new Set(niceToHave.map((interval) => (rootIndex + interval + 1200) % 12));
  const allowed = new Set<number>([...must, ...nice]);
  const results: RawVoicing[] = [];
  if (must.size > 6) return results;
  const frets: (number | -1)[] = [-1, -1, -1, -1, -1, -1];

  const finalize = (soundingStrings: number, covered: Set<number>): void => {
    if (soundingStrings < MIN_SOUNDING_STRINGS) return;
    for (const pitch of must) if (!covered.has(pitch)) return;
    const fretCounts = new Map<number, number>();
    frets.forEach((fret) => { if (fret > 0) fretCounts.set(fret, (fretCounts.get(fret) ?? 0) + 1); });
    if (fretCounts.size > MAX_FINGERS) return;
    const fretted = frets.filter((fret) => fret > 0);
    const baseFret = fretted.length > 0 ? Math.min(...fretted) : 0;
    let coverage = 0;
    covered.forEach((pitch) => { if (nice.has(pitch)) coverage += 1; });
    results.push({ frets: [...frets], coverage, soundingStrings, baseFret, fingerCount: fretCounts.size });
  };

  const recurse = (stringIndex: number, bassFound: boolean, minFret: number, maxFret: number, soundingStrings: number, covered: Set<number>): void => {
    if (results.length >= MAX_RAW_VOICINGS) return;
    if (stringIndex < 0) { finalize(soundingStrings, covered); return; }
    frets[stringIndex] = -1;
    recurse(stringIndex - 1, bassFound, minFret, maxFret, soundingStrings, covered);
    const openPitch = TUNING[stringIndex];
    const openValid = bassFound ? allowed.has(openPitch) : openPitch === bassIndex;
    if (openValid) {
      frets[stringIndex] = 0;
      const nextCovered = covered.has(openPitch) ? covered : new Set(covered).add(openPitch);
      recurse(stringIndex - 1, true, minFret, maxFret, soundingStrings + 1, nextCovered);
    }
    for (let fret = 1; fret <= MAX_VOICING_FRET; fret += 1) {
      const pitch = (TUNING[stringIndex] + fret) % 12;
      const valid = bassFound ? allowed.has(pitch) : pitch === bassIndex;
      if (!valid) continue;
      const nextMin = Math.min(minFret, fret);
      const nextMax = Math.max(maxFret, fret);
      if (nextMax - nextMin > MAX_FRET_SPAN) continue;
      frets[stringIndex] = fret;
      const nextCovered = covered.has(pitch) ? covered : new Set(covered).add(pitch);
      recurse(stringIndex - 1, true, nextMin, nextMax, soundingStrings + 1, nextCovered);
    }
    frets[stringIndex] = -1;
  };

  recurse(5, false, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, new Set());
  return results;
}

function isBetterVoicing(candidate: RawVoicing, current: RawVoicing): boolean {
  if (candidate.coverage !== current.coverage) return candidate.coverage > current.coverage;
  if (candidate.soundingStrings !== current.soundingStrings) return candidate.soundingStrings > current.soundingStrings;
  return candidate.fingerCount < current.fingerCount;
}

function toVoicing(raw: RawVoicing): ChordVoicing {
  const frets = raw.frets;
  const distinctFrets = [...new Set(frets.filter((fret) => fret > 0))].sort((left, right) => left - right);
  const fingerByFret = new Map<number, number>(distinctFrets.map((fret, index) => [fret, index + 1]));
  const fingerPositions = frets.map((fret) => (fret > 0 ? fingerByFret.get(fret) ?? 0 : 0));
  // Un traste compartido por 2+ cuerdas implica dedo índice en cejilla: el dedo se apoya en todo
  // el ancho de cuerdas que suenan, aunque otros dedos pisen trastes más altos en medio.
  let barre: ChordVoicing["barre"];
  if (distinctFrets.length > 0) {
    const lowestFret = distinctFrets[0];
    const soundingIndices = frets.reduce<number[]>((acc, fret, index) => { if (fret !== -1) acc.push(index); return acc; }, []);
    const atLowestCount = frets.filter((fret) => fret === lowestFret).length;
    if (atLowestCount >= 2 && soundingIndices.length > 0) barre = { fret: lowestFret, fromString: soundingIndices[0], toString: soundingIndices[soundingIndices.length - 1] };
  }
  let rootStringIndex = 0;
  for (let index = 5; index >= 0; index -= 1) { if (frets[index] !== -1) { rootStringIndex = index; break; } }
  const position: ChordVoicing["position"] = raw.baseFret === 0 ? "abierta" : barre ? "cejilla" : "movible";
  const title = position === "abierta" ? "Posición abierta" : position === "cejilla" ? `Cejilla (${rootStringIndex + 1}ª cuerda) · traste ${raw.baseFret}` : `Posición · traste ${raw.baseFret}`;
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
  return selectVoicings(searchVoicings(rootIndex, mustHave, niceToHave, bassIndex), maxResults);
}

// Variante genérica para el glosario y cualquier acorde definido solo por su lista de intervalos:
// con más de dos notas, la quinta justa pasa a "color" opcional (igual que en el constructor).
export function findVoicingsForIntervals(root: string, intervals: readonly number[], bass?: string, maxResults = MAX_VOICING_RESULTS): ChordVoicing[] {
  const rootIndex = noteIndex(root);
  const bassIndex = bass ? noteIndex(bass) : rootIndex;
  if (rootIndex < 0 || bassIndex < 0 || intervals.length === 0) return [];
  const canDropFifth = intervals.length > 2 && intervals.includes(7);
  const mustHave = canDropFifth ? intervals.filter((interval) => interval !== 7) : [...intervals];
  const niceToHave = canDropFifth ? [7] : [];
  return selectVoicings(searchVoicings(rootIndex, mustHave, niceToHave, bassIndex), maxResults);
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
  return suggestions.sort((left, right) => Number(right.exact) - Number(left.exact) || (right.matched - right.missing - right.extra) - (left.matched - left.missing - left.extra)).slice(0, 12);
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

export function findDoubleStops(root: string, distance: number, range: Range): FretMark[] {
  const rootIndex = noteIndex(root);
  if (rootIndex < 0) return [];
  const marks: FretMark[] = [];
  for (let baseString = 1; baseString <= 5; baseString += 1) {
    for (let fret = range.start; fret <= range.end; fret += 1) {
      const baseDistance = (TUNING[baseString] + fret - rootIndex + 24) % 12;
      if (baseDistance !== 0) continue;
      [baseString - 1, baseString - 2].filter((stringIndex) => stringIndex >= 0).forEach((companionString) => {
        for (let companionFret = range.start; companionFret <= range.end; companionFret += 1) {
          const companionDistance = (TUNING[companionString] + companionFret - rootIndex + 24) % 12;
          if (companionDistance !== distance) continue;
          if (Math.abs(companionFret - fret) > 4 && fret !== 0 && companionFret !== 0) continue;
          marks.push({ stringIndex: baseString, fret, note: noteAt(baseString, fret), interval: intervalLabel(baseDistance), kind: "root" });
          marks.push({ stringIndex: companionString, fret: companionFret, note: noteAt(companionString, companionFret), interval: intervalLabel(companionDistance), kind: "chord" });
        }
      });
    }
  }
  return marks.filter((mark, index, all) => all.findIndex((candidate) => candidate.stringIndex === mark.stringIndex && candidate.fret === mark.fret) === index);
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
  const width = system.startsWith("4nps") ? 6 : system.startsWith("3nps") ? 5 : 4;
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
