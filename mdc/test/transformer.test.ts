import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { VFile } from 'vfile';
import { assert, test } from 'vitest';

import {
  LuaArray, LuaCode, LuaElement, LuaIfElse,
} from '../src/ast';
import { directiveFromMarkdown } from '../src/directive';
import expandMacro from '../src/expander';
import transformAst from '../src/transformer';

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
  .use(transformAst);

function parse(input: string): LuaArray {
  const vfile = new VFile();
  const ast = parser.runSync(parser.parse(input), vfile) as LuaArray;
  assert.isEmpty(
    vfile.messages.filter((e) => e.fatal !== null),
    vfile.messages.map((m) => m.message).join(', '),
  );
  return ast;
}

function assertOnlyChild(root: LuaArray): LuaElement {
  assert.lengthOf(root.children, 1);
  return root.children[0];
}

test('Transform text', () => {
  assert.deepInclude(assertOnlyChild(parse('a')), { type: 'text', text: 'a' });
  assert.deepInclude(
    assertOnlyChild(parse('a {a} b {b}')),
    { type: 'text', text: 'a {v1} b {v2}', values: { v1: 'a', v2: 'b' } },
  );
  assert.deepInclude(
    assertOnlyChild(parse('[a] [b] a {a} b {b}')),
    {
      type: 'text', text: 'a {v1} b {v2}', values: { v1: 'a', v2: 'b' }, tags: { a: '', b: '' },
    },
  );
  assert.deepInclude(
    assertOnlyChild(parse('[a] [b] a {a .. b?} b {b}')),
    {
      type: 'text', text: 'a {v1} b {v2}', values: { v1: 'a .. b', v2: 'b' }, tags: { a: '', b: '' }, plural: 'v1',
    },
  );
});

test('Transform link', () => {
  assert.deepInclude(assertOnlyChild(parse('[](#a)')), { type: 'link', labels: ['a'] });
  assert.deepInclude(assertOnlyChild(parse('[](main.md#a#b)')), { type: 'link', labels: ['a', 'b'], root: 'main' });
  assert.deepInclude(assertOnlyChild(parse('[](main#a#b)')), { type: 'link', labels: ['main', 'a', 'b'] });
  assert.deepInclude(assertOnlyChild(parse('[](#main.md#a#b)')), { type: 'link', labels: ['mainmd', 'a', 'b'] });
  assert.deepInclude(
    assertOnlyChild(parse('[main](www.example.com)')),
    { type: 'text', text: '[main](www.example.com)' },
  );
});

test('Transform code blocks', () => {
  assert.deepInclude(assertOnlyChild(parse('`a`')), { type: 'func', code: 'a' });
  assert.deepInclude(assertOnlyChild(parse('```lua\na\n```')), { type: 'func', code: 'a' });
  assert.deepInclude(assertOnlyChild(parse('```lua global\na\n```')), { type: 'func', code: '' });
  assert.deepInclude(assertOnlyChild(parse('```lua macro\na\n```')), { type: 'func', code: '' });
});

function assertBranch(node: LuaArray | undefined, text: string) {
  assert.isOk(node);
  const array = node!;
  assert.deepInclude(array, { type: 'array' });
  const inner = array.children;
  assert.lengthOf(inner, 1);
  assert.deepInclude(inner[0], { type: 'text', text });
}

test('Transform simple if-else', () => {
  const parsed = assertOnlyChild(parse('`ok` ok')) as LuaIfElse;
  assert.deepInclude(parsed, { type: 'if-else', condition: 'ok' });
  assert.lengthOf(parsed.children, 1);
  assertBranch(parsed.children[0], 'ok');
});

test('Transform manual if-else', () => {
  const parsed = assertOnlyChild(parse(':::if`ok`\n- ok\n- no ok')) as LuaIfElse;
  assert.deepInclude(parsed, { type: 'if-else', condition: 'ok' });
  assert.lengthOf(parsed.children, 2);
  assertBranch(parsed.children[0], 'ok');
  assertBranch(parsed.children[1], 'no ok');
});

test('Transform FUNC.S_ONCE func', () => {
  const parsed = assertOnlyChild(parse('- a\n- b')) as LuaCode;
  assert.deepInclude(parsed, { type: 'func', code: 'FUNC.S_ONCE(args)' });
  assert.lengthOf(parsed.children, 2);
  assertBranch(parsed.children[0], 'a');
  assertBranch(parsed.children[1], 'b');
});

test('Transform FUNC.S_RECUR func', () => {
  const parsed = assertOnlyChild(parse('1. a\n2. b')) as LuaCode;
  assert.deepInclude(parsed, { type: 'func', code: 'FUNC.S_RECUR(args)' });
  assert.lengthOf(parsed.children, 2);
  assertBranch(parsed.children[0], 'a');
  assertBranch(parsed.children[1], 'b');
});

test('Transform some func', () => {
  const parsed = assertOnlyChild(parse(':::do`FUNC.WHATEVER`\n- c\n - d')) as LuaCode;
  assert.deepInclude(parsed, { type: 'func', code: 'FUNC.WHATEVER(args)' });
  assert.lengthOf(parsed.children, 2);
  assertBranch(parsed.children[0], 'c');
  assertBranch(parsed.children[1], 'd');
});

test('Transform heading levels', () => {
  const parsed = parse('a\n# b\nc\n### d\ne\n## f\ng');
  assert.lengthOf(parsed.children, 2);
  assert.deepInclude(parsed.children[0], { type: 'text', text: 'a' });
  const level1 = parsed.children[1] as LuaArray;
  assert.equal(level1.data?.label, 'b');
  assert.lengthOf(level1.children, 3);
  assert.deepInclude(level1.children[0], { type: 'text', text: 'c' });
  assert.equal(level1.children[1].data?.label, 'd');
  assertBranch(level1.children[1] as LuaArray, 'e');
  assert.equal(level1.children[2].data?.label, 'f');
  assertBranch(level1.children[2] as LuaArray, 'g');
});

test('Functions', () => {
  const parsed = parse('# func {}\n[{}](#func)\n\n[{a=1}](#func)\n');
  assert.lengthOf(parsed.children, 2);
  assert.deepInclude(parsed.children[0], { type: 'func', code: 'END()' });
  assert.deepInclude(parsed.children[1], { type: 'array' });

  const func = parsed.children[1] as LuaArray;
  assert.isOk(func.data?.routine?.parameters);
  assert.lengthOf(func.data?.routine?.parameters!, 0);
  assert.lengthOf(func.children, 3);
  assert.deepInclude(func.children[0], { type: 'link', labels: ['func'], params: '{}' });
  assert.deepInclude(func.children[1], { type: 'link', labels: ['func'], params: '{a=1}' });
  assert.deepInclude(func.children[2], { type: 'func', code: 'END()' });
});
