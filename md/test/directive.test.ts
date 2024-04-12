import { assert, test } from 'vitest';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { directiveForMarkdown } from '../src';

const parser = unified()
  .use(remarkParse)
  .use(directiveForMarkdown)
  .use(function compiler() {
    this.compiler = () => '';
  });

test('Valid directives', async () => {
  assert.lengthOf(parser.processSync('Some\n\n:::name\n\n- Content').messages, 0);
  assert.lengthOf(parser.processSync('Some\n\n:::name`label`\n\n- Content').messages, 0);
  assert.lengthOf(parser.processSync('Some\n\n:::name `label`\n\n- Content').messages, 0);
  assert.lengthOf(
    parser.processSync('Some\n\n:::name\n\n```lua func\ndefinition\n```\n\n- Content').messages,
    0,
  );
});

test('Invalid directive line', async () => {
  assert.equal(
    parser.processSync('Some\n\n:::\n\n- Content').messages[0].message,
    'invalid directive line',
  );
  assert.equal(
    parser.processSync('Some\n\n::: `label`\n\n- Content').messages[0].message,
    'invalid directive line',
  );
  assert.equal(
    parser.processSync('Some\n\n::: *italics* `label`\n\n- Content').messages[0].message,
    'invalid directive line',
  );
});

test('Empty directive', async () => {
  assert.equal(
    parser.processSync('Some\n\n:::name').messages[0].message,
    'empty directive',
  );
  assert.equal(
    parser.processSync('Some\n\n:::name\n\n').messages[0].message,
    'empty directive',
  );
});

test('Wrong first element', async () => {
  assert.equal(
    parser.processSync('Some\n\n:::name\n\n```lua\ncontent\n```\n\n- Content').messages[0].message,
    'expecting a code block of lua func type after the directive block',
  );
  assert.equal(
    parser.processSync('Some\n\n:::name `label`\n\n```lua func\ncontent\n```\n\n- Content')
      .messages[0].message,
    'a labeled directive should not contain a lua func code block',
  );
  assert.equal(
    parser.processSync('Some\n\n:::name `label`\n\na\n\nb')
      .messages[0].message,
    'expecting a list after the directive block',
  );
});

test('Wrong second element', async () => {
  assert.equal(
    parser.processSync('Some\n\n:::name\n\n```lua func\ndefinition\n```\n\nText')
      .messages[0].message,
    'expecting a list after the code block',
  );
  assert.equal(
    parser.processSync('Some\n\n:::name\n\n```lua func\ndefinition\n```\n\n```lua func\n\ncode```')
      .messages[0].message,
    'expecting a list after the code block',
  );
});
