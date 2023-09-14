import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { assert, test } from 'vitest';

import { directiveForMarkdown } from 'brocatel-md';

import expandMacro from '../src/expander';
import { detectLuaErrors } from '../src/lua';
import transformAst from '../src/transformer';
import astCompiler from '../src/ast-compiler';

const parser = unified()
  .use(remarkParse)
  .use(function remarkMdx() {
    // Remark-Mdx expects the expressions to be JS expressions,
    // while we use them as Lua ones.
    const data = this.data();
    data.fromMarkdownExtensions = [[mdxExpressionFromMarkdown]];
    data.micromarkExtensions = [mdxExpression()];
  })
  .use(directiveForMarkdown)
  .use(expandMacro)
  .use(transformAst)
  .use(astCompiler);

function assertCompile(markdown: string, debug?: boolean): string {
  const input = new VFile(markdown);
  if (debug) {
    input.data.debug = true;
  }
  const vfile = parser.processSync(input);
  assert.isEmpty(
    vfile.messages.filter((e) => e.fatal !== null),
    vfile.messages.map((m) => m.message).join(', '),
  );
  const lua = vfile.value.toString();
  assert.isNull(detectLuaErrors(`return ${lua}`), lua);
  return lua;
}

test('Simple text', () => {
  assert.equal(assertCompile('test'), '{_,"test"}');
  assert.equal(
    assertCompile(
      '[c] [d] a {a?} b {b}',
    ),
    '{_,{plural="v1",tags={c="",d=""},text="a {v1} b {v2}",'
    + 'values={v1=function()return(a)end,v2=function()return(b)end}}}',
  );
});

test('Simplest plain text', async () => {
  assert.equal(assertCompile('hello'), '{_,"hello"}');
  assert.equal(assertCompile('hello\n\nhello'), '{_,"hello","hello"}');
  assert.equal(
    assertCompile('`true` True.\n\n`a = 1`'),
    '{_,{function()return(true)end,{_,"True."}},{func=function(args)a = 1\nend}}',
  );
});

test('Tagged text', async () => {
  assert.equal(
    assertCompile('[a] [b] c [d] e'),
    '{_,{tags={a="",b=""},text="c \\\\[d] e"}}',
  );
  assert.equal(
    assertCompile('\\[a] [b] c [d] e'),
    '{_,{tags={a="",b=""},text="c \\\\[d] e"}}',
  );
  assert.equal(
    assertCompile('\\\\[a] [b] c [d] e'),
    '{_,"\\\\[a] \\\\[b] c \\\\[d] e"}',
  );
});

test('Text with values', async () => {
  assert.throw(() => assertCompile('The {} Names of God'), 'empty expression');
  assert.equal(
    assertCompile('The {count} Names of God'),
    '{_,{text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
  assert.equal(
    assertCompile('The {count?} Names of God'),
    '{_,{plural="v1",text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
});

test('Headings', async () => {
  assert.equal(assertCompile('# Heading 1'), '{{labels={["heading-1"]={2}}},{{label="heading-1"}}}');
  assert.equal(
    assertCompile('# A\n## B\n### C\n### D\n## E\n# F'),
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
        {func=function(args)END()\\nend},
        {
          {label="b",labels={
            c={3},
            d={5}
          }},
          {func=function(args)END()\\nend},
          {{label="c"},{func=function(args)END()\\nend}},
          {func=function(args)END()\\nend},
          {{label="d"},{func=function(args)END()\\nend}},
          {func=function(args)END()\\nend}
        },
        {func=function(args)END()\\nend},
        {{label="e"},{func=function(args)END()\\nend}},
        {func=function(args)END()\\nend}
      },
      {{label="f"}}
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, '').replace(/\\n/g, '\n'),
  );
});

test('Links', async () => {
  assert.equal(assertCompile('[](a)\n# A'), '{{labels={a={3}}},{link={"a"}},{{label="a"}}}');
  assert.equal(assertCompile('[](<#type> )\n# type'), '{{labels={type={3}}},{link={"type"}},{{label="type"}}}');
  assert.equal(
    assertCompile('[](<#Привет non-latin 你好>)\n# Привет non-latin 你好'),
    '{{labels={["привет-non-latin-你好"]={3}}},{link={"привет-non-latin-你好"}},{{label="привет-non-latin-你好"}}}',
  );
  const serialized = `
    {
      {labels={a={2}}},
      {
        {label="a",labels={b={3}}},
        {func=function(args)END()\\nend},
        {
          {label="b",labels={c={3}}},
          {func=function(args)END()\\nend},
          {
            {label="c",labels={d={3}}},
            {func=function(args)END()\\nend},
            {
              {label="d",labels={e={4}}},
              {link={"e","f"}},
              {func=function(args)END()\\nend},
              {
                {label="e",labels={f={3}}},
                {func=function(args)END()\\nend},
                {{label="f"}}
              }
            }
          }
        }
      }
    }
    `.replace(/--.+/g, '').replace(/ |\n/g, '').replace(/\\n/g, '\n');
  assert.equal(
    assertCompile('# A\n## B\n### C\n#### D\n[](e#f)\n##### E\n###### F'),
    serialized,
  );
  assert.equal(
    assertCompile('# A\n## B\n### C\n#### D\n[](f)\n##### E\n###### F'),
    serialized.replace('"e","f"', '"f"'),
  );
});

test('Lists', async () => {
  assert.equal(
    assertCompile('- a\n- b'),
    '{_,{args={_,{_,"a"},{_,"b"}},func=function(args)FUNC.S_ONCE(args)\nend}}',
  );
  assert.equal(
    assertCompile('- # A\n- [](a)').replace(/\n/g, ''),
    `{
      {labels={a={2,"args",2,2}}},
      {args={_,
        {_,{{label="a"}}},
        {_,{link={"a"}}}},
       func=function(args)FUNC.S_ONCE(args)end
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    assertCompile('1. `some` some\n2. else').replace(/\n/g, ''),
    '{_,{args={_,{_,{function()return(some)end,{_,"some"}}},'
    + '{_,"else"}},func=function(args)FUNC.S_RECUR(args)end}}',
  );
});

test('Code blocks', async () => {
  assert.throws(() => assertCompile('```js\nconsole\n```\n'), 'unsupported code block type');
  assert.throws(() => assertCompile('```lua\n(\n```\n'), 'unexpected symbol near <eof>');
  assert.equal(
    assertCompile('```lua\nprint()\n```\n'),
    '{_,{func=function(args)print()\nend}}',
  );
});

test('Directives', async () => {
  assert.equal(
    assertCompile(':::loop`id`\n- - Hello').replace(/\n/g, ''),
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
          {link={"id"}}
        }
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    assertCompile(
      `
:::if\`true\`
- True.
- False.
      `,
    ),
    '{_,{function()return(true)end,{_,"True."},{_,"False."}}}',
  );
  assert.equal(
    assertCompile(':::if`true`\n- True.'),
    '{_,{function()return(true)end,{_,"True."}}}',
  );
  assert.equal(
    (assertCompile(
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

test('Mixed', () => {
  const compiled = assertCompile(`
# Hello World

## inner

Hello World!

[](#hello-world#inner)`);
  assert.equal(
    compiled,
    '{{labels={["hello-world"]={2}}},{{label="hello-world",labels={inner={3}}},'
    + '{func=function(args)END()\nend},'
    + '{{label="inner"},'
    + '"Hello World!",{link={"hello-world","inner"}}}}}',
  );
});

test('Function', () => {
  const compiled = assertCompile('# func {}\n[{}](#func)\n\n---');
  assert.equal(
    compiled,
    '{{labels={func={3}}},{func=function(args)END()\nend},'
    + '{{func=true,label="func"},{link={"func"},params=function()return{}end},'
    + '{func=function(args)END()\nend}}}',
  );
});

test('Debug info', () => {
  const compiled = assertCompile(
    `# heading-1

Line-2

> Line-3

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
      {{debug={"1:1","3:1","5:1","7:1"},label="heading-1",labels={["loop-4"]={4,2}}},
        "Line-2",
        {{debug={"5:1","5:3"}},
          "Line-3"},
        {{debug={"7:1","7:9"}},
          {{debug={"7:9","9:1",""},label="loop-4"},
            {{debug={"9:1","9:3","11:3","13:3"}},
              "Line-5",
              "Line-6",
              "Line-7"},
            {link={"loop-4"}}
          }
        }
      }
    }
    `.replace(/\s/g, ''),
  );
});
