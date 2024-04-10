import { promises as fs } from 'fs';
import path from 'path';
import { VFile } from 'vfile';

import { BrocatelCompiler } from '.';
import { getRootData } from './debug';
import { point2Position } from './utils';

/* eslint-disable no-console */
function displayWarnings(input: string, vfile: VFile) {
  const lines = vfile.toString().split('\n');
  vfile.messages.forEach((m) => {
    console.warn(input, m.message);
    const p = m.place;
    if (p) {
      const { start, end } = point2Position(p)!;
      console.log('', `Line ${start.line}, Column ${start.column}`);
      const line = lines[Math.max(start.line - 1, 0)];
      console.log('', line);
      const indent = Math.max(start.column - 1, 0);
      if (start.line === end.line) {
        console.log('', `${' '.repeat(indent)}${'^'.repeat(Math.max(end.column - start.column + 1, 0))}`);
      } else {
        console.log('', `${' '.repeat(indent)}^`);
      }
    }
  });
}
/* eslint-enable no-console */

const compiler = new BrocatelCompiler({});
const file = process.argv[2];
const dir = path.dirname(file);
const filename = path.basename(file);
compiler.compileAll(filename, async (f) => {
  const buffer = await fs.readFile(path.join(dir, `${f}.md`));
  return buffer.toString();
}).then((output) => {
  fs.writeFile(path.join(dir, output.path), output.value);
  const gettextOutput = getRootData(output).gettext ?? new VFile();
  fs.writeFile(path.join(dir, gettextOutput.path), gettextOutput.value);
  Object
    .entries(getRootData(output).inputs ?? {})
    .forEach(([f, vfile]) => displayWarnings(path.join(dir, `${f}.md`), vfile));
});
