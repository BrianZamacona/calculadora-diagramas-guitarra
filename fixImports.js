const fs = require('fs');

function replaceInFile(path, replacements) {
  let content = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(path, content);
}

replaceInFile('src/cagedModule.ts', [
  [/from "\.\/data"/g, 'from "./data/data"'],
  [/from "\.\/chordEngine"/g, 'from "./utils/chordEngine"'],
  [/from "\.\/CAGEDFretboard"/g, 'from "./components/CAGEDFretboard"'],
  [/from "\.\/audio"/g, 'from "./services/audio"'],
  [/from "\.\/exportService"/g, 'from "./services/exportService"']
]);

replaceInFile('src/components/CAGEDFretboard.ts', [
  [/from "\.\/chordEngine"/g, 'from "../utils/chordEngine"']
]);

replaceInFile('src/services/audio.ts', [
  [/from "\.\/data"/g, 'from "../data/data"'],
  [/from "\.\/chordEngine"/g, 'from "../utils/chordEngine"']
]);

replaceInFile('src/services/exportService.ts', [
  [/from "\.\/chordEngine"/g, 'from "../utils/chordEngine"']
]);

replaceInFile('src/ui.ts', [
  [/from "\.\/data"/g, 'from "./data/data"'],
  [/from "\.\/domain"/g, 'from "./utils/domain"']
]);

replaceInFile('src/utils/chordEngine.ts', [
  [/from "\.\/data"/g, 'from "../data/data"'],
  [/from "\.\/domain"/g, 'from "./domain"'],
  [/from "\.\/cagedTemplates"/g, 'from "../data/cagedTemplates"']
]);

replaceInFile('src/utils/domain.ts', [
  [/from "\.\/data"/g, 'from "../data/data"']
]);

replaceInFile('src/data/cagedTemplates.ts', [
  [/from "\.\/data"/g, 'from "./data"']
]);
