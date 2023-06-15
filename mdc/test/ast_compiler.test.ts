import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { assert, test } from 'vitest';

import { directiveFromMarkdown } from '../src/directive';
import expandMacro from '../src/expander';
import transformAst from '../src/transformer';
import astCompiler from '../src/ast_compiler';

const parser = unified()
  .use(remarkParse)
  .use(function remarkMdx() {
    // Remark-Mdx expects the expressions to be JS expressions,
    // while we use them as Lua ones.
    const data = this.data();
    data.fromMarkdownExtensions = [[mdxExpressionFromMarkdown]];
    data.micromarkExtensions = [mdxExpression()];
  })
  .use(directiveFromMarkdown)
  .use(expandMacro)
  .use(transformAst)
  .use(astCompiler);

function assertCompile(markdown: string): string {
  const vfile = parser.processSync(markdown);
  assert.isEmpty(vfile.messages, vfile.messages.map((m) => m.message).join(', '));
  return vfile.value.toString();
}

test('Simple text', () => {
  assert.equal(assertCompile('test'), '{{},"test"}');
  assert.equal(
    assertCompile(
      '[c] [d] a {a?} b {b}',
    ),
    '{{},{plural="v1",tags={c="",d=""},text="a {v1} b {v2}",'
    + 'values={v1=function()return(a)end,v2=function()return(b)end}}}',
  );
});

test('Simplest plain text', async () => {
  assert.equal(assertCompile('hello'), '{{},"hello"}');
  assert.equal(assertCompile('hello\n\nhello'), '{{},"hello","hello"}');
  assert.equal(
    assertCompile('`true` True.\n\n`a = 1`'),
    '{{},{function()return(true)end,{{},"True."}},{func=function(args)a = 1\nend}}',
  );
});

test('Tagged text', async () => {
  assert.equal(
    assertCompile('[a] [b] c [d] e'),
    '{{},{tags={a="",b=""},text="c \\\\[d] e"}}',
  );
  assert.equal(
    assertCompile('\\[a] [b] c [d] e'),
    '{{},{tags={a="",b=""},text="c \\\\[d] e"}}',
  );
  assert.equal(
    assertCompile('\\\\[a] [b] c [d] e'),
    '{{},"\\\\[a] \\\\[b] c \\\\[d] e"}',
  );
});

test('Text with values', async () => {
  assert.throw(() => assertCompile('The {} Names of God'), 'empty expression');
  assert.equal(
    assertCompile('The {count} Names of God'),
    '{{},{text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
  assert.equal(
    assertCompile('The {count?} Names of God'),
    '{{},{plural="v1",text="The {v1} Names of God",values={v1=function()return(count)end}}}',
  );
});

test('Headings', async () => {
  assert.equal(assertCompile('# Heading 1'), '{{labels={["Heading 1"]={2}}},{{label="Heading 1"}}}');
  assert.equal(
    assertCompile('# A\n## B\n### C\n### D\n## E\n# F'),
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
  assert.equal(assertCompile('[](A)\n# A'), '{{labels={A={3}}},{link={"A"}},{{label="A"}}}');
  assert.equal(assertCompile('[](type)\n# type'), '{{labels={type={3}}},{link={"type"}},{{label="type"}}}');
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
    assertCompile('# A\n## B\n### C\n#### D\n[](E#F)\n##### E\n###### F'),
    serialized,
  );
  assert.equal(
    assertCompile('# A\n## B\n### C\n#### D\n[](F)\n##### E\n###### F'),
    serialized.replace('"E","F"', '"F"'),
  );
});

test('Lists', async () => {
  assert.equal(
    assertCompile('- a\n- b'),
    '{{},{args={{},{{},"a"},{{},"b"},func=function(args)FUNC.S_ONCE(args)\nend}}',
  );
  assert.equal(
    assertCompile('- # A\n- [](A)').replace(/\n/g, ''),
    `{
      {labels={A={2,"args",2,2}}},
      {args={{},
        {{},{{label="A"}}},
        {{},{link={"A"}}},
       func=function(args)FUNC.S_ONCE(args)end
      }
    }`.replace(/--.+/g, '').replace(/ |\n/g, ''),
  );
  assert.equal(
    assertCompile('1. `some` some\n2. else').replace(/\n/g, ''),
    '{{},{args={{},{{},{function()return(some)end,{{},"some"}}},'
    + '{{},"else"},func=function(args)FUNC.S_RECUR(args)end}}',
  );
});

test('Code blocks', async () => {
  assert.throws(() => assertCompile('```js\nconsole\n```\n'), 'unsupported code block type');
  assert.throws(() => assertCompile('```lua\n(\n```\n'), 'unexpected symbol near <eof>');
  assert.equal(
    assertCompile('```lua\nprint()\n```\n'),
    '{{},{func=function(args)print()\nend}}',
  );
});

test('Directives', async () => {
  assert.equal(
    assertCompile(':::loop`id`\n- - Hello').replace(/\n/g, ''),
    `{
      {labels={id={2,2}}},
      {
        {},
        {
          {label="id"},
          {args={{},
            {{},"Hello"},
            func=function(args)FUNC.S_ONCE(args)
          end},
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
    '{{},{function()return(true)end,{{},"True."},{{},"False."}}}',
  );
  assert.equal(
    assertCompile(':::if`true`\n- True.'),
    '{{},{function()return(true)end,{{},"True."}}}',
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
    '{{},{args={{},{{},"One."},{{},"Two."},{{},"Three."},'
    + 'func=function(args)if(count==1)thenreturnIP:set(args:resolve(2))end'
    + 'if(count==2)thenreturnIP:set(args:resolve(3))end'
    + 'if(count==3)thenreturnIP:set(args:resolve(4))endend}}',
  );
});
