/**
 * exportService.ts
 * ─────────────────────────────────────────────────────────────
 * Servicio de exportación: SVG, PDF y MIDI.
 *
 *  - exportSVG: descarga el SVG del diagrama actual
 *  - exportProgressionPDF: genera una hoja de estudio con las 5 posiciones
 *    CAGED para la progresión seleccionada usando jsPDF
 *  - exportProgressionMIDI: genera un archivo .mid con la progresión
 *    usando @tonejs/midi
 */

import { jsPDF } from "jspdf";
import { Midi } from "@tonejs/midi";
import { type CagedPositionVoicing, type TransposedChord } from "./chordEngine";

// ─── SVG Export ────────────────────────────────────────────────

/** Serializa un SVGElement y lo descarga como archivo .svg */
export function exportSVG(svg: SVGElement, filename = "acorde-caged.svg"): void {
  const serializer = new XMLSerializer();
  const svgStr = `<?xml version="1.0" encoding="utf-8"?>\n${serializer.serializeToString(svg)}`;
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

// ─── PDF Export ────────────────────────────────────────────────

/**
 * Genera un PDF con la hoja de estudio de la progresión seleccionada.
 * Incluye: título, nombre del acorde, las 5 posiciones CAGED y notas teóricas.
 */
export function exportProgressionPDF(
  progressionLabel: string,
  tonicRoot: string,
  chords: Array<{ chord: TransposedChord; voicings: CagedPositionVoicing[] }>,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 14;

  // ── Encabezado ─────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 60);
  doc.text("Hoja de estudio · Sistema CAGED", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 120);
  doc.text(`Progresión: ${progressionLabel}  ·  Tónica: ${tonicRoot}`, margin, 26);

  doc.setDrawColor(180, 180, 220);
  doc.line(margin, 29, pageW - margin, 29);

  let yOffset = 36;

  // ── Acordes de la progresión ────────────────────────────────
  chords.forEach(({ chord, voicings }, chordIdx) => {
    if (yOffset > 240) {
      doc.addPage();
      yOffset = 20;
    }

    // Nombre del acorde
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 60, 120);
    doc.text(`${chordIdx + 1}. ${chord.name}`, margin, yOffset);

    // Notas del acorde
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 140);
    doc.text(`Notas: ${chord.notes.join(" · ")}`, margin + 2, yOffset + 5);
    doc.text(`Intervalos: ${chord.quality.intervals.join(" · ")}`, margin + 2, yOffset + 9);
    yOffset += 16;

    // Posiciones CAGED: dibuja mini-diagramas en texto
    const shapeLabels = voicings.slice(0, 5).map((v) => `${v.shape}·T${v.anchorFret}`);
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 80);
    doc.text(`Posiciones CAGED: ${shapeLabels.join("  ")}`, margin + 2, yOffset);
    yOffset += 6;

    // Mini-diagrama ASCII para cada posición
    voicings.slice(0, 5).forEach((v) => {
      if (yOffset > 250) { doc.addPage(); yOffset = 20; }
      const lines = [`Forma ${v.shape} (traste ${v.anchorFret}):`];
      for (let s = 5; s >= 0; s--) {
        const n = v.notes.find((note) => note.string === s);
        const muted = v.mutedStrings.includes(s);
        let cell = "——";
        if (muted) cell = " × ";
        else if (n) cell = n.fret === 0 ? " ○ " : `[${n.finger}]`;
        lines.push(`  ${["E", "A", "D", "G", "B", "e"][5 - s]} ${cell}`);
      }
      doc.text(lines, margin + 4, yOffset);
      yOffset += lines.length * 3.5 + 2;
    });

    yOffset += 4;
    doc.setDrawColor(220, 220, 240);
    doc.line(margin, yOffset, pageW - margin, yOffset);
    yOffset += 4;
  });

  // ── Footer ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 180);
    doc.text(`Diapasón · Sistema CAGED · Página ${i}/${pageCount}`, margin, 290);
  }

  doc.save(`progresion-caged-${tonicRoot.toLowerCase()}.pdf`);
}

// ─── MIDI Export ───────────────────────────────────────────────

const BASE_OCTAVE_MIDI = [52, 47, 43, 38, 33, 28]; // MIDI note numbers cuerda al aire (e,B,G,D,A,E)

function voicingNoteToMidi(stringIndex: number, fret: number): number {
  return BASE_OCTAVE_MIDI[stringIndex] + fret;
}

/**
 * Exporta la progresión de acordes a un archivo .mid.
 * Cada acorde ocupa un compás de 4 tiempos (quarter notes).
 * Las notas se generan como arpeggio ascendente dentro del compás.
 */
export function exportProgressionMIDI(
  chords: Array<{ chord: TransposedChord; voicing: CagedPositionVoicing }>,
  bpm = 80,
  filename = "progresion.mid",
): void {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];

  const track = midi.addTrack();
  track.name = "CAGED Progression";

  const ppq = midi.header.ppq; // pulsos por quarter note (default 480)
  const barTicks = 4 * ppq;

  chords.forEach(({ voicing }, barIdx) => {
    const barStart = barIdx * barTicks;
    const activeNotes = voicing.notes
      .filter((n) => !voicing.mutedStrings.includes(n.string))
      .sort((a, b) => b.string - a.string); // grave → agudo

    const arpDelay = Math.floor(ppq / 4); // 120 ticks entre notas del arpegio

    activeNotes.forEach((note, noteIdx) => {
      const midiNote = voicingNoteToMidi(note.string, note.fret);
      track.addNote({
        midi: midiNote,
        ticks: barStart + noteIdx * arpDelay,
        durationTicks: ppq * 2,
        velocity: 90,
      });
    });
  });

  const bytes = midi.toArray() as Uint8Array<ArrayBuffer>;
  const blob = new Blob([bytes], { type: "audio/midi" });
  triggerDownload(blob, filename);
}

// ─── Utilidad de descarga ──────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
