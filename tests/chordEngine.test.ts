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
  buildArrangedVoicings,
  buildProgressionChords,
  cagedTemplateQualityForChord,
  generateAllCombinations,
  PROGRESSIONS,
  CHORD_QUALITIES,
  intervalsForQuality,
  INTERVAL_NAMES,
  cagedQualityToEngine,
  progressionNotes,
  toRomanFret,
  type CagedShapeId,
  type ChordQualityId,
} from "../src/utils/chordEngine";
import {
  clipCagedBarre,
  computeAnchorFret,
  resolveCagedNotes,
  resolveCagedShape,
  CAGED_TEMPLATES,
  type CagedTemplate,
} from "../src/data/cagedTemplates";
import { NOTES, TUNING } from "../src/data/data";
import { MusicNote } from "../src/utils/domain";
import type { ProgressionLabel } from "../src/types/guitar";
import { CLASSIC_ALTERNATE_SHAPES_DB, getAlternateShapeData } from "../src/data/alternateShapesData";

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

  it("forma G para C → ancla en traste VIII de la 6ª cuerda", () => {
    const rootPitch = NOTES.indexOf("C");
    const anchor = computeAnchorFret(rootPitch, CAGED_TEMPLATES.G);
    expect(anchor).toBe(8);
  });

  it("la forma G desplazada a C conserva el patrón clásico y suena C mayor", () => {
    const notes = resolveCagedNotes(NOTES.indexOf("C"), CAGED_TEMPLATES.G, "major");
    const fretByString = new Map(notes.map((note) => [note.string, note.fret]));
    expect([5, 4, 3, 2, 1, 0].map((string) => fretByString.get(string))).toEqual([8, 7, 5, 5, 5, 8]);
    expect(notes.map((note) => note.interval)).toEqual([0, 4, 7, 0, 4, 0]);
  });

  it("forma G abierta reproduce G: 3-2-0-0-0-3", () => {
    const notes = resolveCagedNotes(NOTES.indexOf("G"), CAGED_TEMPLATES.G, "major");
    const fretByString = new Map(notes.map((note) => [note.string, note.fret]));
    expect([5, 4, 3, 2, 1, 0].map((string) => fretByString.get(string))).toEqual([3, 2, 0, 0, 0, 3]);
    expect(notes.map((note) => note.interval)).toEqual([0, 4, 7, 0, 4, 0]);
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
  it("preserva la calidad de séptima al mapearla al motor CAGED", () => {
    expect(cagedTemplateQualityForChord("Maj7")).toBe("Maj7");
    expect(cagedTemplateQualityForChord("dom7")).toBe("dom7");
    expect(cagedTemplateQualityForChord("min7")).toBe("min7");
  });

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

  it("G menor triada comparte la digitación E de la guía, pero Gm7 tiene voicing propio", () => {
    const tabForShape = (shape: CagedShapeId, quality: "minor" | "min7"): Array<number | null> => {
      const voicing = buildCagedVoicings("G", quality).find((candidate) => candidate.shape === shape && candidate.anchorFret === (shape === "G" && quality === "min7" ? 12 : 3));
      return Array.from({ length: 6 }, (_, tabIndex) =>
        voicing?.notes.find((note) => note.string === 5 - tabIndex)?.fret ?? null,
      );
    };
    const gMinorTab = tabForShape("G", "minor");
    const eMinorTab = tabForShape("E", "minor");
    expect(gMinorTab).toEqual([3, 5, 5, 3, 3, 3]);
    expect(gMinorTab).toEqual(eMinorTab);
    expect(tabForShape("G", "min7")).toEqual([null, null, 12, 12, 11, 13]);
    expect(buildCagedVoicings("G", "min7").filter((candidate) => candidate.shape === "G" && candidate.anchorFret === 12)).toHaveLength(1);
  });

  it("forma A menor abierta conserva x-0-2-2-1-0", () => {
    const notes = resolveCagedNotes(NOTES.indexOf("A"), CAGED_TEMPLATES.A, "minor");
    const fretByString = new Map(notes.map((note) => [note.string, note.fret]));
    expect([5, 4, 3, 2, 1, 0].map((string) => fretByString.get(string) ?? "x")).toEqual(["x", 0, 2, 2, 1, 0]);
  });

  it("C menor forma C hace cejilla índice desde A3 hasta e3", () => {
    const voicing = buildCagedVoicings("C", "minor").find((candidate) => candidate.shape === "C" && candidate.anchorFret === 3);
    expect(voicing?.barre).toEqual({ fret: 3, fromString: 4, toString: 0 });
    const barreNotes = voicing?.notes.filter((note) => note.fret === 3);
    expect(barreNotes?.map((note) => note.string).sort((a, b) => a - b)).toEqual([0, 4]);
    expect(barreNotes?.every((note) => note.finger === 1)).toBe(true);
  });

  it("C menor forma G usa cejilla de raíz y dedos 3/4 en A/D", () => {
    const voicing = buildCagedVoicings("C", "minor").find((candidate) => candidate.shape === "G" && candidate.anchorFret === 8);
    expect(voicing?.barre).toEqual({ fret: 8, fromString: 5, toString: 0 });
    const fingerByString = new Map(voicing?.notes.map((note) => [note.string, note.finger]));
    expect(fingerByString.get(4)).toBe(3);
    expect(fingerByString.get(3)).toBe(4);
    expect(voicing?.notes.filter((note) => note.fret === 8).every((note) => note.finger === 1)).toBe(true);
  });

  it("G menor forma G en traste III es 3-5-5-3-3-3 con cejilla índice", () => {
    const voicing = buildCagedVoicings("G", "minor").find((candidate) => candidate.shape === "G" && candidate.anchorFret === 3);
    const fretByString = new Map(voicing?.notes.map((note) => [note.string, note.fret]));
    expect([5, 4, 3, 2, 1, 0].map((string) => fretByString.get(string))).toEqual([3, 5, 5, 3, 3, 3]);
    expect(voicing?.barre).toEqual({ fret: 3, fromString: 5, toString: 0 });
    expect(voicing?.notes.filter((note) => note.fret === 3).every((note) => note.finger === 1)).toBe(true);
  });

  it("C menor forma E en traste VIII barre las seis cuerdas con el dedo 1", () => {
    const voicing = buildCagedVoicings("C", "minor").find((candidate) => candidate.shape === "E" && candidate.anchorFret === 8);
    expect(voicing?.barre).toEqual({ fret: 8, fromString: 5, toString: 0 });
    expect(voicing?.notes.filter((note) => note.fret === 8).every((note) => note.finger === 1)).toBe(true);
  });

  it("C menor forma D usa dedos 1–4 sin cejilla ni dedo cero", () => {
    const voicing = buildCagedVoicings("C", "minor").find((candidate) => candidate.shape === "D" && candidate.anchorFret === 10);
    expect(voicing?.barre).toBeUndefined();
    expect(voicing?.notes.every((note) => note.finger >= 1 && note.finger <= 4)).toBe(true);
  });

  it("recorta una cejilla al encontrar una cuerda abierta o muteada", () => {
    const barre = { relativeFret: 0, fromString: 5, toString: 0, finger: 1 as const };
    const notes = [
      { string: 5, fret: 3 }, { string: 4, fret: 5 }, { string: 3, fret: 0 },
      { string: 2, fret: 5 }, { string: 1, fret: 4 }, { string: 0, fret: 3 },
    ];
    expect(clipCagedBarre(barre, 3, notes, [])).toEqual({ relativeFret: 0, fromString: 2, toString: 0, finger: 1 });
    expect(clipCagedBarre(barre, 3, notes, [2, 4])).toEqual({ relativeFret: 0, fromString: 1, toString: 0, finger: 1 });
  });

  it("las digitaciones menores CAGED nunca asignan un dedo cero a notas pisadas", () => {
    for (const voicing of buildCagedVoicings("C", "minor")) {
      voicing.notes.filter((note) => note.fret > 0).forEach((note) => {
        expect([1, 2, 3, 4]).toContain(note.finger);
      });
    }
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

  it("limita los parciales a formas C/G cuyo patrón cae bajo el traste cero", () => {
    const qualities = ["major", "minor", "dom7", "Maj7", "min7"] as const;
    const incomplete = NOTES.flatMap((root) => Object.values(CAGED_TEMPLATES).flatMap((template) => qualities.flatMap((quality) => {
      const resolved = resolveCagedShape(NOTES.indexOf(root), template, quality);
      return resolved.complete ? [] : [{ root, shape: template.shape, quality, intervals: resolved.notes.map((note) => note.interval) }];
    })));
    expect(incomplete.every((item) => item.shape === "C" || item.shape === "G")).toBe(true);
    const movableGMinor = resolveCagedShape(NOTES.indexOf("C"), CAGED_TEMPLATES.G, "minor");
    expect(movableGMinor.complete).toBe(true);
    expect(movableGMinor.notes.some((note) => note.interval === 3)).toBe(true);
    const gPartials = incomplete.filter((item) => item.shape === "G");
    expect(gPartials.map((item) => `${item.root}:${item.quality}`).sort()).toEqual([
      "E:Maj7", "E:dom7", "E:major",
      "F#:Maj7", "F#:dom7", "F#:major",
      "F:Maj7", "F:dom7", "F:major",
    ]);
    gPartials.forEach(({ root }) => {
      const anchor = computeAnchorFret(NOTES.indexOf(root), CAGED_TEMPLATES.G);
      expect(CAGED_TEMPLATES.G.major.some((note) => anchor + note.relativeFret < 0)).toBe(true);
    });
    const openGMinor = resolveCagedShape(NOTES.indexOf("G"), CAGED_TEMPLATES.G, "minor");
    expect(openGMinor.complete).toBe(true);
    expect(openGMinor.notes.map((note) => note.fret)).toEqual([3, 5, 5, 3, 3, 3]);
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

  it("aplica el alternate pedido con posiciones elegidas por voice leading", () => {
    const chords = buildProgressionChords("C", "v1-1", "sus2");
    expect(chords.map((chord) => chord.name)).toEqual(["Csus2", "Asus2", "Fsus2", "Gsus2"]);
    expect(buildProgressionChords("C", "v1-1", "add9").map((chord) => chord.quality.id)).toEqual(["add9", "madd9", "add9", "add9"]);
    expect(buildProgressionChords("C", "v1-1", "sus4")[0].name).toBe("Csus4");
    expect(() => buildProgressionChords("C", "v9-unregistered", "sus2")).not.toThrow();
    expect(buildProgressionChords("C", "v9-unregistered", "sus2")).toEqual([]);
  });

  it("genera progresiones en las 12 tonalidades para Vol.3", () => {
    NOTES.forEach((root) => {
      const chords = buildProgressionChords(root, "v3-1");
      expect(chords).toHaveLength(4); // I-V-vi-iii
    });
  });
});

describe("alternateShapesData · base de progresiones clásicas", () => {
  it("cubre las 9 progresiones y 5 posiciones ordenadas dentro de sus ventanas CAGED", () => {
    const progressionLengths: Record<ProgressionLabel, number> = {
      "I-vi-IV-V": 4, "I-V-vi-IV": 4, "I-IV-V": 3,
      "I-vi-ii-V": 4, "I-IV-vi-V": 4, "I-IV-I-V": 4,
      "I-V-vi-iii": 4, "I-IV-ii-V": 4, "I-iii-IV-V": 4,
    };
    const positionIndices = [1, 2, 3, 4, 5];

    NOTES.forEach((key) => {
      Object.entries(progressionLengths).forEach(([progression, chordCount]) => {
        const positions = CLASSIC_ALTERNATE_SHAPES_DB[key]?.[progression as ProgressionLabel];
        expect(positions, `${key} ${progression}`).toHaveLength(5);
        expect(positions?.map((position) => position.positionIndex)).toEqual(positionIndices);
        const anchors = positions?.map((position) => position.anchorFret) ?? [];
        expect(anchors).toEqual([...anchors].sort((left, right) => left - right));

        positions?.forEach((position) => {
          const template = CAGED_TEMPLATES[position.cagedShapeName];
          const anchor = computeAnchorFret(NOTES.indexOf(key), template);
          const windowStart = Math.max(0, anchor - 2);
          const windowEnd = Math.min(24, Math.max(windowStart + 4, anchor + 2));
          expect(position.anchorFret).toBe(anchor);
          expect(position.standardShapes, `${key} ${progression} posición ${position.positionIndex} estándar`).toHaveLength(chordCount);
          expect(position.alternateShapes, `${key} ${progression} posición ${position.positionIndex} ${position.cagedShapeName}: ${position.alternateShapes.map((shape) => `${shape.degree}:${shape.chordName}`).join(",")}`).toHaveLength(chordCount);
          [...position.standardShapes, ...position.alternateShapes].forEach((shape) => {
            expect(shape.strings).toHaveLength(6);
            shape.strings.forEach((fret) => {
              if (fret === "x") return;
              if (fret === 0) expect(windowStart).toBe(0);
              else expect(fret).toBeGreaterThanOrEqual(windowStart);
              if (typeof fret === "number" && fret > 0) expect(fret).toBeLessThanOrEqual(windowEnd);
            });
          });
        });
      });
    });
  });

  it("contiene los voicings coloreados I-vi-IV-V en C", () => {
    const data = getAlternateShapeData("C", "I-vi-IV-V", 1);
    expect(data?.map((chord) => chord.chordName)).toEqual(["Csus2", "Am7/C", "FM9", "Gsus4"]);
    expect(data?.[0].fretNumber).toBe(3);
    expect(data?.[0].romanFret).toBe("III");
    expect(data?.[0].strings).toHaveLength(6);
    expect(data?.every((chord) => chord.strings.length === 6)).toBe(true);
  });

  it("transpone los nombres y digitaciones al pedir una tonalidad distinta", () => {
    const data = getAlternateShapeData("D", "I-vi-IV-V", 1);
    expect(data?.map((chord) => chord.chordName)).toEqual(["Dsus2/E", "Bm7/A", "GM9", "Asus4"]);
    expect(data?.[0].fretNumber).toBeGreaterThanOrEqual(0);
    expect(data?.[0].strings).toHaveLength(6);
  });

  it("incluye la posición 3 de I-V-vi-IV con sus dos secuencias", () => {
    const position = CLASSIC_ALTERNATE_SHAPES_DB.C?.["I-V-vi-IV"]?.find((item) => item.positionIndex === 3);
    expect(position?.anchorFret).toBe(8);
    expect(position?.cagedShapeName).toBe("G");
    expect(position?.standardShapes.map((shape) => shape.chordName)).toEqual(["C", "G/B", "Am/C", "F"]);
    expect(position?.alternateShapes.map((shape) => shape.chordName)).toEqual(["Cadd2", "Gsus4/C", "Am7/C", "FM9"]);
  });

  it("acepta los IDs existentes y devuelve null para formas aún no curadas", () => {
    expect(getAlternateShapeData("C", "v1-1", 1)).toEqual(getAlternateShapeData("C", "I-vi-IV-V", 1));
    expect(getAlternateShapeData("C", "v1-1", 2)).toHaveLength(4);
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
  it("convierte trastes a números romanos para la biblioteca", () => {
    expect([1, 4, 9, 12, 24].map(toRomanFret)).toEqual(["I", "IV", "IX", "XII", "XXIV"]);
    expect(toRomanFret(0)).toBe("0");
  });

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

  it("genera Shell en los sets de cuerdas 6-4-3 y 5-4-3", () => {
    const voicings = buildArrangedVoicings("C", "shell_Maj7");
    expect(voicings.some((voicing) => voicing.stringSet === "6-4-3")).toBe(true);
    expect(voicings.some((voicing) => voicing.stringSet === "5-4-3")).toBe(true);
    voicings.forEach((voicing) => expect(voicing.notes.map((note) => note.interval)).toEqual([0, 4, 11]));
  });

  it("Drop 2 baja la quinta una octava y usa cuatro cuerdas adyacentes", () => {
    const voicing = buildArrangedVoicings("C", "drop2_Maj7").find((candidate) => candidate.stringSet === "6-5-4-3");
    expect(voicing).toBeDefined();
    expect(voicing?.droppedInterval).toBe(7);
    expect(voicing?.notes.map((note) => note.interval)).toEqual([7, 0, 4, 11]);
    expect(voicing?.notes.map((note) => note.midi)).toEqual([43, 48, 52, 59]);
  });

  it("Drop 3 baja la tercera una octava y usa cuerdas con salto", () => {
    const voicing = buildArrangedVoicings("C", "drop3_min7").find((candidate) => candidate.stringSet === "6-4-3-2");
    expect(voicing).toBeDefined();
    expect(voicing?.droppedInterval).toBe(3);
    expect(voicing?.notes.map((note) => note.midi).every((midi, index, notes) => index === 0 || midi > notes[index - 1])).toBe(true);
    expect(voicing?.notes.some((note, index, notes) => index > 0 && note.string !== notes[index - 1].string - 1)).toBe(true);
  });

  it("genera posiciones extended_voicing para 9ª, 11ª y 13ª", () => {
    const extended = [
      { quality: "Maj9", tension: 2 },
      { quality: "dom11", tension: 5 },
      { quality: "min13", tension: 9 },
    ] as const;
    extended.forEach(({ quality, tension }) => {
      const voicings = buildArrangedVoicings("C", quality);
      expect(voicings.length, quality).toBeGreaterThan(0);
      voicings.forEach((voicing) => {
        expect(voicing.layout).toBe("extended_voicing");
        expect(voicing.notes.some((note) => note.interval === tension)).toBe(true);
        expect(voicing.notes.every((note) => note.fret >= 0 && note.fret <= 24)).toBe(true);
      });
    });
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
