/**
 * cagedModule.ts
 * ─────────────────────────────────────────────────────────────
 * Módulo UI avanzado para el Sistema CAGED.
 * Se integra con la arquitectura existente de ui.ts sin reemplazarla.
 *
 * Características:
 *  - Selector de progresión (Vol 1, 2 y 3)
 *  - Selector de tonalidad y forma alternativa
 *  - Visualización SVG de las 5 posiciones CAGED
 *  - Reproducción arpeggio / strum con control de BPM
 *  - Exportación SVG, PDF y MIDI
 */

import { NOTES, type CagedQuality, type Note } from "./data/data";
import {
  buildCagedVoicings,
  buildProgressionChords,
  PROGRESSIONS,
  cagedTemplateQualityForChord,
  cagedTemplateQualityForSelection,
  toRomanFret,
  type CagedPositionVoicing,
  type CagedShapeId,
  type AlternateShapeId,
} from "./utils/chordEngine";
import { renderCAGEDFretboard, exportSVGToFile } from "./components/CAGEDFretboard";
import { playArpeggio, playStrum, stopAudio, setAudioBPM } from "./services/audio";
import { exportProgressionPDF, exportProgressionMIDI } from "./services/exportService";

// ─── Tipos internos ────────────────────────────────────────────

type LabelMode = "finger" | "interval";

interface CagedModuleState {
  tonic: Note;
  progressionId: string;
  cagedQuality: CagedQuality;
  altShape: AlternateShapeId | "none";
  labelMode: LabelMode;
  bpm: number;
  selectedChordIdx: number;
  selectedShapeIdx: number;
}

// ─── Helpers DOM ───────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}

function selectEl(id: string, options: Array<[string, string]>, selected: string): HTMLSelectElement {
  const s = el("select");
  s.id = id;
  options.forEach(([value, label]) => {
    const opt = el("option");
    opt.value = value;
    opt.textContent = label;
    s.append(opt);
  });
  s.value = selected;
  return s;
}

// ─── Renderizador principal ─────────────────────────────────────

export function mountCagedModule(container: HTMLElement): void {
  const state: CagedModuleState = {
    tonic: "C",
    progressionId: "v1-1",
    cagedQuality: "Maj",
    altShape: "none",
    labelMode: "finger",
    bpm: 80,
    selectedChordIdx: 0,
    selectedShapeIdx: 0,
  };

  let currentVoicings: CagedPositionVoicing[] = [];
  let currentSVG: SVGElement | null = null;

  const activeShape = (): CagedShapeId => currentVoicings[state.selectedShapeIdx]?.shape ?? "E";

  // ── Layout principal ──────────────────────────────────────
  const section = el("section", "caged-advanced-section");
  const intro = el("div", "section-intro");
  const title = el("h2");
  title.textContent = "Sistema CAGED — Motor Avanzado";
  const desc = el("p");
  desc.textContent = "Visualiza las 5 posiciones CAGED con voicings precisos, progresiones Vol. 1-3, reproducción y exportación SVG/PDF/MIDI.";
  intro.append(title, desc);
  section.append(intro);

  // ── Panel de controles ────────────────────────────────────
  const controlsGrid = el("div", "caged-controls-grid");

  // Tónica
  const tonicSel = selectEl("caged-tonic", NOTES.map((n) => [n, n]), state.tonic);
  tonicSel.addEventListener("change", () => { state.tonic = tonicSel.value as Note; redraw(); });

  // Progresión
  const progOptions: Array<[string, string]> = [
    ["", "── Sin progresión ──"],
    ...PROGRESSIONS.map((p): [string, string] => [`${p.id}`, `Vol. ${p.volume}: ${p.label}`]),
  ];
  const progSel = selectEl("caged-progression", progOptions, state.progressionId);
  progSel.addEventListener("change", () => { state.progressionId = progSel.value; state.selectedChordIdx = 0; redraw(); });

  // Calidad del acorde
  const qualityOptions: Array<[string, string]> = [
    ["Maj", "Mayor"], ["min", "Menor"], ["dom7", "Dom 7"], ["Maj7", "Maj 7"],
    ["min7", "Min 7"], ["m7b5", "m7b5"], ["dim7", "Dim 7"], ["dim", "Dim"], ["aug", "Aug"],
  ];
  const qualitySel = selectEl("caged-quality-adv", qualityOptions, state.cagedQuality);
  qualitySel.addEventListener("change", () => { state.cagedQuality = qualitySel.value as CagedQuality; redraw(); });

  // Forma alternativa
  const altShapeOptions: Array<[string, string]> = [
    ["none", "Estándar"], ["sus2", "Sus2"], ["sus4", "Sus4"], ["add9", "Add9"],
    ["min11", "m11"], ["Maj9", "Maj9"],
  ];
  const altSel = selectEl("caged-alt-shape", altShapeOptions, state.altShape);
  altSel.addEventListener("change", () => { state.altShape = altSel.value as AlternateShapeId | "none"; redraw(); });

  // Etiquetas
  const labelOptions: Array<[string, string]> = [["finger", "Dedos (1-4)"], ["interval", "Intervalos"]];
  const labelSel = selectEl("caged-label-mode", labelOptions, state.labelMode);
  labelSel.addEventListener("change", () => { state.labelMode = labelSel.value as LabelMode; redraw(); });

  // BPM
  const bpmWrapper = el("div", "bpm-control");
  const bpmLabel = el("label");
  bpmLabel.textContent = `BPM: ${state.bpm}`;
  bpmLabel.htmlFor = "caged-bpm";
  const bpmInput = el("input");
  bpmInput.type = "range";
  bpmInput.id = "caged-bpm";
  bpmInput.min = "40";
  bpmInput.max = "200";
  bpmInput.value = String(state.bpm);
  bpmInput.addEventListener("input", () => {
    state.bpm = Number(bpmInput.value);
    bpmLabel.textContent = `BPM: ${state.bpm}`;
    setAudioBPM(state.bpm);
  });
  bpmWrapper.append(bpmLabel, bpmInput);

  // Añadir campos al grid
  const fields: Array<[string, HTMLElement]> = [
    ["Tónica", tonicSel],
    ["Calidad", qualitySel],
    ["Progresión", progSel],
    ["Forma alternativa", altSel],
    ["Etiquetas", labelSel],
  ];
  fields.forEach(([labelText, control]) => {
    const wrapper = el("div", "caged-field");
    const lbl = el("label");
    lbl.textContent = labelText;
    lbl.htmlFor = (control as HTMLElement & { id: string }).id;
    wrapper.append(lbl, control);
    controlsGrid.append(wrapper);
  });
  controlsGrid.append(bpmWrapper);
  section.append(controlsGrid);

  // ── Panel de progresión (acordes seleccionables) ──────────
  const progressionPanel = el("div", "progression-panel");
  section.append(progressionPanel);

  // ── Botones de audio ──────────────────────────────────────
  const audioBar = el("div", "audio-bar");
  const btnArp = el("button", "audio-btn");
  btnArp.textContent = "▶ Arpegio";
  btnArp.id = "btn-arpeggio";
  btnArp.addEventListener("click", async () => {
    if (currentVoicings.length > 0) await playArpeggio(currentVoicings[state.selectedShapeIdx]);
  });
  const btnStrum = el("button", "audio-btn");
  btnStrum.textContent = "🎸 Rasgueo";
  btnStrum.id = "btn-strum";
  btnStrum.addEventListener("click", async () => {
    if (currentVoicings.length > 0) await playStrum(currentVoicings[state.selectedShapeIdx]);
  });
  const btnStop = el("button", "audio-btn stop-btn");
  btnStop.textContent = "⏹ Stop";
  btnStop.id = "btn-stop";
  btnStop.addEventListener("click", stopAudio);
  audioBar.append(btnArp, btnStrum, btnStop);
  section.append(audioBar);

  // ── Tabs de formas CAGED ──────────────────────────────────
  const shapeTabs = el("div", "caged-shape-tabs");
  section.append(shapeTabs);

  // ── Área del diagrama SVG ────────────────────────────────
  const diagramArea = el("div", "caged-diagram-area");
  section.append(diagramArea);

  // ── Botones de exportación ────────────────────────────────
  const exportBar = el("div", "export-bar");
  const btnSVG = el("button", "export-btn");
  btnSVG.textContent = "↓ SVG";
  btnSVG.id = "btn-export-svg";
  btnSVG.addEventListener("click", () => {
    if (currentSVG) exportSVGToFile(currentSVG, `caged-${state.tonic}-forma${currentVoicings[state.selectedShapeIdx]?.shape}.svg`);
  });
  const btnPDF = el("button", "export-btn");
  btnPDF.textContent = "↓ PDF";
  btnPDF.id = "btn-export-pdf";
  btnPDF.addEventListener("click", () => {
    if (!state.progressionId) return;
    const progChords = buildProgressionChords(state.tonic, state.progressionId, state.altShape === "none" ? undefined : state.altShape, activeShape());
    const chordData = progChords.map((chord) => ({
      chord,
      voicings: buildCagedVoicings(chord.root, cagedTemplateQualityForChord(chord.quality.id)),
    }));
    const prog = PROGRESSIONS.find((p) => p.id === state.progressionId);
    exportProgressionPDF(prog?.label ?? state.progressionId, state.tonic, chordData);
  });
  const btnMIDI = el("button", "export-btn");
  btnMIDI.textContent = "↓ MIDI";
  btnMIDI.id = "btn-export-midi";
  btnMIDI.addEventListener("click", () => {
    if (!state.progressionId) return;
    const progChords = buildProgressionChords(state.tonic, state.progressionId, state.altShape === "none" ? undefined : state.altShape, activeShape());
    const midiData = progChords.map((chord) => ({
      chord,
      voicing: buildCagedVoicings(chord.root, cagedTemplateQualityForChord(chord.quality.id))[0],
    })).filter((d) => d.voicing);
    exportProgressionMIDI(midiData, state.bpm, `progresion-${state.tonic}.mid`);
  });
  exportBar.append(btnSVG, btnPDF, btnMIDI);
  section.append(exportBar);

  // ── Función de redibujado ────────────────────────────────
  function redraw(): void {
    // Calcular voicings del acorde actual
    const quality = state.cagedQuality;
    currentVoicings = buildCagedVoicings(state.tonic, cagedTemplateQualityForSelection(quality));

    // Renderizar panel de progresión
    progressionPanel.replaceChildren();
    if (state.progressionId) {
      const progChords = buildProgressionChords(
        state.tonic,
        state.progressionId,
        state.altShape !== "none" ? state.altShape : undefined,
        activeShape(),
      );
      if (progChords.length > 0) {
        const progTitle = el("h3", "progression-title");
        const prog = PROGRESSIONS.find((p) => p.id === state.progressionId);
        progTitle.textContent = `Progresión: ${prog?.label ?? ""}`;
        progressionPanel.append(progTitle);
        const chordBtns = el("div", "chord-btn-row");
        progChords.forEach((chord, idx) => {
          const btn = el("button", `chord-pill${idx === state.selectedChordIdx ? " active" : ""}`);
          btn.textContent = chord.name;
          btn.id = `chord-pill-${idx}`;
          btn.addEventListener("click", () => {
            state.selectedChordIdx = idx;
            // Actualizar voicings para este acorde de la progresión
            currentVoicings = buildCagedVoicings(chord.root, cagedTemplateQualityForChord(chord.quality.id));
            redrawDiagram();
            chordBtns.querySelectorAll(".chord-pill").forEach((b, i) => b.classList.toggle("active", i === idx));
          });
          chordBtns.append(btn);
        });
        progressionPanel.append(chordBtns);
      }
    }

    // Renderizar tabs de formas
    shapeTabs.replaceChildren();
    currentVoicings.slice(0, 5).forEach((v, idx) => {
      const tab = el("button", `shape-tab${idx === state.selectedShapeIdx ? " active" : ""}`);
      tab.textContent = `${v.shape} · T${toRomanFret(v.anchorFret)}`;
      tab.id = `shape-tab-${idx}`;
      tab.addEventListener("click", () => {
        state.selectedShapeIdx = idx;
        shapeTabs.querySelectorAll(".shape-tab").forEach((t, i) => t.classList.toggle("active", i === idx));
        redrawDiagram();
      });
      shapeTabs.append(tab);
    });

    redrawDiagram();
  }

  function redrawDiagram(): void {
    if (currentVoicings.length === 0) {
      diagramArea.replaceChildren(Object.assign(el("p", "empty-state"), { textContent: "No hay voicings disponibles para esta combinación." }));
      return;
    }
    const voicing = currentVoicings[Math.min(state.selectedShapeIdx, currentVoicings.length - 1)];
    if (!voicing) return;

    currentSVG = renderCAGEDFretboard(diagramArea, {
      voicing,
      chordName: state.tonic + (state.cagedQuality !== "Maj" ? state.cagedQuality : ""),
      rootNote: state.tonic,
      labelMode: state.labelMode,
      fretWindow: 5,
    });
  }

  // Dibujo inicial
  redraw();
  container.replaceChildren(section);
}
