import { assert, test } from 'vitest';

import { BrocatelCompiler } from '../src';
import { getData, getRootData } from '../src/debug';
import { toMarkdownString } from '../src/expander';

const compiler = new BrocatelCompiler({
  autoNewLine: true,
});

async function compile(markdown: string | { main: string, [key: string]: string }) {
  const inputs = typeof markdown === 'string' ? { main: markdown } : markdown;
  return compiler.compileAll('main', async (name) => inputs[name]);
}

test('Debug info generation', async () => {
  const compiled = await compile(`
# Hello
[link](#hello)
## Subheading
This is a subheading.

\`\`\`lua
print("Hello world!")
a = 1
\`\`\`

\`a == 1\` Conditional.

\`\`\`lua global
a = 2
\`\`\`
`);
  const rootData = getRootData(compiled);
  assert.notOk(rootData.IFID);
  assert.ok(rootData.gettext);
  assert.ok(rootData.inputs);
  assert.ok(rootData.sourceMap);

  const { main } = rootData.inputs!;
  assert.equal(Object.keys(rootData.inputs!).length, 1);
  assert.ok(main);
  const data = getData(main);
  assert.notOk(data.IFID);
  const {
    debug, codeSnippets, dependencies, gettext, globalLua,
    headings, lineMapping, links, markdown, sourceMap,
  } = data;
  assert.isTrue(debug);

  assert.isArray(data.codeSnippets);
  if (!codeSnippets) {
    return assert.fail();
  }
  assert.lengthOf(codeSnippets, 3);
  assert.deepEqual(codeSnippets[0], {
    expression: false,
    position: {
      start: { line: 7, column: 1, offset: 0 },
      end: { line: 10, column: 4, offset: 0 },
    },
    value: '\nprint("Hello world!")\n\na = 1\n',
  });
  assert.deepEqual(codeSnippets[1], {
    expression: true,
    position: {
      start: { line: 12, column: 1, offset: 0 },
      end: { line: 12, column: 22, offset: 0 },
    },
    value: 'a == 1',
  });
  assert.deepEqual(codeSnippets[2], {
    expression: false,
    position: {
      start: { line: 14, column: 1, offset: 0 },
      end: { line: 16, column: 4, offset: 0 },
    },
    value: '\na = 2\n',
  });

  assert.equal(dependencies!.size, 0);

  assert.lengthOf(gettext!.texts, 2);

  assert.lengthOf(globalLua!, 1);

  assert.ok(headings);
  if (!headings) {
    return assert.fail();
  }
  assert.deepEqual(headings.position, {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 17, column: 1, offset: 0 },
  });
  assert.lengthOf(Object.keys(headings.children), 1);
  const { hello } = headings.children;
  assert.ok(hello);
  assert.deepEqual(hello.position, {
    start: { line: 2, column: 1, offset: 0 },
    end: { line: 2, column: 8, offset: 0 },
  });
  assert.lengthOf(Object.keys(hello.children), 1);
  const { subheading } = hello.children;
  assert.ok(subheading);
  assert.deepEqual(subheading.position, {
    start: { line: 4, column: 1, offset: 0 },
    end: { line: 4, column: 14, offset: 0 },
  });
  assert.lengthOf(Object.keys(subheading.children), 0);

  assert.equal(lineMapping!.original.length, 17);
  assert.equal(lineMapping!.newLines.length, 17);

  assert.ok(links);
  if (!links) {
    return assert.fail();
  }
  assert.lengthOf(links, 1);
  assert.deepEqual(links[0], {
    position: {
      start: { line: 3, column: 1, offset: 0 },
      end: { line: 3, column: 15, offset: 0 },
    },
    labels: ['hello'],
    type: 'link',
  });

  assert.ok(markdown);
  assert.equal(toMarkdownString(markdown!), `# Hello

[link](#hello)

## Subheading

This is a subheading.

\`\`\`lua

print("Hello world!")

a = 1

\`\`\`

:::if\`a == 1\`

*   Conditional.

\`\`\`lua global

a = 2

\`\`\``);

  assert.ok(sourceMap);

  return undefined as never;
});

test('Debug multiple files', async () => {
  const compiled = await compile({
    main: `
# Hello
[link](other.md#subheading)
`,
    other: `
## Subheading
[link](main.md#hello)
`,
  });
  const rootData = getRootData(compiled);
  const { main, other } = rootData.inputs!;
  assert.equal(main.path, 'main.md');
  assert.equal(other.path, 'other.md');
});
