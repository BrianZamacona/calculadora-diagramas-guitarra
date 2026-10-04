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
  const trimmed = line.trim();
  let level = 0;
  while (level < trimmed.length && trimmed[level] === "#") level += 1;
  if (level === 0 || level > 6 || !/\s/.test(trimmed[level] ?? "")) return undefined;
  const text = trimmed.slice(level).trim();
  return text.length > 0 ? { level, text } : undefined;
}

function qualityForHeading(text) {
  if (/\b(?:min|minor)\s*7(?:th)?\b/i.test(text)) return "min7";
  if (/\b(?:dom|dominant)\s*7(?:th)?\b/i.test(text)) return "dom7";
  if (/\b(?:major|maj)\s*7(?:th)?\b/i.test(text)) return "Maj7";
  return undefined;
}

function cagedPosition(line) {
  let content = heading(line)?.text ?? line.trim();
  if (content.startsWith("*") || content.startsWith("-")) content = content.slice(1).trimStart();
  while (content.startsWith("**")) content = content.slice(2).trimStart();
  const prefix = "Posición ";
  if (!content.toLowerCase().startsWith(prefix.toLowerCase())) return undefined;
  const shape = content[prefix.length]?.toUpperCase();
  if (!shape || !shapes.has(shape)) return undefined;
  const afterShape = content.slice(prefix.length + 1);
  if (afterShape.length > 0 && !/\s/.test(afterShape[0])) return undefined;
  const positionDetails = afterShape.trimStart();
  if (!positionDetails.startsWith("(")) return undefined;
  const closingParenthesis = positionDetails.indexOf(")");
  if (closingParenthesis < 0) return undefined;
  let remainder = positionDetails.slice(closingParenthesis + 1).trimStart();
  if (remainder.startsWith(":")) remainder = remainder.slice(1).trimStart();
  while (remainder.startsWith("**")) remainder = remainder.slice(2).trimStart();
  return { shape, remainder };
}

function parseFrets(text) {
  const backtickStart = text.indexOf("`");
  const bracketStart = text.indexOf("[");
  const delimiterStart = backtickStart >= 0 ? backtickStart : bracketStart;
  if (delimiterStart < 0) return undefined;
  const delimiter = backtickStart >= 0 ? "`" : "]";
  const contentStart = delimiterStart + 1;
  const delimiterEnd = text.indexOf(delimiter, contentStart);
  if (delimiterEnd < 0) return undefined;
  const fretText = text.slice(contentStart, delimiterEnd).replaceAll("[", "").replaceAll("]", "");
  const tokens = fretText.split(/[\s,-]+/).filter(Boolean);
  if (tokens?.length !== 6 || tokens.some((token) => token.toLowerCase() !== "x" && !/^\d+$/.test(token))) return undefined;
  return tokens.map((token) => token.toLowerCase() === "x" ? null : Number(token));
}

function followingTablature(lines, startIndex, endIndex) {
  for (let cursor = startIndex; cursor < endIndex; cursor += 1) {
    if (heading(lines[cursor]) || cagedPosition(lines[cursor])) return undefined;
    if (lines[cursor].toLowerCase().includes("tablatura")) return parseFrets(lines[cursor]);
  }
  return undefined;
}

function fretsForPosition(lines, index, endIndex, position) {
  return parseFrets(position.remainder) ?? followingTablature(lines, index + 1, endIndex);
}

function extractSection(lines, startIndex, endIndex, root, quality, filename) {
  const sectionShapes = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const position = cagedPosition(lines[index]);
    if (!position) continue;
    const expectedFrets = fretsForPosition(lines, index, endIndex, position);
    if (!expectedFrets) throw new Error(`No se pudo leer la tablatura ${root} ${quality} ${position.shape} en ${filename}:${index + 1}`);
    sectionShapes.push({ root, quality, shape: position.shape, expectedFrets });
  }
  return sectionShapes;
}

function sectionEndIndex(lines, startIndex, level) {
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    const nextHeading = heading(lines[cursor]);
    if (nextHeading && nextHeading.level <= level) return cursor;
  }
  return lines.length;
}

function isCagedLabel(line) {
  let content = line.trim();
  if (content.startsWith("*") || content.startsWith("-")) content = content.slice(1).trimStart();
  const normalized = content.replaceAll("*", "").trim().toLowerCase();
  return normalized === "caged:" || normalized === "caged";
}

function hasCagedPositions(lines, startIndex, endIndex, title) {
  if (title.toLowerCase().includes("caged")) return true;
  return lines.slice(startIndex, endIndex).some(isCagedLabel);
}

function validateCagedSection(sectionFixtures, filename, title) {
  const uniqueShapes = new Set(sectionFixtures.map((fixture) => fixture.shape));
  if (sectionFixtures.length !== 5 || uniqueShapes.size !== 5) {
    throw new Error(`Se esperaban las cinco formas CAGED en ${filename}: ${title}`);
  }
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
    const endIndex = sectionEndIndex(lines, index, currentHeading.level);
    if (!hasCagedPositions(lines, index + 1, endIndex, currentHeading.text)) continue;
    const sectionFixtures = extractSection(lines, index + 1, endIndex, root, quality, filename);
    validateCagedSection(sectionFixtures, filename, currentHeading.text);
    fixtures.push(...sectionFixtures);
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
