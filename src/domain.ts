import { CAGED_QUALITIES, CAGED_SHAPES, FRET_COUNT, NOTES, TUNING, type CagedLayer, type CagedQuality, type CagedShape, type Note } from "./data";

export type MarkKind = "root" | "chord" | "scale" | "blue";
export interface FretMark { stringIndex: number; fret: number; note: Note; interval: string; kind: MarkKind; }
export interface Range { start: number; end: number; }

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
  for (let stringIndex = 1; stringIndex < TUNING.length; stringIndex += 1) {
    for (let fret = range.start; fret <= range.end; fret += 1) {
      const noteDistance = (TUNING[stringIndex] + fret - rootIndex + 24) % 12;
      if (noteDistance === 0 || noteDistance === distance) {
        marks.push({ stringIndex, fret, note: noteAt(stringIndex, fret), interval: intervalLabel(noteDistance), kind: noteDistance === 0 ? "root" : "chord" });
      }
    }
  }
  return marks;
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

export type ScaleSystem = "all" | `block-${number}` | `3nps-${number}`;
export function findScaleMarks(root: string, intervals: readonly number[], system: ScaleSystem, range: Range, blue?: number): FretMark[] {
  const marks = findMarks(root, intervals, range, blue);
  if (system === "all") return marks;
  const position = Number(system.split("-")[1]) || 0;
  const rootIndex = noteIndex(root);
  const anchor = (rootIndex - TUNING[5] + 12) % 12;
  const width = system.startsWith("3nps") ? 5 : 4;
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
