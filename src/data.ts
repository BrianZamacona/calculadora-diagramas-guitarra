export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type Note = (typeof NOTES)[number];

export const TUNING = [4, 11, 7, 2, 9, 4] as const;
export const STRINGS = ["e", "B", "G", "D", "A", "E"] as const;
export const FRET_COUNT = 24;

export interface ScaleData { label: string; intervals: readonly number[]; construction: string; harmony: string; blue?: number; }
export type ScaleId = keyof typeof SCALES;
const scale = (label: string, intervals: readonly number[], construction: string, harmony: string, blue?: number): ScaleData => ({ label, intervals, construction, harmony, blue });
export const SCALES = {
  mayor: scale("Mayor (Jónico)", [0, 2, 4, 5, 7, 9, 11], "T-T-ST-T-T-T-ST", "I - ii - iii - IV - V - vi - vii°"),
  menor: scale("Menor natural (Eólico)", [0, 2, 3, 5, 7, 8, 10], "T-ST-T-T-ST-T-T", "i - ii° - III - iv - v - VI - VII"),
  armonica: scale("Menor armónica", [0, 2, 3, 5, 7, 8, 11], "T-ST-T-T-ST-3ST-ST", "i - ii° - III+ - iv - V - VI - vii°"),
  melodica: scale("Menor melódica", [0, 2, 3, 5, 7, 9, 11], "T-ST-T-T-T-T-ST", "i - ii - III+ - IV - V - vi° - vii°"),
  "pent-menor": scale("Pentatónica menor", [0, 3, 5, 7, 10], "3ST-T-T-3ST-T", "i - III - iv - v - VII"),
  "pent-mayor": scale("Pentatónica mayor", [0, 2, 4, 7, 9], "T-T-3ST-T-3ST", "I - ii - iii - V - vi"),
  "blues-menor": scale("Blues menor", [0, 3, 5, 7, 10], "3ST-T-ST-ST-3ST-T", "I7 - IV7 - V7", 6),
  "blues-mayor": scale("Blues mayor", [0, 2, 4, 7, 9], "T-T-ST-3ST-T-3ST", "I7 - IV7 - V7", 3),
  dorico: scale("Dórico", [0, 2, 3, 5, 7, 9, 10], "T-ST-T-T-T-ST-T", "i - ii - III - IV - v - vi° - VII"),
  frigio: scale("Frigio", [0, 1, 3, 5, 7, 8, 10], "ST-T-T-T-ST-T-T", "i - II - III - iv - v° - VI - vii"),
  lidio: scale("Lidio", [0, 2, 4, 6, 7, 9, 11], "T-T-T-ST-T-T-ST", "I - II - iii - iv° - V - vi - vii"),
  mixolidio: scale("Mixolidio", [0, 2, 4, 5, 7, 9, 10], "T-T-ST-T-T-ST-T", "I - ii - iii° - IV - v - vi - VII"),
  locrio: scale("Locrio", [0, 1, 3, 5, 6, 8, 10], "ST-T-T-ST-T-T-T", "i° - II - iii - iv - V - VI - vii"),
} as const;

export const ARPEGGIOS = {
  maj: { label: "Mayor", intervals: [0, 4, 7] },
  min: { label: "Menor", intervals: [0, 3, 7] },
  maj7: { label: "Mayor 7", intervals: [0, 4, 7, 11] },
  min7: { label: "Menor 7", intervals: [0, 3, 7, 10] },
  dom7: { label: "Dominante 7", intervals: [0, 4, 7, 10] },
  m7b5: { label: "Semidisminuido", intervals: [0, 3, 6, 10] },
  dim7: { label: "Disminuido 7", intervals: [0, 3, 6, 9] },
} as const;

export type ArpeggioId = keyof typeof ARPEGGIOS;
export type CagedShape = "C" | "A" | "G" | "E" | "D" | "ALL";
export const CAGED_SHAPES: ReadonlyArray<{ id: CagedShape; label: string; rootString: number; startOffset: number; endOffset: number }> = [
  { id: "C", label: "Forma C", rootString: 4, startOffset: -3, endOffset: 1 },
  { id: "A", label: "Forma A", rootString: 4, startOffset: 0, endOffset: 4 },
  { id: "G", label: "Forma G", rootString: 5, startOffset: -3, endOffset: 1 },
  { id: "E", label: "Forma E", rootString: 5, startOffset: 0, endOffset: 4 },
  { id: "D", label: "Forma D", rootString: 3, startOffset: 0, endOffset: 4 },
];
export type CagedQuality = "maj" | "min" | "dom7" | "maj7" | "min7" | "m-maj7" | "m7b5" | "dim" | "dim7" | "aug" | "maj7sharp5";
export const CAGED_QUALITIES: Record<CagedQuality, { label: string; chord: readonly number[]; pentatonic: readonly number[]; scale: readonly number[] }> = {
  maj: { label: "Mayor", chord: [0, 4, 7], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 11] },
  min: { label: "Menor", chord: [0, 3, 7], pentatonic: [0, 3, 5, 7, 10], scale: [0, 2, 3, 5, 7, 8, 10] },
  dom7: { label: "Dominante 7", chord: [0, 4, 7, 10], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 10] },
  maj7: { label: "Mayor 7", chord: [0, 4, 7, 11], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 11] },
  min7: { label: "Menor 7", chord: [0, 3, 7, 10], pentatonic: [0, 3, 5, 7, 10], scale: [0, 2, 3, 5, 7, 8, 10] },
  "m-maj7": { label: "Menor con 7ª mayor", chord: [0, 3, 7, 11], pentatonic: [0, 3, 7], scale: [0, 2, 3, 5, 7, 9, 11] },
  m7b5: { label: "Semidisminuido / m7b5", chord: [0, 3, 6, 10], pentatonic: [0, 3, 6, 10], scale: [0, 1, 3, 5, 6, 8, 10] },
  dim7: { label: "Disminuido 7", chord: [0, 3, 6, 9], pentatonic: [0, 3, 6, 9], scale: [0, 3, 6, 9] },
  maj7sharp5: { label: "Aumentada con 7ª mayor", chord: [0, 4, 8, 11], pentatonic: [0, 4, 8], scale: [0, 2, 4, 6, 8, 9, 11] },
  dim: { label: "Disminuida", chord: [0, 3, 6], pentatonic: [0, 3, 6], scale: [0, 2, 3, 5, 6, 8, 10] },
  aug: { label: "Aumentada", chord: [0, 4, 8], pentatonic: [0, 4, 8], scale: [0, 2, 4, 6, 8, 10] },
} as const;
export type CagedLayer = "chord" | "pentatonic" | "scale";
export type ModuleId = "triadas" | "arp" | "esc" | "ds" | "caged";
export const INTERVAL_LABELS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"] as const;
