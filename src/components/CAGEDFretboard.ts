/**
 * CAGEDFretboard.ts
 * ─────────────────────────────────────────────────────────────
 * Componente SVG responsivo para visualizar el diapasón CAGED.
 *
 * Características:
 *  - 6 cuerdas con grosores calibrados (0.8px → 2.4px)
 *  - Marcadores de posición (3, 5, 7, 9 = punto simple; 12 = doble)
 *  - Zone Highlighter translúcido para la ventana CAGED activa
 *  - Círculos de notas con etiquetas conmutables (dedo/intervalo)
 *  - Tónica con estilo dorado diferenciado
 *  - Cejillas (barre) como cápsulas horizontales redondeadas
 *  - Indicadores O/X sobre el traste 0
 *  - Exportación directa a SVG
 */

import { INTERVAL_NAMES, type CagedPositionVoicing } from "../utils/chordEngine";

// ─── Constantes de layout ──────────────────────────────────────
const SVG_NS = "http://www.w3.org/2000/svg";

const LAYOUT = {
  // Cabecera (zona O/X) y margen superior
  headerHeight: 28,
  // Margen izquierdo (etiquetas de cuerda)
  leftMargin: 32,
  // Ancho de celda por traste
  fretWidth: 48,
  // Altura de celda por cuerda
  stringHeight: 36,
  // Radio de los puntos de nota
  noteRadius: 13,
  // Padding derecho
  rightPad: 16,
};

const STRING_THICKNESS = [0.8, 1.0, 1.2, 1.6, 2.0, 2.4]; // 1ª..6ª
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];
const INLAY_SINGLE = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const INLAY_DOUBLE = new Set([12, 24]);

// Colores del tema (oscuro premium)
const COLORS = {
  bg: "#141820",
  fretboard: "#1a2030",
  string: "#8899bb",
  fretWire: "#384060",
  nut: "#d4a84b",
  inlay: "#2a3450",
  zone: "rgba(120,180,255,0.12)",
  zoneBorder: "rgba(120,180,255,0.45)",
  rootFill: "#d4a84b",
  rootStroke: "#ffe082",
  chordFill: "#2d6bbf",
  chordStroke: "#90caf9",
  barreColor: "rgba(45,107,191,0.55)",
  mutedColor: "#ff5252",
  openColor: "#66bb6a",
  labelColor: "#ffffff",
  posLabel: "#90caf9",
};

type LabelMode = "finger" | "interval" | "note";

export interface CAGEDFretboardOptions {
  voicing: CagedPositionVoicing;
  /** Nombre del acorde (ej. "Cmaj7") */
  chordName: string;
  /** Raíz para colorear la tónica */
  rootNote: string;
  /** Cuántos trastes mostrar en la ventana */
  fretWindow?: number;
  /** Modo de etiqueta en los puntos */
  labelMode?: LabelMode;
  /** Callback al hacer click en exportar SVG */
  onExportSVG?: (svg: SVGElement) => void;
}

// ─── Helpers SVG ───────────────────────────────────────────────

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
}

function setAttrs(el: Element, attrs: Record<string, string | number>): void {
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
}

function intervalLabel(interval: number): string {
  return INTERVAL_NAMES[interval] ?? `${interval}st`;
}

interface FretboardLayout {
  svg: SVGElement;
  voicing: CagedPositionVoicing;
  chordName: string;
  labelMode: LabelMode;
  fretWindow: number;
  startFret: number;
  endFret: number;
  showNut: boolean;
  svgW: number;
  svgH: number;
  boardY: number;
  nutX: number;
}

function appendHeader(layout: FretboardLayout): void {
  const { svg, svgW, svgH, chordName, voicing } = layout;
  const positionName = voicing.displayName ?? `Forma ${voicing.shape}`;
  const background = svgEl("rect");
  setAttrs(background, { x: 0, y: 0, width: svgW, height: svgH, fill: COLORS.bg, rx: 12 });
  svg.append(background);

  const title = svgEl("text");
  setAttrs(title, { x: LAYOUT.leftMargin, y: 18, fill: COLORS.nut, "font-size": 14, "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif" });
  title.textContent = `${chordName}  ·  ${positionName}`;
  svg.append(title);

  const position = svgEl("text");
  setAttrs(position, { x: svgW - LAYOUT.rightPad, y: 18, "text-anchor": "end", fill: COLORS.posLabel, "font-size": 11, "font-family": "Inter,system-ui,sans-serif" });
  position.textContent = `Traste ${voicing.anchorFret}`;
  svg.append(position);
}

function appendFretboard(layout: FretboardLayout): void {
  const { svg, svgW, fretWindow, showNut, boardY, nutX } = layout;
  const board = svgEl("rect");
  setAttrs(board, { x: LAYOUT.leftMargin, y: boardY, width: svgW - LAYOUT.leftMargin - LAYOUT.rightPad, height: 6 * LAYOUT.stringHeight, fill: COLORS.fretboard, rx: 4 });
  svg.append(board);

  const zone = svgEl("rect");
  setAttrs(zone, {
    x: LAYOUT.leftMargin + (showNut ? LAYOUT.fretWidth : 0), y: boardY,
    width: fretWindow * LAYOUT.fretWidth, height: 6 * LAYOUT.stringHeight,
    fill: COLORS.zone, stroke: COLORS.zoneBorder, "stroke-width": 2, rx: 6,
  });
  svg.append(zone);

  if (showNut) {
    const nut = svgEl("rect");
    setAttrs(nut, { x: nutX - 4, y: boardY, width: 5, height: 6 * LAYOUT.stringHeight, fill: COLORS.nut });
    svg.append(nut);
  }

  for (let col = 0; col <= fretWindow; col += 1) {
    const x = nutX + col * LAYOUT.fretWidth;
    const line = svgEl("line");
    setAttrs(line, {
      x1: x, y1: boardY, x2: x, y2: boardY + 6 * LAYOUT.stringHeight,
      stroke: COLORS.fretWire, "stroke-width": col === 0 && !showNut ? 2 : 1,
    });
    svg.append(line);
  }
}

function appendInlays(layout: FretboardLayout): void {
  const { svg, fretWindow, startFret, boardY, nutX } = layout;
  const middleY = boardY + 3 * LAYOUT.stringHeight;
  for (let col = 0; col < fretWindow; col += 1) {
    const fret = startFret + col;
    const centerX = nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
    let offsets: number[] = [];
    if (INLAY_SINGLE.has(fret)) offsets = [0];
    else if (INLAY_DOUBLE.has(fret)) offsets = [-1, 1];
    offsets.forEach((offset) => {
      const dot = svgEl("circle");
      setAttrs(dot, { cx: centerX, cy: middleY + offset * LAYOUT.stringHeight, r: 5, fill: COLORS.inlay });
      svg.append(dot);
    });
  }
}

function appendStrings(layout: FretboardLayout): void {
  const { svg, svgW, boardY } = layout;
  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    const visualRow = 5 - stringIndex;
    const y = boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
    const string = svgEl("line");
    setAttrs(string, {
      x1: LAYOUT.leftMargin, y1: y, x2: svgW - LAYOUT.rightPad, y2: y,
      stroke: COLORS.string, "stroke-width": STRING_THICKNESS[stringIndex],
    });
    svg.append(string);

    const label = svgEl("text");
    setAttrs(label, {
      x: LAYOUT.leftMargin - 6, y: y + 4, "text-anchor": "end",
      fill: "#5a6a8a", "font-size": 10, "font-family": "Inter,system-ui,sans-serif",
    });
    label.textContent = STRING_LABELS[stringIndex];
    svg.append(label);
  }
}

function appendFretNumbers(layout: FretboardLayout): void {
  const { svg, fretWindow, startFret, boardY, nutX } = layout;
  for (let col = 0; col < fretWindow; col += 1) {
    const fretNumber = svgEl("text");
    setAttrs(fretNumber, {
      x: nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2,
      y: boardY + 6 * LAYOUT.stringHeight + 16,
      "text-anchor": "middle", fill: "#4a5a7a", "font-size": 10,
      "font-family": "Inter,system-ui,sans-serif",
    });
    fretNumber.textContent = String(startFret + col);
    svg.append(fretNumber);
  }
}

function appendOpenStringIndicators(layout: FretboardLayout): void {
  const { svg, voicing, showNut, boardY } = layout;
  if (!showNut) return;

  for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) {
    const note = voicing.notes.find((item) => item.string === stringIndex);
    const isMuted = voicing.mutedStrings.includes(stringIndex);
    const isOpen = note?.fret === 0;
    if (!isMuted && note && !isOpen) continue;

    const visualRow = 5 - stringIndex;
    const indicator = svgEl("text");
    setAttrs(indicator, {
      x: LAYOUT.leftMargin - 15,
      y: boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2 + 4,
      "text-anchor": "middle", fill: isOpen && !isMuted ? COLORS.openColor : COLORS.mutedColor,
      "font-size": 13, "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif",
    });
    indicator.textContent = isOpen && !isMuted ? "○" : "×";
    svg.append(indicator);
  }
}

function appendBarre(layout: FretboardLayout): void {
  const { svg, voicing, startFret, endFret, boardY, nutX } = layout;
  const barreInfo = voicing.barre;
  if (!barreInfo || barreInfo.fret < startFret || barreInfo.fret > endFret) return;

  const centerX = nutX + (barreInfo.fret - startFret) * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
  const upperY = boardY + (5 - barreInfo.toString) * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
  const lowerY = boardY + (5 - barreInfo.fromString) * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
  const barre = svgEl("rect");
  setAttrs(barre, {
    x: centerX - LAYOUT.noteRadius,
    y: Math.min(upperY, lowerY) - LAYOUT.noteRadius,
    width: LAYOUT.noteRadius * 2,
    height: Math.abs(lowerY - upperY) + LAYOUT.noteRadius * 2,
    fill: COLORS.barreColor, stroke: COLORS.chordStroke,
    "stroke-width": 1.5, rx: LAYOUT.noteRadius,
  });
  svg.append(barre);
}

function noteText(finger: number, interval: number, isRoot: boolean, mode: LabelMode): string {
  if (mode === "interval") {
    if (isRoot) return "R";
    const intervalLabels: Record<number, string> = {
      1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5",
      7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7",
    };
    return intervalLabels[interval] ?? intervalLabel(interval);
  }
  if (mode === "note") return String(finger);
  if (finger > 0) return String(finger);
  return isRoot ? "T" : "0";
}

function appendNotes(layout: FretboardLayout): void {
  const { svg, voicing, labelMode, startFret, endFret, boardY, nutX } = layout;
  for (const note of voicing.notes) {
    const { string: stringIndex, fret, interval, finger } = note;
    if (fret < startFret || fret > endFret) continue;

    const centerX = nutX + (fret - startFret) * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
    const visualRow = 5 - stringIndex;
    const centerY = boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
    const isRoot = interval === 0;
    const circle = svgEl("circle");
    setAttrs(circle, {
      cx: centerX, cy: centerY, r: LAYOUT.noteRadius,
      fill: isRoot ? COLORS.rootFill : COLORS.chordFill,
      stroke: isRoot ? COLORS.rootStroke : COLORS.chordStroke,
      "stroke-width": isRoot ? 2.5 : 1.5,
    });
    if (isRoot) circle.style.filter = "drop-shadow(0 0 6px rgba(212,168,75,0.7))";
    svg.append(circle);

    const label = svgEl("text");
    setAttrs(label, {
      x: centerX, y: centerY + 4, "text-anchor": "middle",
      fill: COLORS.labelColor, "font-size": labelMode === "interval" ? 8 : 11,
      "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif",
    });
    label.textContent = noteText(finger, interval, isRoot, labelMode);
    svg.append(label);
  }
}

function appendExportButton(container: HTMLElement, svg: SVGElement, onExportSVG?: (svg: SVGElement) => void): void {
  if (!onExportSVG) return;
  const button = document.createElement("button");
  button.className = "export-btn";
  button.textContent = "↓ Exportar SVG";
  button.addEventListener("click", () => onExportSVG(svg));
  container.append(button);
}

// ─── Renderizador principal ─────────────────────────────────────

export function renderCAGEDFretboard(
  container: HTMLElement,
  options: CAGEDFretboardOptions,
): SVGElement {
  const { voicing, chordName, fretWindow = 5, labelMode = "interval", onExportSVG } = options;
  const frettedNotes = voicing.notes.filter((note) => note.fret > 0);
  const lowestFret = frettedNotes.length > 0 ? Math.min(...frettedNotes.map((note) => note.fret)) : 1;
  const startFret = Math.max(1, lowestFret);
  const showNut = startFret === 1;
  const svgW = LAYOUT.leftMargin + (fretWindow + (showNut ? 1 : 0)) * LAYOUT.fretWidth + LAYOUT.rightPad;
  const svgH = LAYOUT.headerHeight + 6 * LAYOUT.stringHeight + 24;
  const svg = svgEl("svg");
  setAttrs(svg, { width: svgW, height: svgH, viewBox: `0 0 ${svgW} ${svgH}`, xmlns: SVG_NS });
  svg.setAttribute("role", "img");
  const positionName = voicing.displayName ?? `Forma ${voicing.shape}`;
  svg.setAttribute("aria-label", `Diagrama CAGED - ${positionName} - ${chordName}`);
  svg.style.cssText = "display:block;max-width:100%;border-radius:12px;overflow:hidden;";

  const layout: FretboardLayout = {
    svg, voicing, chordName, labelMode, fretWindow, startFret,
    endFret: startFret + fretWindow - 1, showNut, svgW, svgH,
    boardY: LAYOUT.headerHeight,
    nutX: showNut ? LAYOUT.leftMargin + LAYOUT.fretWidth : LAYOUT.leftMargin,
  };
  appendHeader(layout);
  appendFretboard(layout);
  appendInlays(layout);
  appendStrings(layout);
  appendFretNumbers(layout);
  appendOpenStringIndicators(layout);
  appendBarre(layout);
  appendNotes(layout);

  container.replaceChildren(svg);
  appendExportButton(container, svg, onExportSVG);
  return svg;
}

/** Serializa el SVG a string y dispara la descarga */
export function exportSVGToFile(svg: SVGElement, filename = "caged-chord.svg"): void {
  const serializer = new XMLSerializer();
  const svgStr = `<?xml version="1.0" encoding="utf-8"?>\n${serializer.serializeToString(svg)}`;
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
