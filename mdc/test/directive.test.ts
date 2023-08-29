import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { assert, test } from 'vitest';
import { Paragraph, Root } from 'mdast';
import { ContainerDirective } from 'mdast-util-directive';
import { toMarkdown } from 'mdast-util-to-markdown';
import { VFile } from 'vfile';

import { directiveFromMarkdown, directiveToMarkdown } from '../src/directive';

const parser = unified()
  .use(remarkParse)
  .use(directiveFromMarkdown);

test('Parsing without label', () => {
  const ast = parser.runSync(parser.parse(':::a\n- a')) as Root;
  assert.lengthOf(ast.children, 1);
  const node = ast.children[0] as ContainerDirective;
  assert.equal(node.type, 'containerDirective');
  assert.lengthOf(node.children, 1);
});

test('Parsing with a label', () => {
  const ast = parser.runSync(parser.parse(':::a `10`\n- a')) as Root;
  assert.lengthOf(ast.children, 1);
  const node = ast.children[0] as ContainerDirective;
  assert.equal(node.type, 'containerDirective');
  assert.lengthOf(node.children, 2);
  const para = node.children[0] as Paragraph;
  assert.equal(para.type, 'containerDirectiveLabel');
  assert.lengthOf(para.children, 1);
  assert.equal(para.children[0].type, 'inlineCode');
});

function assertMatch(input: string) {
  const vfile = new VFile();
  const ast = parser.runSync(parser.parse(input), vfile) as Root;
  assert.isEmpty(vfile.messages, vfile.messages.map((m) => m.message).join(', '));
  assert.equal(
    toMarkdown(ast, {
      extensions: [directiveToMarkdown],
    }).trim(),
    input.trim(),
  );
}

test('Parsing and generating', () => {
  assertMatch('a');
  assertMatch(':::a\n\n*   a');
  assertMatch(':::a\n\n1.  a');
  assertMatch(':::a`10`\n\n*   a');

  assertMatch(`
> :::a\`10\`
>
> *   a`);

  assertMatch(`
:::a\`10\`

*   b

    :::c\`10\`

    *   d`);

  assertMatch(`
:::a

\`\`\`lua func
IP:set(arg:resolve(2))
\`\`\`

*   b`);

  assertMatch(`
:::loop\`10\`

*   :::switch\`a\`

    *   \`10\`

        b
    *   \`20\`

        c
    *   \`30\`

        d`);
});

function assertWarning(input: string, message: string) {
  const vfile = new VFile();
  parser.runSync(parser.parse(input), vfile);
  assert.include(vfile.messages.map((m) => m.message), message);
}

test('Parser warnings', () => {
  assertWarning(':::', 'invalid directive line');
  assertWarning(':::a b', 'invalid directive line');
  assertWarning(':::a', 'container directive without content');
  assertWarning(':::a *b*', 'unsupported element');
  assertWarning(':::a `b` c', 'unexpected element');
});
