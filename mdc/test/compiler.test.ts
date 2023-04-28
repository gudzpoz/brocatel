import { assert, test } from 'vitest';

import BrocatelCompiler from '../src/main';

const compiler = new BrocatelCompiler({});

test('Simplest plain text', async () => {
  assert.equal(await compiler.compile('hello'), '{{},"hello"}');
  assert.equal(await compiler.compile('hello\nhello'), '{{},"hello\\nhello"}');
  assert.equal(await compiler.compile('hello\n\nhello'), '{{},"hello","hello"}');
});

test('Tagged text', async () => {
  assert.equal(
    await compiler.compile('[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e",type="text"}}',
  );
  assert.equal(
    await compiler.compile('\\[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e",type="text"}}',
  );
  assert.equal(
    await compiler.compile('\\\\[a] [b] c [d] e'),
    '{{},"\\\\[a] \\\\[b] c \\\\[d] e"}',
  );
});

test('Text with values', async () => {
  assert.equal(
    await compiler.compile('The {count} Names of God'),
    '{{},{text="The {v1} Names of God",type="text",values={v1=function()return(\ncount\n)end}}}',
  );
  assert.equal(
    await compiler.compile('The {count?} Names of God'),
    '{{},{plural="v1",text="The {v1} Names of God",type="text",values={v1=function()return(\ncount\n)end}}}',
  );
});

test('Headings', async () => {
  assert.equal(await compiler.compile('# Heading 1'), '{{labels={["Heading 1"]={2}}},{{}}}');
  assert.equal(
    await compiler.compile('# A\n## B\n### C\n### D\n## E\n# F'),
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
  assert.equal(await compiler.compile('[](A)\n# A'), '{{labels={["A"]={3}}},{link={3},type="link"},{{}}}');
  assert.equal(
    await compiler.compile('# A\n## B\n### C\n#### D\n[](E|F)\n##### E\n###### F'),
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
              {link={2,2,2,2,3,2},type="link"},
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
