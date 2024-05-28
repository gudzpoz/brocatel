import { Root } from 'mdast';

import { BrocatelCompiler, markdownExpander, util } from '../src/index';
import { assert, test } from 'vitest';

const compiler = new BrocatelCompiler({});
const remark = markdownExpander();

async function pass(input: string): Promise<Root> {
  const file = compiler.preprocess(input);
  const tree = await remark.run(remark.parse(file), file);
  return tree as Root;
}

async function assertPinpoint(input: string, positions: number[][], expected: ReturnType<typeof util.pinpoint>[]) {
  const tree = await pass(input);
  assert.equal(positions.length, expected.length);
  positions.forEach((p, i) => {
    const expectedNode = expected[i];
    const position = { line: p[0], column: p[1] };
    const node = util.pinpoint(tree, position)!;
    if (!expectedNode) {
      assert.isNull(node, `Position: ${position.line}:${position.column}`);
    } else {
      assert.isObject(node, `Position: ${position.line}:${position.column}, expected: ${JSON.stringify(expectedNode)}`);
      const copy = { ...node };
      delete copy.position;
      delete copy.data;
      assert.deepEqual(copy, expectedNode);
    }
  });
}

test('Not expanded text', async () => {
  const columns = [2, 3, 4, 5];
  await assertPinpoint(
    'Hello',
    columns.map((col) => [1, col]),
    columns.map(() => ({ type: 'text', value: 'Hello' })),
  );
  const limits = [1, 6];
  await assertPinpoint(
    'Hello',
    limits.map((col) => [1, col]),
    limits.map(() => null),
  );
});

test('Text with remapped line numbers', async () => {
  await assertPinpoint(`
Hello
World

Hello2
World2
`,
    [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2]],
    [
      { type: 'text', value: 'Hello' },
      { type: 'text', value: 'World' },
      null,
      { type: 'text', value: 'Hello2' },
      { type: 'text', value: 'World2' },
      null,
    ],
  );
});

test('Text with expanded contents', async () => {
  await assertPinpoint(
    '`condition` text\n`condition2` text2',
    [[1, 1], [1, 2], [1, 12], [1, 13], [2, 1], [2, 2], [2, 13], [2, 14]],
    [
      null,
      { type: 'inlineCode', value: 'condition' },
      null,
      { type: 'text', value: 'text' },
      null,
      { type: 'inlineCode', value: 'condition2' },
      null,
      { type: 'text', value: 'text2' },
    ]
  );
});
