import { MilkdownPlugin } from '@milkdown/ctx';
import { InputRule } from '@milkdown/prose/inputrules';
import {
  $inputRule, $markAttr, $markSchema, $remark,
} from '@milkdown/utils';

import { plugins } from 'brocatel-mdc/src/index';

export const remarkMdxPlugin = $remark('remarkMdxPlugin', () => plugins.remarkInlineMdx as any);

const MDX_AST_TYPE = 'mdxTextExpression';

export const mdxInlineAttr = $markAttr(MDX_AST_TYPE);

export const mdxInlineSchema = $markSchema(MDX_AST_TYPE, (ctx) => ({
  code: true,
  inclusive: false,
  parseDOM: [{
    tag: `code[data-type="${MDX_AST_TYPE}"]`,
  }],
  toDOM: (mark) => [
    'code',
    {
      'data-type': MDX_AST_TYPE,
      ...ctx.get(mdxInlineAttr.key)(mark),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === MDX_AST_TYPE,
    runner: (state, node, type) => {
      state
        .openMark(type)
        .addText(node.value as string)
        .closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === MDX_AST_TYPE,
    runner: (state, mark, node) => {
      state.withMark(mark, MDX_AST_TYPE, node.text || '');
    },
  },
}));

// Workaround: no way to escape curly brackets.
export const mdxInlineEscapeRule = [
  $inputRule(() => new InputRule(/\\\{$/, '\uFF5B')),
  $inputRule(() => new InputRule(/\uFF5B[^{]*(\})$/, '\uFF5D')),
];

// Workaround: mdx at the beginning of line not recognized.
export const mdxInlineInputRule = $inputRule((ctx) => new InputRule(
  /^\{(.+)\}$/,
  (state, _, start, end) => state.tr
    .addMark(start + 1, end, mdxInlineSchema.type(ctx).create())
    .delete(start, start + 1),
));

// We need no input rules since the inline-sync plugin does it for us.

export const mdxPlugin: MilkdownPlugin[] = [
  remarkMdxPlugin,
  mdxInlineAttr,
  mdxInlineEscapeRule,
  mdxInlineInputRule,
  mdxInlineSchema,
].flat();
