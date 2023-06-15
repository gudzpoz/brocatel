import { assert, test } from 'vitest';
import { overwrite, shallowCopy, subParagraph } from '../src/utils';

test('Shallow copy', () => {
  const deep = { a: 1, b: 'c', d: { e: 'f' } };
  const copy = shallowCopy(deep);
  assert.deepEqual(copy, deep);
  copy.a = 2;
  copy.b = 'd';
  copy.d.e = 'g';
  assert.deepEqual(deep, { a: 1, b: 'c', d: { e: 'g' } });
});

test('Overwriting fields', () => {
  assert.deepEqual(
    overwrite({
      type: 'a',
      data: { b: 'c' },
      position: { d: 'e' },
    } as any, { type: 'b', data: { f: 'g' } }),
    { type: 'b', data: { f: 'g' }, position: { d: 'e' } } as any,
  );
});

test('Subparagraph', () => {
  assert.deepEqual(
    subParagraph(
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '  a' },
          { type: 'text', value: ' ' },
          {
            type: 'inlineCode',
            value: 'b',
            position: {
              start: { line: 1, column: 1 },
              end: { line: 2, column: 1 },
            },
          },
        ],
      },
      1,
    ),
    {
      type: 'paragraph',
      children: [{
        type: 'inlineCode',
        value: 'b',
        position: {
          start: { line: 1, column: 1 },
          end: { line: 2, column: 1 },
        },
      }],
    },
  );
});
