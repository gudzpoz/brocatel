import { test } from 'vitest';

import BrocatelCompiler from '../src/main';

test('BrocatelCompiler.compile', async () => {
  await new BrocatelCompiler({}).compile(`
  text

  \`cond\` test

  [](test)
  `);
});
