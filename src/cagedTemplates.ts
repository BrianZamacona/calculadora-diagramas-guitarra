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

/** Un punto de la digitación CAGED expresado en coordenadas relativas al ancla. */
export interface CagedNote {
  /** Índice de cuerda: 0 = 1ª (e), 5 = 6ª (E) */
  string: number;
  /** Desplazamiento de traste respecto al traste ancla de la forma */
  relativeFret: number;
  /** Función interválica del punto (0 = raíz, 4 = 3ª M, 7 = 5ª J, 10 = b7, 11 = 7M, 3 = b3, etc.) */
  interval: number;
  /** Dedo sugerido: 1 índice · 2 corazón · 3 anular · 4 meñique · 0 cejilla */
  finger: number;
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
  /** Barré si aplica */
  barre?: CagedBarre;
  /** Cuerdas mudas para la forma en posición abierta (array de índices) */
  muted: number[];
}

// ─── Forma C ──────────────────────────────────────────────────
// Ancla: cuerda 4 (5ª A, pitch 9). Root en A-string.
// Ejemplo: C mayor abierto (ancla en traste 3, A-string=C a traste 3)
const SHAPE_C: CagedTemplate = {
  shape: "C",
  rootString: 4,   // 5ª cuerda A
  windowStart: -3,
  windowEnd: 1,
  major: [
    { string: 5, relativeFret: -3, interval: 0,  finger: 2 }, // raíz 6ª
    { string: 4, relativeFret:  0, interval: 0,  finger: 3 }, // raíz 5ª (ancla)
    { string: 3, relativeFret: -1, interval: 7,  finger: 2 }, // 5ª en 4ª cuerda
    { string: 2, relativeFret:  0, interval: 4,  finger: 0 }, // 3M en 3ª cuerda (al aire si C)
    { string: 1, relativeFret:  1, interval: 0,  finger: 4 }, // raíz en 2ª cuerda
    { string: 0, relativeFret:  0, interval: 4,  finger: 0 }, // 3M en 1ª cuerda (al aire si C)
  ],
  minorOverrides: [
    { string: 2, relativeFret: -1, interval: 3, finger: 1 }, // b3 en lugar de 3
  ],
  muted: [],
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
    { string: 5, relativeFret: 0,  interval: 0,  finger: 0 }, // raíz 6ª (muda en cejilla)
    { string: 4, relativeFret: 0,  interval: 0,  finger: 1 }, // raíz 5ª (ancla)
    { string: 3, relativeFret: 2,  interval: 7,  finger: 3 }, // 5ª en 4ª
    { string: 2, relativeFret: 2,  interval: 4,  finger: 4 }, // 3M en 3ª
    { string: 1, relativeFret: 2,  interval: 0,  finger: 3 }, // raíz en 2ª
    { string: 0, relativeFret: 0,  interval: 0,  finger: 0 }, // raíz 1ª (al aire A5->A)
  ],
  minorOverrides: [
    { string: 2, relativeFret: 1, interval: 3, finger: 2 }, // b3
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
  windowEnd: 1,
  major: [
    { string: 5, relativeFret:  0,  interval: 0, finger: 3 }, // raíz 6ª (ancla)
    { string: 4, relativeFret: -2,  interval: 7, finger: 2 }, // 5ª en 5ª cuerda
    { string: 3, relativeFret: -1,  interval: 4, finger: 1 }, // 3M en 4ª
    { string: 2, relativeFret:  0,  interval: 0, finger: 0 }, // raíz 3ª (al aire si G)
    { string: 1, relativeFret:  0,  interval: 4, finger: 0 }, // 3M 2ª (al aire si G) — compensación G-B
    { string: 0, relativeFret:  0,  interval: 0, finger: 4 }, // raíz 1ª (al aire si G)
  ],
  minorOverrides: [
    { string: 3, relativeFret: -2, interval: 3, finger: 1 }, // b3
    { string: 1, relativeFret: -1, interval: 3, finger: 0 }, // b3 compensada G-B
  ],
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
    { string: 3, relativeFret: 2, interval: 4,  finger: 4 }, // 3M en 4ª
    { string: 2, relativeFret: 1, interval: 0,  finger: 2 }, // raíz en 3ª — compensación G-B
    { string: 1, relativeFret: 0, interval: 0,  finger: 0 }, // raíz 2ª (al aire si E)
    { string: 0, relativeFret: 0, interval: 0,  finger: 0 }, // raíz 1ª (al aire si E)
  ],
  minorOverrides: [
    { string: 3, relativeFret: 1, interval: 3, finger: 2 }, // b3
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
    { string: 3, relativeFret: 0, interval: 0, finger: 0 }, // raíz 4ª (ancla, al aire si D)
    { string: 2, relativeFret: 2, interval: 4, finger: 2 }, // 3M en 3ª
    { string: 1, relativeFret: 3, interval: 0, finger: 3 }, // raíz 2ª — compensación G-B (+1)
    { string: 0, relativeFret: 2, interval: 7, finger: 1 }, // 5ª en 1ª
  ],
  minorOverrides: [
    { string: 2, relativeFret: 1, interval: 3, finger: 1 }, // b3
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
export function computeAnchorFret(rootPitch: number, template: CagedTemplate, octaveShift = 0): number {
  const openPitch = TUNING[template.rootString];
  return ((rootPitch - openPitch + 12) % 12) + octaveShift;
}

/**
 * Devuelve las notas absolutas de la forma para una raíz y calidad dadas.
 * quality: 0 = mayor, 1 = menor.
 */
export function resolveCagedNotes(
  rootPitch: number,
  template: CagedTemplate,
  quality: "major" | "minor" = "major",
  octaveShift = 0,
): Array<{ string: number; fret: number; interval: number; finger: number }> {
  const anchor = computeAnchorFret(rootPitch, template, octaveShift);
  const base = template.major.map((n) => ({ ...n }));

  if (quality === "minor") {
    template.minorOverrides.forEach((override) => {
      const idx = base.findIndex((n) => n.string === override.string);
      if (idx !== -1) base[idx] = { ...base[idx], ...override } as CagedNote;
    });
  }

  return base
    .map((note) => ({
      string: note.string,
      fret: anchor + note.relativeFret,
      interval: note.interval,
      finger: note.finger,
    }))
    .filter((n) => n.fret >= 0 && n.fret <= 24);
}
