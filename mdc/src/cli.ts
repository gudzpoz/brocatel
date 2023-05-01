import { promises as fs } from 'fs';

import BrocatelCompiler from '.';

const compiler = new BrocatelCompiler({});
const file = process.argv[2];
compiler.compileAll(file, async (f) => {
  const buffer = await fs.readFile(f);
  return buffer.toString();
}).then((output) => {
  let out;
  if (file.toLowerCase().endsWith('.md')) {
    out = `${file.substring(0, file.length - 3)}.lua`;
  } else {
    out = `${file}.lua`;
  }
  fs.writeFile(out, output);
});
