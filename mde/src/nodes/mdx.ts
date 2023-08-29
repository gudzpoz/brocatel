import { type MilkdownPlugin } from '@milkdown/ctx';
import { toggleMark } from '@milkdown/prose/commands';
import { InputRule } from '@milkdown/prose/inputrules';
import {
  $command,
  $inputRule, $markAttr, $markSchema, $remark,
} from '@milkdown/utils';

import { mdxForMarkdown } from 'brocatel-md';

export const remarkMdxPlugin = $remark('remarkMdxPlugin', () => mdxForMarkdown);

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

export const BIG_LEFT_BRACE = '\uFF5B';
export const BIG_RIGHT_BRACE = '\uFF5D';

// Workaround: no way to escape curly brackets.
export const mdxInlineEscapeRule = [
  $inputRule(() => new InputRule(/\\\{$/, BIG_LEFT_BRACE)),
  $inputRule(() => new InputRule(/\uFF5B[^{]*(\})$/, BIG_RIGHT_BRACE)),
];

// Workaround: mdx at the beginning of line not recognized.
export const mdxInlineInputRule = $inputRule((ctx) => new InputRule(
  /^\{(.+)\}$/,
  (state, _, start, end) => state.tr
    .addMark(start + 1, end, mdxInlineSchema.type(ctx).create())
    .delete(start, start + 1),
));

export const toggleMdxInlineCommand = $command(
  'toggleMdxInlineCommand',
  (ctx) => () => toggleMark(mdxInlineSchema.type(ctx)),
);

// We need no input rules since the inline-sync plugin does it for us.

export const mdxPlugin: MilkdownPlugin[] = [
  remarkMdxPlugin,
  mdxInlineAttr,
  mdxInlineEscapeRule,
  mdxInlineInputRule,
  mdxInlineSchema,
  toggleMdxInlineCommand,
].flat();
