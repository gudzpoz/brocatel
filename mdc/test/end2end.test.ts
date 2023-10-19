import { assert, test } from 'vitest';
import { LuaFactory } from 'wasmoon';
import { BrocatelCompiler } from '../src/index';

import vmBundle from '../../docs/.vitepress/cache/vm-bundle.lua?raw';

const compiler = new BrocatelCompiler({
  autoNewLine: true,
});
const factory = new LuaFactory();

interface StoryLine {
  text?: string;
  select?: { key: number, option: string }[];
}

async function assertOutput(markdown: string, input: string[], output: (string | string[])[]) {
  const compiled = await compiler.compileAll('main', async () => markdown);
  assert.isEmpty(compiled.messages.map((m) => m.message));
  const L = await factory.createEngine({
    openStandardLibs: true,
    enableProxy: true,
  });
  L.global.loadString(vmBundle, 'vm.lua');
  L.global.lua.lua_pcallk(L.global.address, 0, -1, 0, 0, null);
  L.global.lua.lua_setglobal(L.global.address, 'vm');
  L.global.set('s', compiled.toString());
  L.doString('story=vm.load_vm(s)');

  let option: number | undefined;
  let inputI = 0;
  output.forEach((line) => {
    L.global.set('option', option);
    option = undefined;
    const top = L.global.getTop();
    const result: StoryLine = L.doStringSync('return story:next(option)');
    if (typeof line === 'string') {
      assert.equal(result.text, line);
    } else {
      assert.isArray(result.select);
      assert.deepEqual(result.select!.map((s) => s.option), line);
      option = result.select!.find((v) => v.option === input[inputI])?.key;
      assert.isNumber(option);
      inputI += 1;
    }
    L.global.setTop(top);
  });
  assert.isNull(L.doStringSync('return story:next(option)'));
  assert.lengthOf(input, inputI);
}

test('Texts', async () => {
  await assertOutput('Hello World!', [], ['Hello World!']);
  await assertOutput('Hello\nWorld', [], ['Hello', 'World']);
  await assertOutput('*Hello* ***World***', [], ['*Hello* ***World***']);
  await assertOutput('String: {type("")}', [], ['String: string']);
  await assertOutput('`a = 1024`\nValue: {a} + {a} = {a + a}', [], ['Value: 1024 + 1024 = 2048']);
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
});
