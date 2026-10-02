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

// ─── Renderizador principal ─────────────────────────────────────

export function renderCAGEDFretboard(
  container: HTMLElement,
  options: CAGEDFretboardOptions,
): SVGElement {
  const {
    voicing,
    chordName,
    fretWindow = 5,
    labelMode = "finger",
    onExportSVG,
  } = options;

  // Calcular ventana de trastes
  const frettedNotes = voicing.notes.filter((n) => n.fret > 0);
  const minFret = frettedNotes.length > 0 ? Math.min(...frettedNotes.map((n) => n.fret)) : 1;
  const startFret = Math.max(1, minFret);
  const endFret = startFret + fretWindow - 1;
  const showNut = startFret === 1;

  // Dimensiones
  const cols = fretWindow + (showNut ? 1 : 0);
  const svgW = LAYOUT.leftMargin + cols * LAYOUT.fretWidth + LAYOUT.rightPad;
  const svgH = LAYOUT.headerHeight + 6 * LAYOUT.stringHeight + 24;

  // Crear SVG
  const svg = svgEl("svg");
  setAttrs(svg, { width: svgW, height: svgH, viewBox: `0 0 ${svgW} ${svgH}`, xmlns: SVG_NS });
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Diagrama CAGED - Forma ${voicing.shape} - ${chordName}`);
  svg.style.cssText = "display:block;max-width:100%;border-radius:12px;overflow:hidden;";

  // Fondo
  const bgRect = svgEl("rect");
  setAttrs(bgRect, { x: 0, y: 0, width: svgW, height: svgH, fill: COLORS.bg, rx: 12 });
  svg.append(bgRect);

  // Título del acorde
  const title = svgEl("text");
  setAttrs(title, { x: LAYOUT.leftMargin, y: 18, fill: COLORS.nut, "font-size": 14, "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif" });
  title.textContent = `${chordName}  ·  Forma ${voicing.shape}`;
  svg.append(title);

  // Etiqueta de posición
  const posLabel = svgEl("text");
  setAttrs(posLabel, { x: svgW - LAYOUT.rightPad, y: 18, "text-anchor": "end", fill: COLORS.posLabel, "font-size": 11, "font-family": "Inter,system-ui,sans-serif" });
  posLabel.textContent = `Traste ${voicing.anchorFret}`;
  svg.append(posLabel);

  // Zona del diapasón
  const boardY = LAYOUT.headerHeight;

  // Fondo del diapasón
  const board = svgEl("rect");
  setAttrs(board, { x: LAYOUT.leftMargin, y: boardY, width: svgW - LAYOUT.leftMargin - LAYOUT.rightPad, height: 6 * LAYOUT.stringHeight, fill: COLORS.fretboard, rx: 4 });
  svg.append(board);

  // ── Zone Highlighter CAGED ──────────────────────────────────
  const zoneX = LAYOUT.leftMargin + (showNut ? LAYOUT.fretWidth : 0);
  const zoneW = fretWindow * LAYOUT.fretWidth;
  const zoneRect = svgEl("rect");
  setAttrs(zoneRect, {
    x: zoneX, y: boardY,
    width: zoneW, height: 6 * LAYOUT.stringHeight,
    fill: COLORS.zone, stroke: COLORS.zoneBorder,
    "stroke-width": 2, rx: 6,
  });
  svg.append(zoneRect);

  // ── Trastes (líneas verticales) ─────────────────────────────
  const nutX = showNut ? LAYOUT.leftMargin + LAYOUT.fretWidth : LAYOUT.leftMargin;
  if (showNut) {
    // Cejilla (nut)
    const nut = svgEl("rect");
    setAttrs(nut, {
      x: nutX - 4, y: boardY,
      width: 5, height: 6 * LAYOUT.stringHeight,
      fill: COLORS.nut,
    });
    svg.append(nut);
  }
  for (let col = 0; col <= fretWindow; col++) {
    const x = nutX + col * LAYOUT.fretWidth;
    const fretLine = svgEl("line");
    setAttrs(fretLine, {
      x1: x, y1: boardY, x2: x, y2: boardY + 6 * LAYOUT.stringHeight,
      stroke: COLORS.fretWire, "stroke-width": col === 0 && !showNut ? 2 : 1,
    });
    svg.append(fretLine);
  }

  // ── Inlays (marcadores de posición) ─────────────────────────
  const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21];
  const INLAY_DOUBLE = [12, 24];
  const midY = boardY + 3 * LAYOUT.stringHeight; // entre 3ª y 4ª cuerda

  for (let col = 0; col < fretWindow; col++) {
    const fret = startFret + col;
    const cx = nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
    if (INLAY_SINGLE.includes(fret)) {
      const dot = svgEl("circle");
      setAttrs(dot, { cx, cy: midY, r: 5, fill: COLORS.inlay });
      svg.append(dot);
    } else if (INLAY_DOUBLE.includes(fret)) {
      [-1, 1].forEach((offset) => {
        const dot = svgEl("circle");
        setAttrs(dot, { cx, cy: midY + offset * LAYOUT.stringHeight, r: 5, fill: COLORS.inlay });
        svg.append(dot);
      });
    }
  }

  // ── Cuerdas (líneas horizontales) ──────────────────────────
  for (let s = 0; s < 6; s++) {
    const visualRow = 5 - s;
    const y = boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
    const string = svgEl("line");
    setAttrs(string, {
      x1: LAYOUT.leftMargin, y1: y, x2: svgW - LAYOUT.rightPad, y2: y,
      stroke: COLORS.string,
      "stroke-width": STRING_THICKNESS[s],
    });
    svg.append(string);

    // Etiqueta de cuerda (izquierda)
    const label = svgEl("text");
    setAttrs(label, {
      x: LAYOUT.leftMargin - 6, y: y + 4,
      "text-anchor": "end",
      fill: "#5a6a8a",
      "font-size": 10,
      "font-family": "Inter,system-ui,sans-serif",
    });
    label.textContent = STRING_LABELS[s];
    svg.append(label);
  }

  // ── Numeración de trastes (abajo del diapasón) ─────────────
  for (let col = 0; col < fretWindow; col++) {
    const fret = startFret + col;
    const cx = nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
    const fretNum = svgEl("text");
    setAttrs(fretNum, {
      x: cx, y: boardY + 6 * LAYOUT.stringHeight + 16,
      "text-anchor": "middle",
      fill: "#4a5a7a",
      "font-size": 10,
      "font-family": "Inter,system-ui,sans-serif",
    });
    fretNum.textContent = String(fret);
    svg.append(fretNum);
  }

  // ── Indicadores O/X (cuerdas al aire o mudas) ──────────────
  if (showNut) {
    for (let s = 0; s < 6; s++) {
      const noteOnThisString = voicing.notes.find((n) => n.string === s);
      const isMuted = voicing.mutedStrings.includes(s);
      const isOpen = noteOnThisString?.fret === 0;

      if (isMuted || (!noteOnThisString && !isOpen)) {
        // X muda
        const visualRow = 5 - s;
        const indicX = svgEl("text");
        setAttrs(indicX, {
          x: LAYOUT.leftMargin - 15,
          y: boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2 + 4,
          "text-anchor": "middle", fill: COLORS.mutedColor,
          "font-size": 13, "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif",
        });
        indicX.textContent = "×";
        svg.append(indicX);
      } else if (isOpen) {
        const visualRow = 5 - s;
        const indicO = svgEl("text");
        setAttrs(indicO, {
          x: LAYOUT.leftMargin - 15,
          y: boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2 + 4,
          "text-anchor": "middle", fill: COLORS.openColor,
          "font-size": 13, "font-weight": "bold", "font-family": "Inter,system-ui,sans-serif",
        });
        indicO.textContent = "○";
        svg.append(indicO);
      }
    }
  }

  // ── Cejilla (barre) ─────────────────────────────────────────
  if (voicing.barre) {
    const { fret, fromString, toString: toStr } = voicing.barre;
    if (fret >= startFret && fret <= endFret) {
      const col = fret - startFret;
      const cx = nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
      const y1 = boardY + (5 - toStr) * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
      const y2 = boardY + (5 - fromString) * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
      const barreH = Math.abs(y2 - y1) + LAYOUT.noteRadius * 2;
      const barreY = Math.min(y1, y2) - LAYOUT.noteRadius;
      const barre = svgEl("rect");
      setAttrs(barre, {
        x: cx - LAYOUT.noteRadius,
        y: barreY,
        width: LAYOUT.noteRadius * 2,
        height: barreH,
        fill: COLORS.barreColor,
        stroke: COLORS.chordStroke,
        "stroke-width": 1.5,
        rx: LAYOUT.noteRadius,
      });
      svg.append(barre);
    }
  }

  // ── Puntos de nota ──────────────────────────────────────────
  for (const note of voicing.notes) {
    const { string: s, fret, interval, finger } = note;
    if (fret < startFret || fret > endFret) continue;
    const col = fret - startFret;
    const cx = nutX + col * LAYOUT.fretWidth + LAYOUT.fretWidth / 2;
    const visualRow = 5 - s;
    const cy = boardY + visualRow * LAYOUT.stringHeight + LAYOUT.stringHeight / 2;
    const isRoot = interval === 0;

    // Círculo
    const circle = svgEl("circle");
    setAttrs(circle, {
      cx, cy, r: LAYOUT.noteRadius,
      fill: isRoot ? COLORS.rootFill : COLORS.chordFill,
      stroke: isRoot ? COLORS.rootStroke : COLORS.chordStroke,
      "stroke-width": isRoot ? 2.5 : 1.5,
    });
    // Brillo sutil en la raíz
    if (isRoot) {
      circle.style.filter = "drop-shadow(0 0 6px rgba(212,168,75,0.7))";
    }
    svg.append(circle);

    // Texto etiqueta
    const labelEl = svgEl("text");
    setAttrs(labelEl, {
      x: cx, y: cy + 4,
      "text-anchor": "middle",
      fill: COLORS.labelColor,
      "font-size": labelMode === "interval" ? 8 : 11,
      "font-weight": "bold",
      "font-family": "Inter,system-ui,sans-serif",
    });
    if (labelMode === "finger") {
      labelEl.textContent = finger > 0 ? String(finger) : isRoot ? "T" : "0";
    } else if (labelMode === "interval") {
      labelEl.textContent = intervalLabel(interval).split("(")[0].trim().substring(0, 3);
    } else {
      labelEl.textContent = String(finger);
    }
    svg.append(labelEl);
  }

  // Limpiar y montar
  container.replaceChildren(svg);

  // Botón exportar SVG
  if (onExportSVG) {
    const btn = document.createElement("button");
    btn.className = "export-btn";
    btn.textContent = "↓ Exportar SVG";
    btn.addEventListener("click", () => onExportSVG(svg));
    container.append(btn);
  }

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
