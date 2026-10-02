/**
 * audio.ts
 * ─────────────────────────────────────────────────────────────
 * Servicio de reproducción de acordes usando Tone.js.
 *
 * Funciones:
 *  - Reproducción arpeggiada (nota a nota, ascendente)
 *  - Rasgueo (strumming) ascendente/descendente
 *  - Control de tempo (BPM)
 *  - Volumen global y mute
 *  - Stop de cualquier reproducción en curso
 */

import * as Tone from "tone";
import { NOTES, TUNING } from "../data/data";
import { type CagedPositionVoicing } from "../utils/chordEngine";

// ─── Estado del servicio ───────────────────────────────────────

let synth: Tone.PolySynth | null = null;
let bpm = 80;
let masterVolume = -6; // dBFS

function getSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.8 },
    });
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.25 });
    const vol = new Tone.Volume(masterVolume);
    synth.chain(reverb, vol, Tone.getDestination());
  }
  return synth;
}

// ─── Conversión MIDI → nombre de nota ─────────────────────────

/** Fret index → pitch class usando la afinación estándar */
function fretToPitchClass(stringIndex: number, fret: number): number {
  return (TUNING[stringIndex] + fret) % 12;
}

/** Convierte un pitch-class + octava a nota Tone.js ("C4", "F#3", etc.) */
function pitchToToneName(pitchClass: number, octave: number): string {
  return `${NOTES[pitchClass]}${octave}`;
}

/**
 * Calcula la octava aproximada para cada cuerda de guitarra:
 * - Cuerda 5 (6ª E) → E2
 * - Cuerda 4 (5ª A) → A2
 * - Cuerda 3 (4ª D) → D3
 * - Cuerda 2 (3ª G) → G3
 * - Cuerda 1 (2ª B) → B3
 * - Cuerda 0 (1ª e) → E4
 */
const BASE_OCTAVE = [4, 3, 3, 3, 2, 2]; // por stringIndex 0..5

function noteNameFromVoicing(stringIndex: number, fret: number): string {
  const pc = fretToPitchClass(stringIndex, fret);
  // Ajuste de octava si hay "wrap-around" en la escala cromática
  const openPc = TUNING[stringIndex];
  const wrapUp = pc < openPc ? 1 : 0;
  const octave = BASE_OCTAVE[stringIndex] + Math.floor(fret / 12) + wrapUp;
  return pitchToToneName(pc, octave);
}

// ─── API pública ───────────────────────────────────────────────

/** Establece el BPM global */
export function setAudioBPM(newBpm: number): void {
  bpm = Math.max(40, Math.min(240, newBpm));
  Tone.getTransport().bpm.value = bpm;
}

/** Establece el volumen maestro en dBFS */
export function setAudioVolume(db: number): void {
  masterVolume = db;
  if (synth) {
    // Re-crear cadena con nuevo volumen
    synth.disconnect();
    synth = null;
  }
}

/** Para toda reproducción en curso */
export function stopAudio(): void {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  synth?.releaseAll();
}

/**
 * Reproduce el acorde como arpegio ascendente.
 * Las notas suenan una por una según el BPM.
 */
export async function playArpeggio(voicing: CagedPositionVoicing, direction: "up" | "down" = "up"): Promise<void> {
  await Tone.start();
  stopAudio();

  const s = getSynth();
  const noteInterval = 60 / bpm; // segundos entre notas

  // Reunir las notas sonoras, ordenadas por cuerda (6→1 = graves primero)
  let activeNotes = voicing.notes
    .filter((n) => !voicing.mutedStrings.includes(n.string))
    .sort((a, b) => b.string - a.string); // 5..0 (grave → agudo)

  if (direction === "down") activeNotes = [...activeNotes].reverse();

  const now = Tone.now();
  activeNotes.forEach((note, idx) => {
    const noteName = noteNameFromVoicing(note.string, note.fret);
    s.triggerAttackRelease(noteName, "8n", now + idx * noteInterval);
  });
}

/**
 * Reproduce el acorde como rasgueo (strumming):
 * todas las notas casi simultáneas con un micro-delay escalonado.
 */
export async function playStrum(voicing: CagedPositionVoicing, direction: "up" | "down" = "down"): Promise<void> {
  await Tone.start();
  stopAudio();

  const s = getSynth();
  const strumDelay = 0.03; // 30ms entre cuerdas (rasgueo rápido)

  let activeNotes = voicing.notes
    .filter((n) => !voicing.mutedStrings.includes(n.string))
    .sort((a, b) => b.string - a.string); // grave → agudo

  if (direction === "up") activeNotes = [...activeNotes].reverse();

  const now = Tone.now();
  activeNotes.forEach((note, idx) => {
    const noteName = noteNameFromVoicing(note.string, note.fret);
    s.triggerAttackRelease(noteName, "4n", now + idx * strumDelay);
  });
}

/**
 * Reproduce una progresión de acordes completa.
 * Cada acorde suena por la duración de un compás (4 beats).
 */
export async function playProgression(
  voicings: CagedPositionVoicing[],
  mode: "arpeggio" | "strum" = "strum",
): Promise<void> {
  await Tone.start();
  stopAudio();

  const beatDuration = 60 / bpm; // segundos por beat
  const barDuration = 4 * beatDuration;
  const s = getSynth();
  const now = Tone.now();

  voicings.forEach((voicing, barIdx) => {
    const barStart = now + barIdx * barDuration;
    const activeNotes = voicing.notes
      .filter((n) => !voicing.mutedStrings.includes(n.string))
      .sort((a, b) => b.string - a.string);

    if (mode === "arpeggio") {
      activeNotes.forEach((note, noteIdx) => {
        const noteName = noteNameFromVoicing(note.string, note.fret);
        const t = barStart + noteIdx * (beatDuration / 2);
        s.triggerAttackRelease(noteName, "4n", t);
      });
    } else {
      // Strum en tiempos 1 y 3
      [0, beatDuration * 2].forEach((beat) => {
        activeNotes.forEach((note, noteIdx) => {
          const noteName = noteNameFromVoicing(note.string, note.fret);
          s.triggerAttackRelease(noteName, "8n", barStart + beat + noteIdx * 0.03);
        });
      });
    }
  });
}
