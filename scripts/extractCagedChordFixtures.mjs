import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "..");
const fixtureDirectory = path.join(workspaceRoot, "tests", "fixtures", "chord-reference");
const sourceFiles = ["a", "c", "d", "e", "g"].map((key) => `acordes_de_guitarra_tonalidad_${key}.md`);
const shapes = new Set(["C", "A", "G", "E", "D"]);

function sourceRoot(filename) {
  const match = /tonalidad_([acdeg])\.md$/i.exec(filename);
  if (!match) throw new Error(`No se reconoce la tonalidad en ${filename}`);
  return match[1].toUpperCase();
}

function heading(line) {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  return match ? { level: match[1].length, text: match[2] } : undefined;
}

function qualityForHeading(text) {
  if (/\b(?:min|minor)\s*7(?:th)?\b/i.test(text)) return "min7";
  if (/\b(?:dom|dominant)\s*7(?:th)?\b/i.test(text)) return "dom7";
  if (/\b(?:major|maj)\s*7(?:th)?\b/i.test(text)) return "Maj7";
  return undefined;
}

function cagedPosition(line) {
  const content = line.trim().replace(/^#{1,6}\s*/, "").replace(/^[-*]\s*/, "").replace(/^\*\*/, "");
  const match = /^Posición\s+([CAGED])\s*\([^)]*\)\s*:?\s*\*{0,2}\s*(.*)$/i.exec(content);
  if (!match || !shapes.has(match[1].toUpperCase())) return undefined;
  return { shape: match[1].toUpperCase(), remainder: match[2] };
}

function parseFrets(text) {
  const code = /`([^`]*)`/.exec(text)?.[1];
  if (!code) return undefined;
  const tokens = code.match(/\bx\b|\d+/gi);
  if (!tokens || tokens.length !== 6) return undefined;
  return tokens.map((token) => token.toLowerCase() === "x" ? null : Number(token));
}

function extractSection(lines, startIndex, endIndex, root, quality, filename) {
  const sectionShapes = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const position = cagedPosition(lines[index]);
    if (!position) continue;

    let expectedFrets = parseFrets(position.remainder);
    if (!expectedFrets) {
      for (let cursor = index + 1; cursor < endIndex; cursor += 1) {
        if (heading(lines[cursor]) || cagedPosition(lines[cursor])) break;
        if (/tablatura/i.test(lines[cursor])) {
          expectedFrets = parseFrets(lines[cursor]);
          break;
        }
      }
    }
    if (!expectedFrets) throw new Error(`No se pudo leer la tablatura ${root} ${quality} ${position.shape} en ${filename}:${index + 1}`);
    sectionShapes.push({ root, quality, shape: position.shape, expectedFrets });
  }
  return sectionShapes;
}

async function extractFile(filename) {
  const contents = await readFile(path.join(fixtureDirectory, filename), "utf8");
  const lines = contents.split(/\r?\n/);
  const root = sourceRoot(filename);
  const fixtures = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentHeading = heading(lines[index]);
    if (!currentHeading) continue;
    const quality = qualityForHeading(currentHeading.text);
    if (!quality) continue;

    let endIndex = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const nextHeading = heading(lines[cursor]);
      if (nextHeading && nextHeading.level <= currentHeading.level) {
        endIndex = cursor;
        break;
      }
    }
    const headingIsCaged = /\bcaged(?:\s+positions)?\b/i.test(currentHeading.text);
    const sectionHasCagedLabel = lines.slice(index + 1, endIndex)
      .some((line) => /^\s*[*-]\s*\*{0,2}CAGED\*{0,2}\s*:/i.test(line));
    if (!headingIsCaged && !sectionHasCagedLabel) continue;

    const sectionFixtures = extractSection(lines, index + 1, endIndex, root, quality, filename);
    if (sectionFixtures.length !== 5 || new Set(sectionFixtures.map((item) => item.shape)).size !== 5) {
      throw new Error(`Se esperaban las cinco formas CAGED en ${filename}: ${currentHeading.text}`);
    }
    fixtures.push(...sectionFixtures);
    index = endIndex - 1;
  }
  return fixtures;
}

const fixtures = (await Promise.all(sourceFiles.map(extractFile))).flat();
const expectedRoots = new Set(sourceFiles.map(sourceRoot));
if (new Set(fixtures.map((fixture) => fixture.root)).size !== expectedRoots.size) {
  const missingRoots = [...expectedRoots].filter((root) => !fixtures.some((fixture) => fixture.root === root));
  throw new Error(`No se extrajeron fixtures para: ${missingRoots.join(", ") || "raíz desconocida"}`);
}

const outputPath = path.join(fixtureDirectory, "caged-positions.json");
await writeFile(outputPath, `${JSON.stringify(fixtures, null, 2)}\n`, "utf8");

const counts = new Map();
fixtures.forEach((fixture) => {
  const rootCounts = counts.get(fixture.root) ?? new Map();
  rootCounts.set(fixture.quality, (rootCounts.get(fixture.quality) ?? 0) + 1);
  counts.set(fixture.root, rootCounts);
});
const countsByRoot = Object.fromEntries([...counts].map(([root, rootCounts]) => [root, Object.fromEntries(rootCounts)]));
console.log(JSON.stringify({ total: fixtures.length, countsByRoot, outputPath: path.relative(workspaceRoot, outputPath) }, null, 2));
