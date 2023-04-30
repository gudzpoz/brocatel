import { assert, test } from 'vitest';

import BrocatelCompiler from '../src/main';

const compiler = new BrocatelCompiler({});

async function assertThrows(func: () => Promise<any>, ...messages: string[]) {
  try {
    await func();
  } catch (e) {
    messages.forEach((msg) => assert.include((e as Error).message, msg));
    return;
  }
  assert.fail('no exception was thrown');
}

test('Simplest plain text', async () => {
  assert.equal(await compiler.compileToString('hello'), '{{},"hello"}');
  assert.equal(await compiler.compileToString('hello\nhello'), '{{},"hello\\nhello"}');
  assert.equal(await compiler.compileToString('hello\n\nhello'), '{{},"hello","hello"}');
});

test('Tagged text', async () => {
  assert.equal(
    await compiler.compileToString('[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e"}}',
  );
  assert.equal(
    await compiler.compileToString('\\[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e"}}',
  );
  assert.equal(
    await compiler.compileToString('\\\\[a] [b] c [d] e'),
    '{{},"\\\\[a] \\\\[b] c \\\\[d] e"}',
  );
});

test('Text with values', async () => {
  await assertThrows(() => compiler.compileToString('The {} Names of God'), 'unexpected symbol');
  assert.equal(
    await compiler.compileToString('The {count} Names of God'),
    '{{},{text="The {v1} Names of God",values={v1=function()return(\ncount\n)end}}}',
  );
  assert.equal(
    await compiler.compileToString('The {count?} Names of God'),
    '{{},{plural="v1",text="The {v1} Names of God",values={v1=function()return(\ncount\n)end}}}',
  );
});

test('Headings', async () => {
  assert.equal(await compiler.compileToString('# Heading 1'), '{{labels={["Heading 1"]={2}}},{{}}}');
  assert.equal(
    await compiler.compileToString('# A\n## B\n### C\n### D\n## E\n# F'),
    `
    {
      {labels={
        ["A"]={2},
        ["F"]={3}
      }},
      {               -- A
        {labels={
          ["B"]={2},
          ["E"]={3}
        }},
        {             -- B
          {labels={
            ["C"]={2},
            ["D"]={3}
          }},
          {{}},       -- C
          {{}}        -- D
        },
        {{}}          -- E
      },
      {{}}            -- F
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
});

test('Links', async () => {
  await assertThrows(() => compiler.compileToString('[](A)'), 'link not found: A');
  assert.equal(await compiler.compileToString('[](A)\n# A'), '{{labels={["A"]={3}}},{link={3}},{{}}}');
  assert.equal(
    await compiler.compileToString('# A\n## B\n### C\n#### D\n[](E|F)\n##### E\n###### F'),
    `{
      {labels={["A"]={2}}},
      {
        {labels={["B"]={2}}},
        {
          {labels={["C"]={2}}},
          {
            {labels={["D"]={2}}},
            {
              {labels={["E"]={3}}},
              {link={2,2,2,2,3,2}},
              {
                {labels={["F"]={2}}},
                {{}}
              }
            }
          }
        }
      }
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
});

test('Lists', async () => {
  assert.equal(await compiler.compileToString('- a\n- b'), '{{},{select={{{},"a"},{{},"b"}}}}');
  assert.equal(
    await compiler.compileToString('- # A\n- [](A)'),
    `{
      {labels={["A"]={2,"select",1,2}}},
      {select={
        {{},{{}}},
        {{},{link={2,"select",1,2}}}}
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    await compiler.compileToString('- `some` some\n- else'),
    '{{},{select={{{},{function()return(\nsome\n)end,{{},"some"}}},{{},"else"}}}}',
  );
});

test('Code blocks', async () => {
  await assertThrows(() => compiler.compileToString('```js\nconsole\n```\n'), 'unsupported code block type');
  await assertThrows(() => compiler.compileToString('```lua\n(\n```\n'), 'unexpected symbol near <eof>');
  assert.equal(
    await compiler.compileToString('```lua\nprint()\n```\n'),
    '{{},{func=function(args)\nprint()\nend}}',
  );
});
