import { assert, test } from 'vitest';
import { Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { directiveForMarkdown, directiveToMarkdown } from '@brocatel/md';

import expandMacro from '../src/expander';

const parser = unified()
  .use(remarkParse)
  .use(directiveForMarkdown)
  .use(expandMacro);

async function assertMatch(input: string, expectedOutput: string) {
  const vfile = new VFile();
  const ast = await parser.run(parser.parse(input), vfile) as Root;
  assert.isEmpty(vfile.messages, vfile.messages.map((m) => m.message).join(', '));
  assert.equal(
    toMarkdown(ast, {
      extensions: [directiveToMarkdown],
    }).trim(),
    expectedOutput.trim(),
  );
}

test('Expand list', async () => {
  await assertMatch('- a\n- b', ':::do`FUNC.S_ONCE`\n\n* a\n* b');
});

test('Expand code', async () => {
  await assertMatch('`a`', '```lua\na\n```');
});

test('Expand conditional', async () => {
  assertMatch('`a` _**b**_', ':::if`a`\n\n* ***b***');
  assertMatch('`a` `b` c', ':::if`a`\n\n* :::if`b`\n\n  * c');
});

test('Expand macro', async () => {
  await assertMatch(':::loop\n- a', `
:::local

* # \\\\#loop-1

* :::local

  * a

* [](\\\\#loop-1)
  `);

  await assertMatch(':::switch`a = 0`\n- `a == 1`\n\n  ok\n- `a == 0`\n\n  ok', `
:::do

\`\`\`lua func
a = 0
if(
a == 1
)then return IP:set(args:resolve(2))end
if(
a == 0
)then return IP:set(args:resolve(3))end
\`\`\`

* ok

* ok
  `);
});
