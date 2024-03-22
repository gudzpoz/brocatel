import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { assert, test } from 'vitest';

import { directiveForMarkdown, mdxForMarkdown } from '@brocatel/md';

import expandMacro from '../src/expander';
import { luaErrorDetector } from '../src/lua';
import transformAst from '../src/transformer';
import astCompiler from '../src/ast-compiler';

const parser = unified()
  .use(remarkParse)
  .use(mdxForMarkdown)
  .use(directiveForMarkdown)
  .use(expandMacro)
  .use(transformAst)
  .use(astCompiler);

async function assertCompile(markdown: string, debug?: boolean): Promise<string> {
  const input = new VFile(markdown);
  if (debug) {
    input.data.debug = true;
  }
  const vfile = await parser.process(input);
  assert.isEmpty(
    vfile.messages.filter((e) => e.fatal !== null),
    vfile.messages.map((m) => m.message).join(', '),
  );
  const lua = vfile.value.toString();
  assert.isNull((await luaErrorDetector())(`return ${lua}`), lua);
  return lua.replace(/\n/g, '');
}

async function assertThrows(f: () => Promise<any>, message: string) {
  try {
    await f();
    assert.fail('exception expected');
  } catch (e) {
    assert.include((e as Error).message, message);
  }
}

test('Simple text', async () => {
  assert.equal(await assertCompile('test'), '{_,"test"}');
  assert.equal(
    await assertCompile(
      ':c :d a {a?} b {b}',
    ),
    '{_,{plural="v1",tags={c="",d=""},text="a {v1} b {v2}",'
    + 'values={v1=function()return(a)end,v2=function()return(b)end}}}',
  );
});

test('Simplest plain text', async () => {
  assert.equal(await assertCompile('hello'), '{_,"hello"}');
  assert.equal(await assertCompile('hello\n\nhello'), '{_,"hello","hello"}');
  assert.equal(
    await assertCompile('`true` True.\n\n`a = 1`'),
    '{_,{function()return(true)end,{_,"True."}},{func=function(args)a = 1end}}',
  );
});

test('Tagged text', async () => {
  assert.equal(
    await assertCompile(':a :b c :d e'),
    '{_,{tags={a="",b=""},text="c :d e"}}',
  );
  assert.equal(
    await assertCompile('\\:a :b c :d e'),
    '{_,"\\\\:a :b c :d e"}',
  );
  assert.equal(
    await assertCompile(':a[a] :b[[B\\n]] c :d e'),
    '{_,{tags={a="a",b="\\\\[B\\\\n]"},text="c :d e"}}',
  );
  assert.equal(
    await assertCompile(':a :b :c[c]'),
    '{_,{tags={a="",b="",c="c"},text=""}}',
  );
});

test('Text with values', async () => {
  assertThrows(() => assertCompile('The {} Names of God'), 'empty expression');
  assert.equal(
    await assertCompile('The {count} Names of God'),
    '{_,{text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
  assert.equal(
    await assertCompile('The {count?} Names of God'),
    '{_,{plural="v1",text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
});

test('Headings', async () => {
  assert.equal(await assertCompile('# Heading 1'), '{{labels={["heading-1"]={2}}},{{label="heading-1"}}}');
  assert.equal(
    await assertCompile('# A\n## B\n### C\n### D\n## E\n# F'),
    `
    {
      {labels={
        a={2},
        f={3}
      }},
      {
        {label="a",labels={
          b={3},
          e={5}
        }},
        {func=function(args)END()end},
        {
          {label="b",labels={
            c={3},
            d={5}
          }},
          {func=function(args)END()end},
          {{label="c"},{func=function(args)END()end}},
          {func=function(args)END()end},
          {{label="d"},{func=function(args)END()end}},
          {func=function(args)END()end}
        },
        {func=function(args)END()end},
        {{label="e"},{func=function(args)END()end}},
        {func=function(args)END()end}
      },
      {{label="f"}}
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
});

test('Links', async () => {
  assert.equal(await assertCompile('[](a)\n# A'), '{{labels={a={3}}},{link={"a"},params=true},{{label="a"}}}');
  assert.equal(await assertCompile('[](<#type> )\n# type'), '{{labels={type={3}}},{link={"type"},params=true},{{label="type"}}}');
  assert.equal(
    await assertCompile('[](<#Привет non-latin 你好>)\n# Привет non-latin 你好'),
    '{{labels={["привет-non-latin-你好"]={3}}},{link={"привет-non-latin-你好"},params=true},{{label="привет-non-latin-你好"}}}',
  );
  const serialized = `
    {
      {labels={a={2}}},
      {
        {label="a",labels={b={3}}},
        {func=function(args)END()end},
        {
          {label="b",labels={c={3}}},
          {func=function(args)END()end},
          {
            {label="c",labels={d={3}}},
            {func=function(args)END()end},
            {
              {label="d",labels={e={4}}},
              {link={"e","f"},params=true},
              {func=function(args)END()end},
              {
                {label="e",labels={f={3}}},
                {func=function(args)END()end},
                {{label="f"}}
              }
            }
          }
        }
      }
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, '').replace(/\\n/g, '\n');
  assert.equal(
    await assertCompile('# A\n## B\n### C\n#### D\n[](e#f)\n##### E\n###### F'),
    serialized,
  );
  assert.equal(
    await assertCompile('# A\n## B\n### C\n#### D\n[](f)\n##### E\n###### F'),
    serialized.replace('"e","f"', '"f"'),
  );
});

test('Lists', async () => {
  assert.equal(
    await assertCompile('- a\n- b'),
    '{_,{args={_,{_,"a"},{_,"b"}},func=function(args)FUNC.S_ONCE(args)end}}',
  );
  assert.equal(
    (await assertCompile('- # A\n- [](a)')).replace(/\n/g, ''),
    `{
      {labels={a={2,"args",2,2}}},
      {args={_,
        {_,{{label="a"}}},
        {_,{link={"a"},params=true}}},
       func=function(args)FUNC.S_ONCE(args)end
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    (await assertCompile('1. `some` some\n2. else')).replace(/\n/g, ''),
    '{_,{args={_,{_,{function()return(some)end,{_,"some"}}},'
    + '{_,"else"}},func=function(args)FUNC.S_RECUR(args)end}}',
  );
});

test('Code blocks', async () => {
  assertThrows(() => assertCompile('```js\nconsole\n```\n'), 'unsupported code block type');
  assertThrows(() => assertCompile('```lua\n(\n```\n'), 'unexpected symbol near <eof>');
  assert.equal(
    await assertCompile('```lua\nprint()\n```\n'),
    '{_,{func=function(args)print()end}}',
  );
});

test('Directives', async () => {
  assert.equal(
    (await assertCompile(':::loop`id`\n- - Hello')).replace(/\n/g, ''),
    `{
      {labels={id={2,2}}},
      {
        _,
        {
          {label="id"},
          {_,{args={_,
            {_,"Hello"}},
            func=function(args)FUNC.S_ONCE(args)
          end}},
          {link={"id"},params=true}
        }
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    await assertCompile(
      `
:::if\`true\`
- True.
- False.
      `,
    ),
    '{_,{function()return(true)end,{_,"True."},{_,"False."}}}',
  );
  assert.equal(
    await assertCompile(':::if`true`\n- True.'),
    '{_,{function()return(true)end,{_,"True."}}}',
  );
  assert.equal(
    (await assertCompile(
      `
:::switch
- \`count == 1\`

  One.

- \`count == 2\`

  Two.

- \`count == 3\`

  Three.
      `,
    )).replace(/\s/g, ''),
    '{_,{args={_,{_,"One."},{_,"Two."},{_,"Three."}},'
    + 'func=function(args)if(count==1)thenreturnIP:set(args:resolve(2))end'
    + 'if(count==2)thenreturnIP:set(args:resolve(3))end'
    + 'if(count==3)thenreturnIP:set(args:resolve(4))endend}}',
  );
});

test('Mixed', async () => {
  const compiled = await assertCompile(`
# Hello World

## inner

Hello World!

[](#hello-world#inner)`);
  assert.equal(
    compiled,
    '{{labels={["hello-world"]={2}}},{{label="hello-world",labels={inner={3}}},'
    + '{func=function(args)END()end},'
    + '{{label="inner"},'
    + '"Hello World!",{link={"hello-world","inner"},params=true}}}}',
  );
});

test('Function', async () => {
  const compiled = await assertCompile('# func {}\n[{}](#func)\n\n---');
  assert.equal(
    compiled,
    '{{labels={func={3}}},{func=function(args)END()end},'
    + '{{routine={},label="func"},{link={"func"},params=function()return {}end},'
    + '{func=function(args)END()end}}}',
  );
});

test('Debug info', async () => {
  const compiled = await assertCompile(
    `# heading-1

Line-2

:::local
* Line-3

:::loop \`loop-4\`

- Line-5

  Line-6

- Line-7
`,
    true,
  );
  assert.equal(
    compiled,
    `
    {{debug={"1:1",""},labels={["heading-1"]={2}}},
      {{debug={"1:1","3:1","5:1","8:1"},label="heading-1",labels={["loop-4"]={4,2}}},
        "Line-2",
        {{debug={"5:1","6:3"}},
          "Line-3"},
        {{debug={"8:1","8:9"}},
          {{debug={"8:9","10:1",""},label="loop-4"},
            {{debug={"10:1","10:3","12:3","14:3"}},
              "Line-5",
              "Line-6",
              "Line-7"},
            {link={"loop-4"},params=true}
          }
        }
      }
    }
    `.replace(/\s/g, ''),
  );
});
