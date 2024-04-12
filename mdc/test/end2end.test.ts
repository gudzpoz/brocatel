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
      assert.equal((result as TextLine)?.text, line);
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
  await assertOutput(':a[result: {1 + 1}] :c[{2 + 2}] e {4 + 4}', [], [
    { text: 'e 8', tags: { a: 'result: 2', c: '4' } },
  ]);
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

test('Switch macro', async () => {
  await assertOutput(`
\`i = 0\`
# start
:::switch
- \`i == 0\`
  0
- \`i == 1\`
  1
- \`i == 2\`
  2
- \`true\`
  end
\`i = i + 1\`
\`i < 4\` [](#start)
`, [], ['0', '1', '2', 'end']);
});

test('Visit counts', async () => {
  await assertOutput(`
# start
Count: {VISITS(counted)}
\`VISITS(counted) >= 9\` [](#ended)
[](#counted)
## counted
[](#start)
# ended
`, [], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `Count: ${i}`));
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

  await loadStory(`
\`i = 1\`
:::loop \`spin1\`
- \`i = i + 1\`
- :::if \`i > 5\`
  - \`END(spin1)\`
Count: {i}
:::loop \`spin2\`
- \`i = i + 1\`
- :::if \`i > 10\`
  - \`END(spin2)\`
Count: {i}
`);
  const saveStart = runner.save();
  assert.equal((runner.next() as TextLine).text, 'Count: 6');
  const saveMid = runner.save();
  assert.equal((runner.next() as TextLine).text, 'Count: 11');
  const saveEnd = runner.save();
  runner.load(saveStart);
  assert.equal((runner.next() as TextLine).text, 'Count: 6');
  runner.load(saveMid);
  assert.equal((runner.next() as TextLine).text, 'Count: 11');
  runner.load(saveEnd);
  assert.isNull(runner.next());
});

test('Load across stories', async () => {
  await loadStory('1');
  const save1 = runner.save();
  await loadStory('1');
  runner.load(save1);
  await loadStory('2')
  assert.throw(() => runner.load(save1), 'cannot use savedata across different stories');
});

test('IFID', async () => {
  const compiled = await assertOutput(`---
IFID: d0adf5d6-ae96-497c-9616-ee7e8f0a83f3
---

Hello`, [], ['Hello']);
  assert.equal(compiled, `_={}
return {[""]={checksum="cfe5ec9d8b1868821b190d4a3acccf2e08070ac2a78a416b938c6d74aaf50630",
IFID={"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F3//"},
version=1,
entry="main"},
main={{debug={"1:1","5:1"}},
"Hello"}}`);

  const multiple = await assertOutput(`---
IFID:
  - d0adf5d6-ae96-497c-9616-ee7e8f0a83f3
  - uuid://d0adf5d6-ae96-497c-9616-ee7e8f0a83f4//
  - uuid://d0adf5d6-ae96-497c-9616-ee7e8f0a83f5
---

Hello`, [], ['Hello']);
  assert.equal(multiple, `_={}
return {[""]={checksum="defc06d16cc5a9cc2864c7bde796d057628c8a85b38466025ea459e0aef842a2",
IFID={"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F3//",
"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F4//",
"UUID://D0ADF5D6-AE96-497C-9616-EE7E8F0A83F5//"},
version=1,
entry="main"},
main={{debug={"1:1","8:1"}},
"Hello"}}`);
  assertOutput(`---
brocatel: true
---
Hello`, [], ['Hello']);
});

test('Routine local variables', async () => {
  await assertOutput(`
\`v = 1\`
{v}
[](#fun)
{v}
# fun {v}
{type(v)}
`, [], ['1', 'nil', '1']);
  await assertOutput(`
\`v = 1\`
{v}
[{ v = 2 }](#fun)
{v}
# fun {v}
{type(v)} {v}
`, [], ['1', 'number 2', '1']);
});

test('Coroutine calls', async () => {
  await assertOutput(`
Line 1
> [](#co)
Line 2
# co {}
Line 3
`, [], ['Line 1', 'Line 2', 'Line 3']);
});