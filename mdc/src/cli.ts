import { promises as fs } from 'fs';
import path from 'path';
import { VFile } from 'vfile';

import { BrocatelCompiler } from '.';

/* eslint-disable no-console */
function displayWarnings(input: string, vfile: VFile) {
  const lines = vfile.toString().split('\n');
  vfile.messages.forEach((m) => {
    console.warn(input, m.message);
    const p = m.position;
    if (p && p.start.line) {
      console.log('', `Line ${p.start.line}, Column ${p.start.column}`);
      const line = lines[Math.max(p.start.line - 1, 0)];
      console.log('', line);
      const indent = Math.max(p.start.column - 1, 0);
      if (p.start.line === p.end.line) {
        console.log('', `${' '.repeat(indent)}${'^'.repeat(Math.max(p.end.column - p.start.column + 1, 0))}`);
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
  Object
    .entries(output.data.input as { [f: string]: VFile })
    .forEach(([f, vfile]) => displayWarnings(path.join(dir, `${f}.md`), vfile));
});
