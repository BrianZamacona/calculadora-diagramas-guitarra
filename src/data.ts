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
  Maj: { label: "Mayor", intervals: [0, 4, 7] },
  min: { label: "Menor", intervals: [0, 3, 7] },
  aug: { label: "Aumentado", intervals: [0, 4, 8] },
  dim: { label: "Disminuido", intervals: [0, 3, 6] },
  Maj7: { label: "Mayor 7", intervals: [0, 4, 7, 11] },
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
export type CagedQuality = "Maj" | "min" | "dom7" | "Maj7" | "min7" | "m-Maj7" | "m7b5" | "dim" | "dim7" | "aug" | "Maj7sharp5";
export const CAGED_QUALITIES: Record<CagedQuality, { label: string; chord: readonly number[]; pentatonic: readonly number[]; scale: readonly number[] }> = {
  Maj: { label: "Mayor", chord: [0, 4, 7], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 11] },
  min: { label: "Menor", chord: [0, 3, 7], pentatonic: [0, 3, 5, 7, 10], scale: [0, 2, 3, 5, 7, 8, 10] },
  dom7: { label: "Dominante 7", chord: [0, 4, 7, 10], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 10] },
  Maj7: { label: "Mayor 7", chord: [0, 4, 7, 11], pentatonic: [0, 2, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 11] },
  min7: { label: "Menor 7", chord: [0, 3, 7, 10], pentatonic: [0, 3, 5, 7, 10], scale: [0, 2, 3, 5, 7, 8, 10] },
  "m-Maj7": { label: "Menor con 7ª mayor", chord: [0, 3, 7, 11], pentatonic: [0, 3, 7], scale: [0, 2, 3, 5, 7, 9, 11] },
  m7b5: { label: "Semidisminuido / m7b5", chord: [0, 3, 6, 10], pentatonic: [0, 3, 6, 10], scale: [0, 1, 3, 5, 6, 8, 10] },
  dim7: { label: "Disminuido 7", chord: [0, 3, 6, 9], pentatonic: [0, 3, 6, 9], scale: [0, 3, 6, 9] },
  Maj7sharp5: { label: "Aumentada con 7ª mayor", chord: [0, 4, 8, 11], pentatonic: [0, 4, 8], scale: [0, 2, 4, 6, 8, 9, 11] },
  dim: { label: "Disminuida", chord: [0, 3, 6], pentatonic: [0, 3, 6], scale: [0, 2, 3, 5, 6, 8, 10] },
  aug: { label: "Aumentada", chord: [0, 4, 8], pentatonic: [0, 4, 8], scale: [0, 2, 4, 6, 8, 10] },
} as const;
export type CagedLayer = "chord" | "pentatonic" | "scale";
export interface ChordGlossaryEntry {
  id: string;
  name: string;
  symbol: string;
  category: string;
  family: string;
  intervals: readonly number[];
  formula: string;
  voicing: "abierto" | "cerrado" | "mixto";
  level: "principiante" | "avanzado";
  description: string;
}
export const CHORD_CATEGORIES = [
  "Todos",
  "Principiantes",
  "Avanzados",
  "Séptimas",
  "Extensiones",
  "Alterados y suspendidos",
  "Jazz y especiales",
] as const;
export const CHORD_GLOSSARY: readonly ChordGlossaryEntry[] = [
  { id: "Major", name: "Mayor", symbol: "C", category: "Principiantes", family: "Triadas", intervals: [0, 4, 7], formula: "1 - 3 - 5", voicing: "abierto", level: "principiante", description: "Base luminosa formada por raíz, tercera mayor y quinta justa." },
  { id: "minor", name: "Menor", symbol: "Cm", category: "Principiantes", family: "Triadas", intervals: [0, 3, 7], formula: "1 - b3 - 5", voicing: "abierto", level: "principiante", description: "Triada menor con tercera menor; conserva la quinta justa." },
  { id: "power", name: "Quinta de poder", symbol: "C5", category: "Principiantes", family: "Quintas", intervals: [0, 7], formula: "1 - 5", voicing: "abierto", level: "principiante", description: "Voicing sin tercera, útil para rock y distorsión." },
  { id: "sus2", name: "Suspendido 2", symbol: "Csus2", category: "Alterados y suspendidos", family: "Sus", intervals: [0, 2, 7], formula: "1 - 2 - 5", voicing: "abierto", level: "principiante", description: "La segunda reemplaza a la tercera y deja el acorde abierto." },
  { id: "sus4", name: "Suspendido 4", symbol: "Csus4", category: "Alterados y suspendidos", family: "Sus", intervals: [0, 5, 7], formula: "1 - 4 - 5", voicing: "abierto", level: "principiante", description: "La cuarta reemplaza a la tercera y suele resolver hacia mayor." },
  { id: "aug", name: "Aumentado", symbol: "Caug", category: "Alterados y suspendidos", family: "Triadas alteradas", intervals: [0, 4, 8], formula: "1 - 3 - #5", voicing: "cerrado", level: "avanzado", description: "Triada simétrica con quinta aumentada." },
  { id: "dim", name: "Disminuido", symbol: "Cdim", category: "Alterados y suspendidos", family: "Triadas alteradas", intervals: [0, 3, 6], formula: "1 - b3 - b5", voicing: "cerrado", level: "avanzado", description: "Triada inestable con tercera menor y quinta disminuida." },
  { id: "Major7", name: "Mayor séptima", symbol: "CMaj7", category: "Séptimas", family: "Séptimas", intervals: [0, 4, 7, 11], formula: "1 - 3 - 5 - 7", voicing: "cerrado", level: "avanzado", description: "Sonoridad mayor sofisticada, frecuente en jazz y pop." },
  { id: "dominant7", name: "Séptima dominante", symbol: "C7", category: "Séptimas", family: "Séptimas", intervals: [0, 4, 7, 10], formula: "1 - 3 - 5 - b7", voicing: "mixto", level: "principiante", description: "Acorde de tensión que normalmente resuelve una quinta abajo." },
  { id: "minor7", name: "Menor séptima", symbol: "Cm7", category: "Séptimas", family: "Séptimas", intervals: [0, 3, 7, 10], formula: "1 - b3 - 5 - b7", voicing: "mixto", level: "principiante", description: "Sonido menor suave, central en blues, funk y jazz." },
  { id: "dim7", name: "Disminuido séptima", symbol: "Cdim7", category: "Séptimas", family: "Séptimas", intervals: [0, 3, 6, 9], formula: "1 - b3 - b5 - bb7", voicing: "cerrado", level: "avanzado", description: "Estructura simétrica de tensión máxima." },
  { id: "half-dim7", name: "Semidisminuido", symbol: "Cm7b5", category: "Séptimas", family: "Séptimas", intervals: [0, 3, 6, 10], formula: "1 - b3 - b5 - b7", voicing: "cerrado", level: "avanzado", description: "También llamado m7b5; aparece en el segundo grado menor." },
  { id: "sixth", name: "Sexta mayor", symbol: "C6", category: "Extensiones", family: "Sextas", intervals: [0, 4, 7, 9], formula: "1 - 3 - 5 - 6", voicing: "cerrado", level: "avanzado", description: "Triada mayor coloreada con sexta mayor." },
  { id: "add9", name: "Add nueve", symbol: "Cadd9", category: "Extensiones", family: "Add", intervals: [0, 4, 7, 2], formula: "1 - 3 - 5 - 9", voicing: "abierto", level: "principiante", description: "Añade la novena sin sustituir la séptima, ideal para guitarras abiertas." },
  { id: "nine", name: "Novena dominante", symbol: "C9", category: "Extensiones", family: "Novenas", intervals: [0, 4, 7, 10, 2], formula: "1 - 3 - 5 - b7 - 9", voicing: "cerrado", level: "avanzado", description: "Séptima dominante extendida con novena mayor." },
  { id: "eleven", name: "Onceava dominante", symbol: "C11", category: "Extensiones", family: "Onceavas", intervals: [0, 4, 7, 10, 2, 5], formula: "1 - 3 - 5 - b7 - 9 - 11", voicing: "cerrado", level: "avanzado", description: "Extensión amplia de dominante; algunos voicings omiten la tercera." },
  { id: "thirteen", name: "Treceava dominante", symbol: "C13", category: "Extensiones", family: "Treceavas", intervals: [0, 4, 7, 10, 2, 5, 9], formula: "1 - 3 - 5 - b7 - 9 - 11 - 13", voicing: "cerrado", level: "avanzado", description: "Color completo de dominante con sexta como treceava." },
  { id: "hendrix", name: "Acorde de Hendrix", symbol: "C7#9", category: "Jazz y especiales", family: "Alterados", intervals: [0, 4, 7, 10, 3], formula: "1 - 3 - 5 - b7 - #9", voicing: "cerrado", level: "avanzado", description: "Dominante con #9, asociado al sonido de rock psicodélico y blues." },
  { id: "slash", name: "Acorde slash", symbol: "C/E", category: "Jazz y especiales", family: "Inversiones", intervals: [0, 4, 7], formula: "Triada / bajo alternativo", voicing: "mixto", level: "avanzado", description: "Un acorde con una nota de bajo específica, por ejemplo C mayor sobre E." },
  { id: "minor-Major7", name: "Menor con séptima mayor", symbol: "CmMaj7", category: "Jazz y especiales", family: "Séptimas", intervals: [0, 3, 7, 11], formula: "1 - b3 - 5 - 7", voicing: "cerrado", level: "avanzado", description: "Contraste entre tercera menor y séptima mayor, típico de cine y jazz." },
] as const;
export type ModuleId = "acordes" | "glosario" | "buscador" | "triadas" | "arp" | "esc" | "ds" | "caged";
export const INTERVAL_LABELS = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"] as const;
