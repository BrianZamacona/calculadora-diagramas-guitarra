import { ARPEGGIOS, CHORD_CATEGORIES, CHORD_GLOSSARY, CAGED_QUALITIES, CAGED_SHAPES, FRET_COUNT, NOTES, SCALES, STRINGS, type ArpeggioId, type CagedLayer, type CagedQuality, type CagedShape, type ModuleId, type ScaleId } from "./data";
import { buildChord, clampRange, findChordVoicings, findCagedBoxes, findCagedLayerMarks, findDoubleStops, findMarks, findScaleMarks, findVoicingMarks, noteAt, suggestNoteSets, type ChordBase, type ChordBuilderState, type ChordVoicing, type CagedWindow, type FretMark, type Range, type ScaleSystem } from "./domain";

type DisplayMode = "notes" | "intervals" | "both";
interface State { module: ModuleId; root: string; scale: ScaleId; scaleSystem: ScaleSystem; arpeggio: ArpeggioId; arpeggioMode: "full" | "drop2-14" | "drop2-25"; stringSet: number; cagedShape: CagedShape; cagedQuality: CagedQuality; cagedLayer: CagedLayer; display: DisplayMode; start: number; end: number; doubleStop: number; chordCategory: string; searchQuery: string; searchCategory: string; searchNotes: string[]; chordBuilder: ChordBuilderState; }

const MODULES: Array<{ id: ModuleId; label: string }> = [
  { id: "acordes", label: "Acordes" }, { id: "glosario", label: "Glosario" }, { id: "buscador", label: "Buscador" }, { id: "triadas", label: "Tríadas" }, { id: "arp", label: "Arpegios" }, { id: "esc", label: "Escalas" }, { id: "ds", label: "Double stops" }, { id: "caged", label: "CAGED" },
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
function isPentatonicOrBlues(scale: ScaleId): boolean {
  return scale.includes("pent") || scale.includes("blues");
}
function scaleSystemOptions(scale: ScaleId): Array<[string, string]> {
  const options: Array<[string, string]> = [["all", "Mástil completo"]];
  if (isPentatonicOrBlues(scale)) {
    options.push(...Array.from({ length: 5 }, (_, index) => [`block-${index}`, `Posición ${index + 1}`] as [string, string]));
  } else {
    options.push(...Array.from({ length: 5 }, (_, index) => [`block-${index}`, `Bloque ${index + 1}`] as [string, string]));
    options.push(...Array.from({ length: 7 }, (_, index) => [`3nps-${index}`, `3NPS ${index + 1}`] as [string, string]));
    options.push(...Array.from({ length: 7 }, (_, index) => [`4nps-${index}`, `4NPS ${index + 1}`] as [string, string]));
  }
  return options;
}
function rangeControls(state: State): HTMLElement {
  const wrapper = el("div", "range"); const start = el("input"); start.type = "number"; start.min = "0"; start.max = String(FRET_COUNT - 3); start.value = String(state.start); start.dataset.range = "start";
  const separator = el("span"); separator.textContent = "a"; const end = el("input"); end.type = "number"; end.min = "3"; end.max = String(FRET_COUNT); end.value = String(state.end); end.dataset.range = "end"; wrapper.append(start, separator, end); return wrapper;
}
function glossaryCard(entry: (typeof CHORD_GLOSSARY)[number]): HTMLElement {
  const card = el("article", "chord-card");
  const heading = el("div", "chord-card-heading");
  const title = el("h3"); title.textContent = entry.name;
  const symbol = el("strong", "chord-symbol"); symbol.textContent = entry.symbol;
  heading.append(title, symbol);
  const tags = el("div", "chord-tags");
  [entry.family, entry.voicing, entry.level].forEach((tag) => { const item = el("span", "chord-tag"); item.textContent = tag; tags.append(item); });
  const formula = el("p", "chord-formula"); formula.textContent = `Fórmula: ${entry.formula}`;
  const intervals = el("p", "chord-intervals"); intervals.textContent = `Intervalos desde la raíz: ${entry.intervals.join(" - ")} semitonos`;
  const description = el("p", "chord-description"); description.textContent = entry.description;
  card.append(heading, tags, formula, intervals, description);
  return card;
}
function chordCatalogView(state: State, onChange: () => void): HTMLElement {
  const section = el("section", "catalog-view");
  const intro = el("div", "section-intro"); const title = el("h2"); title.textContent = "Glosario de acordes"; const copy = el("p"); copy.textContent = "Consulta cómo se construye cada acorde y en qué contexto suele aparecer."; intro.append(title, copy);
  const category = selectControl("chord-category", CHORD_CATEGORIES, state.chordCategory); category.addEventListener("change", () => { state.chordCategory = category.value; onChange(); });
  const filter = el("div", "catalog-filter"); filter.append(field("Filtrar por familia", category)); section.append(intro, filter);
  const entries = state.chordCategory === "Todos" ? CHORD_GLOSSARY : CHORD_GLOSSARY.filter((entry) => entry.category === state.chordCategory);
  const grid = el("div", "chord-grid"); entries.forEach((entry) => grid.append(glossaryCard(entry))); section.append(grid);
  return section;
}
function searchView(state: State, onChange: () => void): HTMLElement {
  const section = el("section", "catalog-view search-view");
  const intro = el("div", "section-intro"); const title = el("h2"); title.textContent = "Buscador en el diapasón"; const copy = el("p"); copy.textContent = "Selecciona notas directamente en el mástil y descubre escalas, acordes y arpegios compatibles."; intro.append(title, copy); section.append(intro);
  const actions = el("div", "search-actions"); const all = el("button", "search-action"); all.type = "button"; all.textContent = "Todas las notas"; all.addEventListener("click", () => { state.searchNotes = [...NOTES]; onChange(); }); const clear = el("button", "search-action"); clear.type = "button"; clear.textContent = "Limpiar diapasón"; clear.addEventListener("click", () => { state.searchNotes = []; onChange(); }); actions.append(all, clear); section.append(actions);
  const selected = new Set(state.searchNotes); const boardElement = el("div", "search-fretboard");
  for (let fret = 0; fret <= 24; fret += 1) { const number = el("span", "search-fret-number"); number.textContent = String(fret); boardElement.append(number); }
  for (let stringIndex = 0; stringIndex < STRINGS.length; stringIndex += 1) for (let fret = 0; fret <= 24; fret += 1) { const note = noteAt(stringIndex, fret); const button = el("button", `search-fret ${selected.has(note) ? "selected" : ""}`); button.type = "button"; button.title = `${note}, cuerda ${STRINGS[stringIndex]}, traste ${fret}`; button.setAttribute("aria-label", button.title); button.addEventListener("click", () => { state.searchNotes = selected.has(note) ? state.searchNotes.filter((candidate) => candidate !== note) : [...state.searchNotes, note]; onChange(); }); const label = el("span"); label.textContent = selected.has(note) ? note : ""; button.append(label); boardElement.append(button); }
  section.append(boardElement);
  const selectedLabel = el("p", "search-count"); selectedLabel.textContent = state.searchNotes.length === 12 ? "12 notas seleccionadas · escala cromática" : `${state.searchNotes.length} nota${state.searchNotes.length === 1 ? "" : "s"} seleccionada${state.searchNotes.length === 1 ? "" : "s"}`; section.append(selectedLabel);
  const suggestionTitle = el("h3", "suggestions-title"); suggestionTitle.textContent = "Sugerencias"; section.append(suggestionTitle);
  const suggestions = el("div", "suggestions-grid"); if (state.searchNotes.length === 12) { const chromatic = el("article", "suggestion exact"); chromatic.textContent = "Escala cromática · cualquier raíz"; suggestions.append(chromatic); } else suggestNoteSets(state.searchNotes).forEach((suggestion) => { const card = el("article", `suggestion ${suggestion.exact ? "exact" : "near"}`); const name = el("strong"); name.textContent = `${suggestion.root} ${suggestion.name}`; const detail = el("span"); detail.textContent = suggestion.exact ? "Coincidencia exacta" : `${suggestion.matched} coinciden · faltan ${suggestion.missing} · sobran ${suggestion.extra}`; card.append(name, detail); suggestions.append(card); });
  if (state.searchNotes.length === 0) { const empty = el("p", "empty-state"); empty.textContent = "Selecciona una o más notas en el diapasón."; suggestions.append(empty); }
  section.append(suggestions); return section;
}
function checkboxGroup(labelText: string, values: readonly string[], selected: readonly string[], onChange: (values: string[]) => void): HTMLElement {
  const group = el("fieldset", "checkbox-group"); const legend = el("legend"); legend.textContent = labelText; group.append(legend);
  values.forEach((value) => { const label = el("label", "checkbox-option"); const input = el("input"); input.type = "checkbox"; input.value = value; input.checked = selected.includes(value); input.addEventListener("change", () => { const checked = Array.from(group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((candidate) => candidate.checked).map((candidate) => candidate.value); onChange(checked); }); const text = el("span"); text.textContent = value; label.append(input, text); group.append(label); });
  return group;
}
function choiceGroup(labelText: string, values: readonly [string, string][], selected: string, onChange: (value: string) => void): HTMLElement {
  const group = el("fieldset", "choice-group"); const legend = el("legend"); legend.textContent = labelText; group.append(legend);
  values.forEach(([value, labelTextValue]) => { const label = el("label", "choice-option"); const input = el("input"); input.type = "radio"; input.name = `choice-${labelText}`; input.value = value; input.checked = value === selected; input.addEventListener("change", () => onChange(value)); const text = el("span"); text.textContent = labelTextValue; label.append(input, text); group.append(label); });
  return group;
}
function fingeringDiagram(fingering: ChordVoicing, root: string): HTMLElement {
  const card = el("article", "chord-diagram-card"); const title = el("h3"); title.textContent = fingering.baseFret > 1 ? `${fingering.title} · traste ${fingering.baseFret}` : fingering.title; card.append(title);
  const frets = fingering.fretPositions; const maxFret = Math.max(1, ...frets.filter((fret): fret is number => typeof fret === "number")); const minFret = fingering.baseFret > 1 ? fingering.baseFret : 1; const diagram = el("div", "fingering-diagram"); diagram.style.gridTemplateColumns = "repeat(6, 34px)";
  frets.forEach((fret) => { const marker = el("span", "fingering-open"); marker.textContent = fret === -1 ? "x" : fret === 0 ? "o" : ""; diagram.append(marker); });
  for (let fret = minFret; fret <= Math.max(minFret + 3, maxFret); fret += 1) for (let stringIndex = 0; stringIndex < 6; stringIndex += 1) { const cell = el("div", "fingering-cell"); if (frets[stringIndex] === fret) { const dot = el("span", `diagram-note ${noteAt(stringIndex, fret) === root ? "root" : ""}`); dot.textContent = String(fingering.fingerPositions[stringIndex] || ""); dot.setAttribute("aria-label", `${noteAt(stringIndex, fret)}, dedo ${fingering.fingerPositions[stringIndex]}`); cell.append(dot); } diagram.append(cell); }
  card.append(diagram); return card;
}
function chordBuilderView(state: State, onChange: () => void): HTMLElement {
  const section = el("section", "catalog-view chord-builder-view");
  const intro = el("div", "section-intro"); const title = el("h2"); title.textContent = "Constructor de acordes"; const copy = el("p"); copy.textContent = "Combina capas armónicas y obtén el cifrado, las notas y los intervalos resultantes."; intro.append(title, copy); section.append(intro);
  const builder = state.chordBuilder; const controlsPanel = el("div", "builder-controls");
  const root = choiceGroup("Fundamental", NOTES.map((note) => [note, note] as [string, string]), builder.root, (value) => { builder.root = value; onChange(); });
  const base = choiceGroup("Tríada base", [["major", "Mayor"], ["minor", "Menor"], ["sus2", "Sus2"], ["sus4", "Sus4"], ["aug", "Aumentado"], ["dim", "Disminuido"]], builder.base, (value) => { builder.base = value as ChordBase; onChange(); });
  const bass = choiceGroup("Bajo / inversión", [["none", "Sin bajo"], ...NOTES.map((note) => [note, note] as [string, string])], builder.bass ?? "none", (value) => { builder.bass = value === "none" ? undefined : value; onChange(); });
  const fifth = choiceGroup("Alteración de quinta", [["none", "Sin cambio"], ["b5", "b5"], ["5", "5"], ["#5", "#5"]], builder.fifth, (value) => { builder.fifth = value as ChordBuilderState["fifth"]; onChange(); });
  const seventh = choiceGroup("Sexta / séptima", [["none", "Ninguna"], ["6", "6"], ["7", "7 menor"], ["7M", "7 mayor"]], builder.seventh, (value) => { builder.seventh = value as ChordBuilderState["seventh"]; onChange(); });
  const extensions = checkboxGroup("Tensiones", ["b9", "9", "#9", "b11", "11", "#11", "b13", "13", "#13"], builder.extensions, (values) => { builder.extensions = values as ChordBuilderState["extensions"]; onChange(); });
  const additions = checkboxGroup("Adiciones", ["add2", "add4", "add6", "add9", "add11", "add13"], builder.additions, (values) => { builder.additions = values as ChordBuilderState["additions"]; onChange(); });
  controlsPanel.append(root, base, bass, fifth, seventh, extensions, additions); section.append(controlsPanel);
  const result = buildChord(builder); const resultPanel = el("div", "builder-result"); const resultTitle = el("p", "result-label"); resultTitle.textContent = "Cifrado resultante"; const name = el("strong", "result-name"); name.textContent = result.name || "Acorde no válido"; const notes = el("p"); notes.textContent = `Notas: ${result.notes.join(" - ") || "-"}`; const intervals = el("p"); intervals.textContent = `Intervalos absolutos: ${result.intervals.join(" - ") || "-"}`; resultPanel.append(resultTitle, name, notes, intervals); section.append(resultPanel);
  if (result.intervals.length > 0) { const diagrams = el("div", "chord-diagrams"); findChordVoicings(builder).forEach((fingering) => diagrams.append(fingeringDiagram(fingering, builder.root))); section.append(diagrams); }
  return section;
}
function controls(state: State, onChange: () => void): HTMLElement {
  const panel = el("div", "panel controls");
  if (state.module !== "acordes" && state.module !== "buscador") { const root = selectControl("root", NOTES, state.root); root.addEventListener("change", () => { state.root = root.value; onChange(); }); panel.append(field("Nota raíz", root)); }
  if (state.module === "triadas") { const strings = selectControl("string-set", ["0", "1", "2", "3"], String(state.stringSet)); strings.replaceChildren(...["Cuerdas 1-2-3", "Cuerdas 2-3-4", "Cuerdas 3-4-5", "Cuerdas 4-5-6"].map((label, index) => { const option = el("option"); option.value = String(index); option.textContent = label; return option; })); strings.value = String(state.stringSet); strings.addEventListener("change", () => { state.stringSet = Number(strings.value); onChange(); }); panel.append(field("Juego de cuerdas", strings)); }
  if (state.module === "esc") { const scale = selectControl("scale", Object.keys(SCALES), state.scale); scale.replaceChildren(...SCALE_GROUPS.map(([groupLabel, ids]) => { const group = document.createElement("optgroup"); group.label = groupLabel; group.append(...ids.map((id) => { const option = el("option"); option.value = id; option.textContent = SCALES[id].label; return option; })); return group; })); scale.value = state.scale; scale.addEventListener("change", () => { state.scale = scale.value as ScaleId; onChange(); }); panel.append(field("Escala / modo", scale)); }
  if (state.module === "arp") { const arp = selectControl("arpeggio", Object.keys(ARPEGGIOS), state.arpeggio); arp.replaceChildren(...Object.entries(ARPEGGIOS).map(([id, item]) => { const option = el("option"); option.value = id; option.textContent = item.label; return option; })); arp.value = state.arpeggio; arp.addEventListener("change", () => { state.arpeggio = arp.value as ArpeggioId; onChange(); }); panel.append(field("Tipo de arpegio", arp)); const mode = selectControl("arpeggio-mode", ["full", "drop2-14", "drop2-25"], state.arpeggioMode); mode.replaceChildren(...[["full", "Arpegio completo"], ["drop2-14", "Drop 2: cuerdas 1-4"], ["drop2-25", "Drop 2: cuerdas 2-5"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); mode.value = state.arpeggioMode; mode.addEventListener("change", () => { state.arpeggioMode = mode.value as State["arpeggioMode"]; onChange(); }); panel.append(field("Modo de visualización", mode)); }
  if (state.module === "ds") { const distance = selectControl("double-stop", ["3", "4", "5", "7", "8", "9"], String(state.doubleStop)); distance.replaceChildren(...[["3", "3as menores"], ["4", "3as mayores"], ["5", "4as justas"], ["7", "5as justas"], ["8", "6as menores"], ["9", "6as mayores"]].map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); distance.value = String(state.doubleStop); distance.addEventListener("change", () => { state.doubleStop = Number(distance.value); onChange(); }); panel.append(field("Intervalo", distance)); }
  if (state.module === "esc") { const options = scaleSystemOptions(state.scale); const validSystem = options.some(([value]) => value === state.scaleSystem) ? state.scaleSystem : "all"; state.scaleSystem = validSystem; const system = selectControl("scale-system", options.map(([value]) => value), validSystem); system.replaceChildren(...options.map(([value, label]) => { const option = el("option"); option.value = value; option.textContent = label; return option; })); system.value = validSystem; system.addEventListener("change", () => { state.scaleSystem = system.value as ScaleSystem; onChange(); }); panel.append(field("Sistema / posición", system)); }
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
      const inlay = [3, 5, 7, 9].includes(fret) && (stringIndex === 2 || stringIndex === 3) ? " inlay-single" : fret === 12 && (stringIndex === 1 || stringIndex === 2 || stringIndex === 3 || stringIndex === 4) ? " inlay-double" : "";
      const cell = el("div", `cell string-${stringNumber}${fret === 0 ? " open" : ""}${inlay}`); const mark = marks.find((candidate) => candidate.stringIndex === stringIndex && candidate.fret === fret);
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
  const state: State = { module: "acordes", root: "C", scale: "mayor", scaleSystem: "all", arpeggio: "Maj", arpeggioMode: "full", stringSet: 0, cagedShape: "ALL", cagedQuality: "Maj", cagedLayer: "chord", display: "notes", start: 0, end: FRET_COUNT, doubleStop: 3, chordCategory: "Todos", searchQuery: "", searchCategory: "Todos", searchNotes: [], chordBuilder: { root: "C", base: "major", bass: undefined, fifth: "5", seventh: "none", extensions: [], additions: [] } };
  const app = el("main"); const hero = el("header", "hero"); const eyebrow = el("div", "eyebrow"); eyebrow.textContent = "Teoría aplicada al mástil"; const title = el("h1"); title.textContent = "Diapasón"; const description = el("p"); description.textContent = "Construye mapas musicales claros para estudiar guitarra con 24 trastes."; hero.append(el("div")); hero.firstElementChild?.append(eyebrow, title, description); app.append(hero);
  const tabs = el("nav", "tabs"); tabs.setAttribute("aria-label", "Módulos de estudio"); const content = el("section", "panel"); app.append(tabs, content); root.replaceChildren(app);
  const draw = (): void => {
    content.replaceChildren();
    if (state.module === "acordes") { content.append(chordBuilderView(state, draw)); return; }
    if (state.module === "glosario") { content.append(chordCatalogView(state, draw)); return; }
    if (state.module === "buscador") { content.append(searchView(state, draw)); return; }
    content.append(controls(state, draw));
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

