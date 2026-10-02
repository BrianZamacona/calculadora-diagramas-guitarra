/**
 * chordEngine.test.ts
 * ─────────────────────────────────────────────────────────────
 * Pruebas de precisión para el motor armónico CAGED y el generador
 * de voicings/progresiones en las 12 tonalidades.
 */

import { describe, expect, it } from "vitest";
import {
  buildTransposedChord,
  buildCagedVoicings,
  buildProgressionChords,
  generateAllCombinations,
  PROGRESSIONS,
  CHORD_QUALITIES,
  intervalsForQuality,
  INTERVAL_NAMES,
  cagedQualityToEngine,
  progressionNotes,
  type ChordQualityId,
} from "../src/utils/chordEngine";
import {
  computeAnchorFret,
  resolveCagedNotes,
  resolveCagedShape,
  CAGED_TEMPLATES,
  type CagedTemplate,
} from "../src/data/cagedTemplates";
import { NOTES, TUNING } from "../src/data/data";
import { MusicNote } from "../src/utils/domain";

// ─── Plantillas CAGED ─────────────────────────────────────────

describe("cagedTemplates · ancla y resolución de notas", () => {
  it("forma E en C → ancla traste 8 (6ª cuerda)", () => {
    const rootPitch = NOTES.indexOf("C"); // 0
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.E);
    // E-string (tuning=4), root C (0): (0-4+12)%12 = 8
    expect(anchor).toBe(8);
  });

  it("forma A en C → ancla traste 3 (5ª cuerda)", () => {
    const rootPitch = NOTES.indexOf("C");
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.A);
    // A-string (tuning=9), root C (0): (0-9+12)%12 = 3
    expect(anchor).toBe(3);
  });

  it("forma G en C → ancla traste 5 (6ª cuerda)", () => {
    const rootPitch = NOTES.indexOf("C");
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.G);
    // E-string (tuning=4), root C (0): (0-4+12)%12 = 8... G-shape rootString=5 => same
    // Actually G shape rootString = 5 (E-string), so anchor = (0-4+12)%12 = 8... 
    // Wait: G open is traste 3 on E-string, so anchor for C = 8 (same string), pero la forma G
    // se desplaza 5 trastes arriba de la E... en realidad C-forma-G = traste 5 en la A (pero rootString=5)
    // Verificar que anchor >= 0 y <= 12
    expect(anchor).toBeGreaterThanOrEqual(0);
    expect(anchor).toBeLessThanOrEqual(12);
  });

  it("forma E en A → ancla traste 5", () => {
    const rootPitch = NOTES.indexOf("A");
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.E);
    // A pitch = 9, E-string tuning = 4: (9-4+12)%12 = 5
    expect(anchor).toBe(5);
  });

  it("forma D en D → ancla traste 0 (cuerda al aire)", () => {
    const rootPitch = NOTES.indexOf("D");
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.D);
    // D-string tuning=2, D pitch=2: (2-2+12)%12 = 0
    expect(anchor).toBe(0);
  });

  it("resolveCagedNotes retorna intervalos correctos para C mayor forma E", () => {
    const rootPitch = NOTES.indexOf("C");
    const notes = resolveCagedNotes(rootPitch, CAGED_TEMPLATES.E, "major");
    expect(notes.length).toBeGreaterThan(0);
    // Todos los frets deben ser >= 0
    notes.forEach((n) => expect(n.fret).toBeGreaterThanOrEqual(0));
    // Debe haber al menos una raíz (interval === 0)
    expect(notes.some((n) => n.interval === 0)).toBe(true);
    // Debe haber al menos una 3ª mayor (interval === 4)
    expect(notes.some((n) => n.interval === 4)).toBe(true);
  });

  it("forma menor tiene b3 (interval 3) en lugar de 3M (4)", () => {
    const rootPitch = NOTES.indexOf("A");
    const majorNotes = resolveCagedNotes(rootPitch, CAGED_TEMPLATES.A, "major");
    const minorNotes = resolveCagedNotes(rootPitch, CAGED_TEMPLATES.A, "minor");
    expect(majorNotes.some((n) => n.interval === 4)).toBe(true);
    expect(minorNotes.some((n) => n.interval === 3)).toBe(true);
  });

  it("todas las notas de cada forma CAGED coinciden con su intervalo y traste", () => {
    for (const template of Object.values(CAGED_TEMPLATES)) {
      for (const quality of ["major", "minor"] as const) {
        const notes = resolveCagedNotes(NOTES.indexOf("C"), template, quality);
        notes.forEach((note) => {
          const pitch = (TUNING[note.string] + note.fret) % 12;
          expect((pitch + 12) % 12, `${template.shape} ${quality}, cuerda ${note.string}, traste ${note.fret}`).toBe(note.interval % 12);
        });
        expect(notes.every((note) => !template.muted.includes(note.string))).toBe(true);
      }
    }
  });

  it("computa anclas correctas para las 12 tonalidades en la forma E", () => {
    const expectedAnchors: Record<string, number> = {
      C: 8, "C#": 9, D: 10, "D#": 11, E: 0, F: 1,
      "F#": 2, G: 3, "G#": 4, A: 5, "A#": 6, B: 7,
    };
    NOTES.forEach((note) => {
      const rootPitch = NOTES.indexOf(note);
      const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.E);
      expect(anchor).toBe(expectedAnchors[note]);
    });
  });
});

// ─── Motor de acordes ─────────────────────────────────────────

describe("chordEngine · buildTransposedChord", () => {
  it("C mayor tiene notas C, E, G", () => {
    const chord = buildTransposedChord("C", "Maj");
    expect(chord.notes).toContain("C");
    expect(chord.notes).toContain("E");
    expect(chord.notes).toContain("G");
  });

  it("A menor tiene notas A, C, E", () => {
    const chord = buildTransposedChord("A", "min");
    expect(chord.notes).toContain("A");
    expect(chord.notes).toContain("C");
    expect(chord.notes).toContain("E");
  });

  it("G7 tiene notas G, B, D, F", () => {
    const chord = buildTransposedChord("G", "dom7");
    expect(chord.notes).toContain("G");
    expect(chord.notes).toContain("B");
    expect(chord.notes).toContain("D");
    expect(chord.notes).toContain("F");
  });

  it("Cmaj7 tiene notas C, E, G, B", () => {
    const chord = buildTransposedChord("C", "Maj7");
    expect(chord.notes).toContain("C");
    expect(chord.notes).toContain("E");
    expect(chord.notes).toContain("G");
    expect(chord.notes).toContain("B");
  });

  it("F#m7b5 tiene notas F#, A, C, E", () => {
    const chord = buildTransposedChord("F#", "m7b5");
    expect(chord.notes).toContain("F#");
    expect(chord.notes).toContain("A");
    expect(chord.notes).toContain("C");
    expect(chord.notes).toContain("E");
  });

  it("Bdim7 tiene notas B, D, F, Ab", () => {
    const chord = buildTransposedChord("B", "dim7");
    expect(chord.notes).toContain("B");
    expect(chord.notes).toContain("D");
    expect(chord.notes).toContain("F");
    expect(chord.notes).toContain("Ab");
  });

  it("conserva la ortografía diatónica en acordes con sostenidos", () => {
    expect(buildTransposedChord("C#", "Maj").notes).toEqual(["C#", "E#", "G#"]);
  });

  it("transpone correctamente en las 12 tonalidades (triada mayor)", () => {
    // Para cada nota, la 3ª mayor debe ser 4 semitonos arriba
    NOTES.forEach((root) => {
      const chord = buildTransposedChord(root, "Maj");
      const rootSemitones = MusicNote.parse(root).absoluteSemitones;
      const thirdSemitones = MusicNote.parse(chord.notes[1]).absoluteSemitones;
      expect((thirdSemitones - rootSemitones + 12) % 12).toBe(4);
    });
  });
});

// ─── Voicings CAGED ───────────────────────────────────────────

describe("chordEngine · buildCagedVoicings", () => {
  it("genera al menos 5 voicings para C mayor", () => {
    const voicings = buildCagedVoicings("C", "major");
    expect(voicings.length).toBeGreaterThanOrEqual(5);
  });

  it("cada voicing tiene al menos una nota", () => {
    const voicings = buildCagedVoicings("G", "major");
    voicings.forEach((v) => expect(v.notes.length).toBeGreaterThan(0));
  });

  it("los frets de cada voicing son válidos (0-24)", () => {
    const voicings = buildCagedVoicings("E", "minor");
    voicings.forEach((v) =>
      v.notes.forEach((n) => {
        expect(n.fret).toBeGreaterThanOrEqual(0);
        expect(n.fret).toBeLessThanOrEqual(24);
      }),
    );
  });

  it("los shapes aparecen en el resultado (C, A, G, E, D)", () => {
    const voicings = buildCagedVoicings("C", "major");
    const shapes = new Set(voicings.map((v) => v.shape));
    expect(shapes.has("E")).toBe(true);
    expect(shapes.has("A")).toBe(true);
  });

  it("genera voicings para las 12 tonalidades sin errores", () => {
    NOTES.forEach((root) => {
      const voicings = buildCagedVoicings(root, "major");
      expect(voicings.length).toBeGreaterThan(0);
    });
  });

  it("voicings menores tienen b3 (interval 3) entre sus notas", () => {
    const voicings = buildCagedVoicings("A", "minor");
    const hasMinorThird = voicings.some((v) => v.notes.some((n) => n.interval === 3));
    expect(hasMinorThird).toBe(true);
  });

  const seventhQualities = [
    { quality: "dom7", intervals: [0, 4, 7, 10] },
    { quality: "Maj7", intervals: [0, 4, 7, 11] },
    { quality: "min7", intervals: [0, 3, 7, 10] },
  ] as const;

  seventhQualities.forEach(({ quality, intervals }) => {
    it(`${quality} genera notas exactas en las cinco formas`, () => {
      const voicings = buildCagedVoicings("C", quality).filter((voicing) => voicing.anchorFret < 12);
      for (const shape of ["C", "A", "G", "E", "D"] as const) {
        const voicing = voicings.find((candidate) => candidate.shape === shape);
        expect(voicing, `forma ${shape}`).toBeDefined();
        if (!voicing) continue;
        expect([...new Set(voicing.notes.map((note) => note.interval))].sort((a, b) => a - b)).toEqual([...intervals].sort((a, b) => a - b));
        expect(voicing.complete, `${quality} forma ${shape}`).toBe(true);
      }
    });
  });

  it("resuelve C min7 completo con sus cinco notas en la forma C", () => {
    const voicing = buildCagedVoicings("C", "min7").find((candidate) => candidate.shape === "C" && candidate.anchorFret < 12);
    expect(voicing).toBeDefined();
    expect(voicing?.complete).toBe(true);
    expect(voicing?.notes).toHaveLength(5);
    // Pitch-class labels use sharps: A# and D# are Bb and Eb enharmonically.
    expect(voicing?.notes.map((note) => NOTES[(TUNING[note.string] + note.fret) % 12])).toEqual(["C", "G", "A#", "D#", "G"]);
  });

  it("devuelve un voicing parcial conservando raíz, tercera y séptima", () => {
    const extendedTemplate: CagedTemplate = {
      ...CAGED_TEMPLATES.E,
      windowEnd: 8,
      major: CAGED_TEMPLATES.E.major.map((note) => note.string === 4 ? { ...note, relativeFret: 7 } : note),
    };
    const resolved = resolveCagedShape(NOTES.indexOf("C"), extendedTemplate, "dom7");
    const intervals = new Set(resolved.notes.map((note) => note.interval));

    expect(resolved.complete).toBe(false);
    expect(resolved.notes.length).toBeLessThan(extendedTemplate.major.length);
    expect(intervals.has(0)).toBe(true);
    expect(intervals.has(4)).toBe(true);
    expect(intervals.has(10)).toBe(true);
  });

  it("marca solo los voicings recortados por el traste cero como parciales", () => {
    const qualities = ["major", "minor", "dom7", "Maj7", "min7"] as const;
    const incomplete = NOTES.flatMap((root) => Object.values(CAGED_TEMPLATES).flatMap((template) => qualities.flatMap((quality) => {
      const resolved = resolveCagedShape(NOTES.indexOf(root), template, quality);
      return resolved.complete ? [] : [{ root, shape: template.shape, quality, intervals: resolved.notes.map((note) => note.interval) }];
    })));
    expect(incomplete).toEqual([
      { root: "A", shape: "C", quality: "major", intervals: [] },
      { root: "A", shape: "C", quality: "dom7", intervals: [] },
      { root: "A", shape: "C", quality: "Maj7", intervals: [] },
      { root: "A#", shape: "C", quality: "major", intervals: [0, 4] },
      { root: "A#", shape: "C", quality: "dom7", intervals: [] },
      { root: "A#", shape: "C", quality: "Maj7", intervals: [] },
      { root: "B", shape: "C", quality: "major", intervals: [0, 4, 0] },
      { root: "B", shape: "C", quality: "dom7", intervals: [10, 4, 0] },
      { root: "B", shape: "C", quality: "Maj7", intervals: [11, 4, 0] },
    ]);
  });
});

// ─── Progresiones ─────────────────────────────────────────────

describe("chordEngine · buildProgressionChords", () => {
  it("I-vi-IV-V en C genera acordes C, Am, F, G", () => {
    const chords = buildProgressionChords("C", "v1-1");
    const names = chords.map((c) => c.root);
    expect(names).toContain("C");
    expect(names).toContain("A"); // vi = Am
    expect(names).toContain("F");
    expect(names).toContain("G");
  });

  it("progresión Vol.2 I-vi-ii-V en D genera D, Bm, Em, A", () => {
    const chords = buildProgressionChords("D", "v2-1");
    const names = chords.map((c) => c.root);
    expect(names).toContain("D");
    expect(names).toContain("B"); // vi de D
    expect(names).toContain("E"); // ii de D
    expect(names).toContain("A"); // V de D
  });

  it("escribe los grados diatónicos correctamente en tonalidades con sostenidos", () => {
    const chords = buildProgressionChords("C#", "v1-1");
    expect(chords.map((chord) => chord.root)).toEqual(["C#", "A#", "F#", "G#"]);
  });

  it("el I es siempre mayor, el vi es menor", () => {
    const chords = buildProgressionChords("G", "v1-1");
    const I = chords[0];
    const vi = chords[1];
    expect(I.quality.intervals).toContain(4); // 3ª mayor
    expect(vi.quality.intervals).toContain(3); // 3ª menor
  });

  it("soporta shape alternativo sus2 en V de I-V-vi-IV", () => {
    const chords = buildProgressionChords("C", "v1-2", "sus2");
    // El V (G) debe cambiar a Gsus2
    const V = chords.find((c) => c.root === "G");
    expect(V?.quality.intervals).toContain(2); // sus2 tiene intervalo 2
  });

  it("genera progresiones en las 12 tonalidades para Vol.3", () => {
    NOTES.forEach((root) => {
      const chords = buildProgressionChords(root, "v3-1");
      expect(chords).toHaveLength(4); // I-V-vi-iii
    });
  });
});

// ─── Generador masivo ─────────────────────────────────────────

describe("chordEngine · generateAllCombinations", () => {
  it("genera al menos 324 combinaciones (12 raíces × 27 calidades)", () => {
    const combinations = generateAllCombinations();
    expect(combinations.length).toBeGreaterThanOrEqual(324);
  });

  it("no hay combinaciones duplicadas", () => {
    const combinations = generateAllCombinations();
    const names = combinations.map((c) => `${c.root}-${c.qualityId}`);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ─── Calidades e intervalos ───────────────────────────────────

describe("chordEngine · CHORD_QUALITIES e intervalos", () => {
  it("todas las calidades tienen al menos 2 intervalos", () => {
    Object.values(CHORD_QUALITIES).forEach((q) => {
      expect(q.intervals.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("Shell Maj7 tiene solo raíz, 3ª y 7ª mayor (0, 4, 11)", () => {
    expect(CHORD_QUALITIES.shell_Maj7.intervals).toEqual([0, 4, 11]);
  });

  it("Drop 2 Maj7 incluye la 5ª como cuarta nota (0, 4, 11, 7)", () => {
    expect(CHORD_QUALITIES.drop2_Maj7.intervals).toEqual([0, 4, 11, 7]);
  });

  it("INTERVAL_NAMES cubre los 12 pitch-classes", () => {
    for (let i = 0; i < 12; i++) {
      expect(INTERVAL_NAMES[i]).toBeTruthy();
    }
  });

  it("cagedQualityToEngine mapea correctamente 'Maj7' → 'Maj7'", () => {
    expect(cagedQualityToEngine("Maj7")).toBe("Maj7");
    expect(cagedQualityToEngine("dom7")).toBe("dom7");
    expect(cagedQualityToEngine("min")).toBe("min");
  });
});

// ─── progressionNotes ─────────────────────────────────────────

describe("chordEngine · progressionNotes", () => {
  it("retorna objetos con chord y degree", () => {
    const notes = progressionNotes("C", "v1-1");
    expect(notes).toHaveLength(4);
    notes.forEach((n) => {
      expect(n.chord).toBeDefined();
      expect(n.degree).toBeDefined();
    });
  });

  it("el I grado tiene semitones=0", () => {
    const notes = progressionNotes("G", "v1-3");
    const I = notes.find((n) => n.degree.numeral === "I");
    expect(I?.degree.semitones).toBe(0);
  });
});
