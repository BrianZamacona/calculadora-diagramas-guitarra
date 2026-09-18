import { ARPEGGIOS, CAGED_QUALITIES, CAGED_SHAPES, FRET_COUNT, NOTES, SCALES, STRINGS, type ArpeggioId, type CagedLayer, type CagedQuality, type CagedShape, type ModuleId, type ScaleId } from "./data";
import { clampRange, findCagedBoxes, findCagedLayerMarks, findDoubleStops, findMarks, findScaleMarks, findVoicingMarks, type CagedWindow, type FretMark, type Range, type ScaleSystem } from "./domain";

type DisplayMode = "notes" | "intervals" | "both";
interface State { module: ModuleId; root: string; scale: ScaleId; scaleSystem: ScaleSystem; arpeggio: ArpeggioId; arpeggioMode: "full" | "drop2-14" | "drop2-25"; stringSet: number; cagedShape: CagedShape; cagedQuality: CagedQuality; cagedLayer: CagedLayer; display: DisplayMode; start: number; end: number; doubleStop: number; }

const MODULES: Array<{ id: ModuleId; label: string }> = [
  { id: "triadas", label: "Tríadas" }, { id: "arp", label: "Arpegios" }, { id: "esc", label: "Escalas" }, { id: "ds", label: "Double stops" }, { id: "caged", label: "CAGED" },
];

// agrupación original: Escalas Base, Pentatónicas & Blues, Modos Griegos
const SCALE_GROUPS: Array<[string, ScaleId[]]> = [
  ["Escalas Base", ["mayor", "menor", "armonica", "melodica"]],
  ["Pentatónicas & Blues", ["pent-menor", "pent-mayor", "blues-menor", "blues-mayor"]],
  ["Modos Griegos", ["dorico", "frigio", "lidio", "mixolidio", "locrio"]],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
function selectOptions(select: HTMLSelectElement, options: readonly string[], selected: string): void {
  options.forEach((value) => { const option = el("option"); option.value = value; option.textContent = value; select.append(option); });
  select.value = selected;
}
function field(labelText: string, control: HTMLElement): HTMLElement {
  const wrapper = el("div", "field"); const label = el("label"); label.textContent = labelText; wrapper.append(label, control); return wrapper;
}
function selectControl(id: string, values: readonly string[], selected: string): HTMLSelectElement {
  const select = el("select"); select.id = id; selectOptions(select, values, selected); return select;
}
function rangeControls(state: State): HTMLElement {
  const wrapper = el("div", "range"); const start = el("input"); start.type = "number"; start.min = "0"; start.max = String(FRET_COUNT - 3); start.value = String(state.start); start.dataset.range = "start";
  const separator = el("span"); separator.textContent = "a"; const end = el("input"); end.type = "number"; end.min = "3"; end.max = String(FRET_COUNT); end.value = String(state.end); end.dataset.range = "end"; wrapper.append(start, separator, end); return wrapper;
}
function controls(state: State, onChange: () => void): HTMLElement {
  const panel = el("div", "panel controls");
  const root = selectControl("root", NOTES, state.root); root.addEventListener("change", () => { state.root = root.value; onChange(); }); panel.append(field("Nota raíz", root));
  if (state.module === "triadas") { const strings = selectControl("string-set", ["0", "1", "2", "3"], String(state.stringSet)); strings.replaceChildren(...["Cuerdas 1-2-3", "Cuerdas 2-3-4", "Cuerdas 3-4-5", "Cuerdas 4-5-6"].map((label, index) => { const option = el("option"); option.value = String(index); option.textContent = label; return option; })); strings.value = String(state.stringSet); strings.addEventListener("change", () => { state.stringSet = Number(strings.value); onChange(); }); panel.append(field("Juego de cuerdas", strings)); }
  if (state.module === "esc") { const scale = selectControl("scale", Object.keys(SCALES), state.scale); scale.replaceChildren(...SCALE_GROUPS.map(([groupLabel, ids]) => { const group = document.createElement("optgroup"); group.label = groupLabel; group.append(...ids.map((id) => { const option = el("option"); option.value = id; option.textContent = SCALES[id].label; return option; })); return group; })); scale.value = state.scale; scale.addEventListener("change", () => { state.scale = scale.value as ScaleId; onChange(); }); panel.append(field("Escala / modo", scale)); }
  if (state.module === "arp") { const arp = selectControl("arpeggio", Object.keys(ARPEGGIOS), state.arpeggio); arp.replaceChildren(...Object.entries(ARPEGGIOS).map(([id, item]) => { const option = el("option"); option.value = id; option.textContent = item.label; return option; })); arp.value = state.arpeggio; arp.addEventListener("change", () => { state.arpeggio = arp.value as ArpeggioId; onChange(); }); panel.append(field("Tipo de arpegio", arp)); const mode = selectControl("arpeggio-mode", ["full", "drop2-14", "drop2-25"], state.arpeggioMode); mode.replaceChildren(...[["full", "Arpegio completo"], ["drop2-14", "Drop 2: cuerdas 1-4"], ["drop2-25", "Drop 2: cuerdas 2-5"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); mode.value = state.arpeggioMode; mode.addEventListener("change", () => { state.arpeggioMode = mode.value as State["arpeggioMode"]; onChange(); }); panel.append(field("Modo de visualización", mode)); }
  if (state.module === "ds") { const distance = selectControl("double-stop", ["3", "4", "5", "7", "8", "9"], String(state.doubleStop)); distance.replaceChildren(...[["3", "3as menores"], ["4", "3as mayores"], ["5", "4as justas"], ["7", "5as justas"], ["8", "6as menores"], ["9", "6as mayores"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); distance.value = String(state.doubleStop); distance.addEventListener("change", () => { state.doubleStop = Number(distance.value); onChange(); }); panel.append(field("Intervalo", distance)); }
  if (state.module === "esc") { const system = selectControl("scale-system", ["all", "block-0", "block-1", "block-2", "block-3", "block-4", "3nps-0", "3nps-1", "3nps-2", "3nps-3", "3nps-4", "3nps-5", "3nps-6"], state.scaleSystem); system.replaceChildren(...[["all", "Mástil completo"], ["block-0", "Bloque 1"], ["block-1", "Bloque 2"], ["block-2", "Bloque 3"], ["block-3", "Bloque 4"], ["block-4", "Bloque 5"], ["3nps-0", "3NPS 1"], ["3nps-1", "3NPS 2"], ["3nps-2", "3NPS 3"], ["3nps-3", "3NPS 4"], ["3nps-4", "3NPS 5"], ["3nps-5", "3NPS 6"], ["3nps-6", "3NPS 7"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); system.value = state.scaleSystem; system.addEventListener("change", () => { state.scaleSystem = system.value as ScaleSystem; onChange(); }); panel.append(field("Sistema / posición", system)); }
  if (state.module === "caged") { const shape = selectControl("caged-shape", ["ALL", ...CAGED_SHAPES.map((item) => item.id)], state.cagedShape); shape.replaceChildren(...[{ id: "ALL", label: "Todas las formas" }, ...CAGED_SHAPES].map((item) => { const option = el("option"); option.value = item.id; option.textContent = item.label; return option; })); shape.value = state.cagedShape; shape.addEventListener("change", () => { state.cagedShape = shape.value as CagedShape; onChange(); }); panel.append(field("Forma CAGED", shape)); }
  if (state.module === "caged") { const quality = selectControl("caged-quality", Object.keys(CAGED_QUALITIES), state.cagedQuality); quality.replaceChildren(...Object.entries(CAGED_QUALITIES).map(([id, item]) => { const option = el("option"); option.value = id; option.textContent = item.label; return option; })); quality.value = state.cagedQuality; quality.addEventListener("change", () => { state.cagedQuality = quality.value as CagedQuality; onChange(); }); panel.append(field("Calidad del acorde", quality)); const layer = selectControl("caged-layer", ["chord", "pentatonic", "scale"], state.cagedLayer); layer.replaceChildren(...[["chord", "Solo acorde"], ["pentatonic", "Acorde + pentatónica"], ["scale", "Acorde + escala diatónica"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); layer.value = state.cagedLayer; layer.addEventListener("change", () => { state.cagedLayer = layer.value as CagedLayer; onChange(); }); panel.append(field("Capas", layer)); }
  const display = selectControl("display", ["notes", "intervals", "both"], state.display); display.replaceChildren(...[["notes", "Nombres"], ["intervals", "Intervalos"], ["both", "Ambos"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); display.value = state.display; display.addEventListener("change", () => { state.display = display.value as DisplayMode; onChange(); }); panel.append(field("Mostrar", display));
  const range = rangeControls(state); range.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => { const next = clampRange(Number((range.querySelector('[data-range="start"]') as HTMLInputElement).value), Number((range.querySelector('[data-range="end"]') as HTMLInputElement).value)); state.start = next.start; state.end = next.end; onChange(); })); panel.append(field("Rango de trastes", range));
  return panel;
}
function markerText(mark: FretMark, display: DisplayMode): string {
  let text = `${mark.note}\n${mark.interval}`;
  if (display === "notes") text = mark.note;
  else if (display === "intervals") text = mark.interval;
  return text;
}
function cagedBoxElement(box: CagedWindow, range: Range): HTMLElement {
  const colOffset = box.start - range.start;
  const span = box.end - box.start + 1;
  const div = el("div", `caged-box shape-${box.shape} bx-l${colOffset} bx-w${span}`);
  div.dataset.label = box.shape;
  return div;
}
function board(marks: FretMark[], range: Range, display: DisplayMode, cagedBoxes: CagedWindow[] = []): HTMLElement {
  const wrapper = el("div", "board-wrap"); const fretColumns = range.end - range.start + 1; const boardElement = el("div", `board frets-${fretColumns}`); wrapper.classList.add(`range-${fretColumns}`);
  for (let fret = range.start; fret <= range.end; fret += 1) { const number = el("div", "fret-number"); number.textContent = String(fret); boardElement.append(number); }
  cagedBoxes.forEach((box) => boardElement.append(cagedBoxElement(box, range)));
  for (let stringIndex = 0; stringIndex < STRINGS.length; stringIndex += 1) {
    const stringNumber = stringIndex + 1;
    for (let fret = range.start; fret <= range.end; fret += 1) {
      const cell = el("div", `cell string-${stringNumber}${fret === 0 ? " open" : ""}`); const mark = marks.find((candidate) => candidate.stringIndex === stringIndex && candidate.fret === fret);
      if (mark) { const note = el("span", `marker ${mark.kind}`); note.textContent = markerText(mark, display); cell.append(note); }
      else if (fret === 0) { const label2 = el("span", "open-note"); label2.textContent = STRINGS[stringIndex]; cell.append(label2); }
      boardElement.append(cell);
    }
  }
  wrapper.append(boardElement); return wrapper;
}
function renderBoard(state: State): HTMLElement {
  const range = clampRange(state.start, state.end); let marks: FretMark[];
  if (state.module === "ds") marks = findDoubleStops(state.root, state.doubleStop, range);
  else if (state.module === "arp") {
    if (state.arpeggioMode === "full") marks = findMarks(state.root, ARPEGGIOS[state.arpeggio].intervals, range);
    else marks = findVoicingMarks(state.root, ARPEGGIOS[state.arpeggio].intervals, state.arpeggioMode === "drop2-14" ? 0 : 1, range);
  }
  else if (state.module === "esc") { const scale = SCALES[state.scale]; marks = findScaleMarks(state.root, scale.intervals, state.scaleSystem, range, scale.blue); }
  else if (state.module === "caged") marks = findCagedLayerMarks(state.root, state.cagedShape, state.cagedQuality, state.cagedLayer, range);
  else marks = findVoicingMarks(state.root, [0, 4, 7], state.stringSet, range);
  const cagedBoxes = state.module === "caged" ? findCagedBoxes(state.root, state.cagedShape, range) : [];
  return board(marks, range, state.display, cagedBoxes);
}

export function mountApp(root: HTMLElement): void {
  const state: State = { module: "triadas", root: "C", scale: "mayor", scaleSystem: "all", arpeggio: "maj", arpeggioMode: "full", stringSet: 0, cagedShape: "ALL", cagedQuality: "maj", cagedLayer: "chord", display: "notes", start: 0, end: FRET_COUNT, doubleStop: 3 };
  const app = el("main"); const hero = el("header", "hero"); const eyebrow = el("div", "eyebrow"); eyebrow.textContent = "Teoría aplicada al mástil"; const title = el("h1"); title.textContent = "Diapasón"; const description = el("p"); description.textContent = "Construye mapas musicales claros para estudiar guitarra con 24 trastes."; hero.append(el("div")); hero.firstElementChild?.append(eyebrow, title, description); app.append(hero);
  const tabs = el("nav", "tabs"); tabs.setAttribute("aria-label", "Módulos de estudio"); const content = el("section", "panel"); app.append(tabs, content); root.replaceChildren(app);
  const draw = (): void => {
    content.replaceChildren(controls(state, draw));
    if (state.module === "esc") {
      const theory = el("div", "theory");
      const construction = el("span");
      construction.textContent = `Construcción: ${SCALES[state.scale].construction}`;
      const harmony = el("span");
      harmony.textContent = `Armonización: ${SCALES[state.scale].harmony}`;
      theory.append(construction, harmony);
      content.append(theory);
    }
    content.append(renderBoard(state));
    const status = el("p", "status");
    let moduleLabel = "mapa de notas";
    if (state.module === "esc") moduleLabel = SCALES[state.scale].label;
    else if (state.module === "arp") moduleLabel = ARPEGGIOS[state.arpeggio].label;
    status.textContent = `${state.root}: ${moduleLabel}.`;
    content.append(status);
  };
  MODULES.forEach(({ id, label }) => { const tab = el("button", "tab"); tab.type = "button"; tab.textContent = label; tab.setAttribute("aria-pressed", String(id === state.module)); tab.addEventListener("click", () => { state.module = id; MODULES.forEach(({ id: itemId }) => { const button = tabs.querySelector(`[data-module="${itemId}"]`); button?.classList.toggle("active", itemId === state.module); button?.setAttribute("aria-pressed", String(itemId === state.module)); }); draw(); }); tab.dataset.module = id; tabs.append(tab); });
  tabs.querySelector(".tab")?.classList.add("active"); draw();
}

