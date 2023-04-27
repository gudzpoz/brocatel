import { assert, test } from 'vitest';

import BrocatelCompiler from '../src/main';

const compiler = new BrocatelCompiler({});

test('Simplest plain text', async () => {
  assert.equal(await compiler.compile('hello'), '{{},"hello"}');
  assert.equal(await compiler.compile('hello\nhello'), '{{},"hello\\nhello"}');
  assert.equal(await compiler.compile('hello\n\nhello'), '{{},"hello","hello"}');
});

test('Tagged text', async () => {
  assert.equal(
    await compiler.compile('[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e",type="text"}}',
  );
  assert.equal(
    await compiler.compile('\\[a] [b] c [d] e'),
    '{{},{tags={"a","b"},text="c \\\\[d] e",type="text"}}',
  );
  assert.equal(
    await compiler.compile('\\\\[a] [b] c [d] e'),
    '{{},"\\\\[a] \\\\[b] c \\\\[d] e"}',
  );
});

test('Text with values', async () => {
  assert.equal(
    await compiler.compile('The {count} Names of God'),
    '{{},{text="The {v1} Names of God",type="text",values={v1=function()return(\ncount\n)end}}}',
  );
  assert.equal(
    await compiler.compile('The {count?} Names of God'),
    '{{},{plural="v1",text="The {v1} Names of God",type="text",values={v1=function()return(\ncount\n)end}}}',
  );
});
