import { assert, test } from 'vitest';
import {
  BrocatelCompiler, StoryRunner, type SelectLine, type TextLine,
} from '../src/index';

const compiler = new BrocatelCompiler({
  autoNewLine: true,
});
const runner = new StoryRunner();

async function loadStory(markdown: string) {
  const compiled = await compiler.compileAll('main', async () => markdown);
  assert.isEmpty(compiled.messages, compiled.messages.map((m) => m.message).join(', '));
  const lua = compiled.toString();
  await runner.loadStory(lua);
  return lua;
}

async function assertOutput(
  markdown: string,
  input: string[],
  output: (string | (string | TextLine)[] | TextLine)[],
) {
  const compiled = await loadStory(markdown);

  let option: number | undefined;
  let inputI = 0;
  output.forEach((line) => {
    const result = runner.next(option);
    option = undefined;
    if (typeof line === 'string') {
      assert.equal((result as TextLine).text, line);
    } else if (Array.isArray(line)) {
      const { select } = result as SelectLine;
      assert.isArray(select);
      assert.deepEqual(
        select.map((s) => s.option.text),
        line.map((s, i) => {
          if (typeof s === 'string') {
            return s;
          }
          assert.deepEqual(select[i].option.tags, s.tags);
          return s.text;
        }),
      );
      option = select.find((v) => v.option.text === input[inputI])?.key;
      assert.isNumber(option);
      inputI += 1;
    } else {
      assert.deepEqual(result as TextLine, line);
    }
  });
  assert.lengthOf(input, inputI);
  assert.isNull(runner.next());
  runner.close();
  return compiled;
}

test('Texts', async () => {
  await assertOutput('Hello World!', [], ['Hello World!']);
  await assertOutput('Hello\nWorld', [], ['Hello', 'World']);
  await assertOutput('*Hello* ***World***', [], ['*Hello* ***World***']);
  await assertOutput('String: {type("")}', [], ['String: string']);
  await assertOutput('`a = 1024`\nValue: {a} + {a} = {a + a}', [], ['Value: 1024 + 1024 = 2048']);
  await assertOutput(':a[b] :c d :e[f] g', [], [{ text: 'd :e[f] g', tags: { a: 'b', c: '' } }]);
});

test('Conditionals', async () => {
  await assertOutput('`type("") == "nil"` nil', [], []);
  await assertOutput('`type({}) == "table"` nil', [], ['nil']);
  await assertOutput(`
:::if \`type(0) ~= "number"\`
- not number
- number
`, [], ['number']);
});

test('Heading history', async () => {
  await assertOutput(`
{VISITS(heading_1)}
# heading 1
{VISITS(heading_1)}
{VISITS(heading_2)}
[](#heading-2)
# heading 2
{VISITS(heading_2)}
`, [], ['0', '1', '0', '1']);
  await assertOutput(`
{VISITS(a)}
- A {VISITS(a)}
  {VISITS(a)}
  # a
  {VISITS(a)}
  {VISITS(b)}
  [](#b)
  # b
  [](#c)
  ## c
{VISITS(b)}
{VISITS(c)}
`, ['A 0'], ['0', ['A 0'], '0', '1', '0', '1', '1']);
  await assertOutput(`
{VISITS(a)}
[{}](#a)
{VISITS(a)}
# a {}
{VISITS(a)}
`, [], ['0', '1', '1']);
});

test('Options', async () => {
  await assertOutput(`
- A
  B
- C
  D
`, ['C'], [['A', 'C'], 'D']);
  await assertOutput(`
:::loop
- - A
    B
  - C
    D
  - \`DEFAULT\` E
    F
    ---
`, ['A', 'C', 'E'], [['A', 'C'], 'B', ['C'], 'D', ['E'], 'F']);
  await assertOutput(`
- :tag[value] text
  A
`, ['text'], [[{ text: 'text', tags: { tag: 'value' } }], 'A']);
});

test('Recursive fibonacci', async () => {
  await assertOutput(`
[{ n = 8 }](#fibonacci)
END
# fibonacci { i, j, n }
\`i = i or 0\`
\`j = j or 1\`
{ i + j }
\`n ~= 1\` [{ n = n - 1, i = j, j = i + j }](#fibonacci)
`, [], ['1', '2', '3', '5', '8', '13', '21', '34', 'END']);
});

test('Save and load', async () => {
  await loadStory('- 0\n  A\n  B\n  C');
  assert.equal((runner.next(
    (runner.next() as SelectLine).select.find((s) => s.option.text === '0')!.key,
  ) as TextLine).text, 'A');
  const save = runner.save();
  assert.equal((runner.next() as TextLine).text, 'B');
  assert.equal((runner.next() as TextLine).text, 'C');
  runner.load(save);
  assert.equal((runner.next() as TextLine).text, 'B');
  assert.equal((runner.next() as TextLine).text, 'C');
});

test('IFID', async () => {
  const compiled = await assertOutput(`---
IFID: d0adf5d6-ae96-497c-9616-ee7e8f0a83f3
---

Hello`, [], ['Hello']);
  assert.include(compiled, '[""]={IFID={"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F3//"},version=1,entry="main"}');

  const multiple = await assertOutput(`---
IFID:
  - d0adf5d6-ae96-497c-9616-ee7e8f0a83f3
  - uuid://d0adf5d6-ae96-497c-9616-ee7e8f0a83f4//
  - uuid://d0adf5d6-ae96-497c-9616-ee7e8f0a83f5
---

Hello`, [], ['Hello']);
  assert.include(multiple, '[""]={IFID={"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F3//","UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F4//",'
    + '"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F5//"},version=1,entry="main"}');
});
