import { assert, test } from 'vitest';

import BrocatelCompiler from '../src';

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
  assert.equal(await compiler.compileToString('hello\nhello'), '{{},"hello","hello"}');
  assert.equal(await compiler.compileToString('hello\n\nhello'), '{{},"hello","hello"}');
  assert.equal(
    await compiler.compileToString('`true` True.\n`a = 1`'),
    '{{},{function()return(\ntrue\n)end,{{},"True."}},{function()\na = 1\nend}}',
  );
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
  assert.equal(await compiler.compileToString('# Heading 1'), '{{labels={["Heading 1"]={2}}},{{label="Heading 1"}}}');
  assert.equal(
    await compiler.compileToString('# A\n## B\n### C\n### D\n## E\n# F'),
    `
    {
      {labels={
        A={2},
        F={3}
      }},
      {
        {label="A",labels={
          B={2},
          E={3}
        }},
        {
          {label="B",labels={
            C={2},
            D={3}
          }},
          {{label="C"}},
          {{label="D"}}
        },
        {{label="E"}}
      },
      {{label="F"}}
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
});

test('Links', async () => {
  await assertThrows(() => compiler.compileToString('[](A)'), 'link not found: A');
  assert.equal(await compiler.compileToString('[](A)\n# A'), '{{labels={A={3}}},{link={"A"}},{{label="A"}}}');
  assert.equal(await compiler.compileToString('[](type)\n# type'), '{{labels={type={3}}},{link={"type"}},{{label="type"}}}');
  const serialized = `
    {
      {labels={A={2}}},
      {
        {label="A",labels={B={2}}},
        {
          {label="B",labels={C={2}}},
          {
            {label="C",labels={D={2}}},
            {
              {label="D",labels={E={3}}},
              {link={"E","F"}},
              {
                {label="E",labels={F={2}}},
                {{label="F"}}
              }
            }
          }
        }
      }
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, '');
  assert.equal(
    await compiler.compileToString('# A\n## B\n### C\n#### D\n[](E|F)\n##### E\n###### F'),
    serialized,
  );
  assert.equal(
    await compiler.compileToString('# A\n## B\n### C\n#### D\n[](F)\n##### E\n###### F'),
    serialized.replace('"E","F"', '"F"'),
  );
});

test('Lists', async () => {
  assert.equal(await compiler.compileToString('- a\n- b'), '{{},{select={{{},"a"},{{},"b"}}}}');
  assert.equal(
    await compiler.compileToString('- # A\n- [](A)'),
    `{
      {labels={A={2,"select",1,2}}},
      {select={
        {{},{{label="A"}}},
        {{},{link={"A"}}}}
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
    '{{},{func=function(args)\n\nprint()\n\nend}}',
  );
});

test('Directives', async () => {
  assert.equal(
    await compiler.compileToString(':::loop[id]\n- Hello\n:::\n'),
    `{
      {labels={id={2,2}}},
      {
        {},
        {
          {label="id"},
          {
            {},
            {select={
              {{},"Hello"}
            }}
          },
          {link={"id"}}
        }
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    await compiler.compileToString(
      `
:::when[true]
- True.
- False.
:::
      `,
    ),
    '{{},{function()return(\ntrue\n)end,{{},"True."},{{},"False."}}}',
  );
  assert.equal(
    await compiler.compileToString(':::when[true]\n- True.\n:::'),
    '{{},{function()return(\ntrue\n)end,{{},"True."}}}',
  );
  assert.equal(
    (await compiler.compileToString(
      `
:::switch
- \`count == 1\`

  One.

- \`count == 2\`

  Two.

- \`count == 3\`

  Three.
:::
      `,
    )).replace(/\s/g, ''),
    '{{},{args={{{},{{},"One."}},{{},{{},"Two."}},{{},{{},"Three."}}},'
    + 'func=function(args)if(count==1)thenreturnip:set(args:resolve(1))end'
    + 'if(count==2)thenreturnip:set(args:resolve(2))end'
    + 'if(count==3)thenreturnip:set(args:resolve(3))endend}}',
  );
});
