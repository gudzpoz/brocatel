import { type MilkdownPlugin } from '@milkdown/ctx';
import { InputRule } from '@milkdown/prose/inputrules';
import {
  $command,
  $inputRule, $nodeAttr, $nodeSchema, $remark,
} from '@milkdown/utils';

import { mdxForMarkdown } from '@brocatel/md';

export const remarkMdxPlugin = $remark('remarkMdxPlugin', () => mdxForMarkdown);

const MDX_AST_TYPE = 'mdxTextExpression';

export const mdxInlineAttr = $nodeAttr(MDX_AST_TYPE, () => ({ 'data-type': MDX_AST_TYPE }));

export const mdxInlineSchema = $nodeSchema(MDX_AST_TYPE, (ctx) => ({
  content: 'text*',
  group: 'inline',
  inline: true,
  code: true,
  isolating: true,
  atom: false,
  allowGapCursor: true,
  parseDOM: [{ tag: `code[data-type="${MDX_AST_TYPE}"]` }],
  toDOM: (node) => ['code', ctx.get(mdxInlineAttr.key)(node), 0],
  parseMarkdown: {
    match: (node) => node.type === MDX_AST_TYPE,
    runner: (state, node, type) => {
      state.openNode(type);
      const text = node.value as string;
      if (text !== '') {
        state.next({ type: 'text', value: text });
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === MDX_AST_TYPE,
    runner: (state, node) => {
      state
        .openNode(MDX_AST_TYPE, node.textContent)
        .closeNode();
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

export const toggleMdxInlineCommand = $command(
  'toggleMdxInlineCommand',
  (ctx) => () => (state, dispatch) => {
    const { selection } = state;
    const text = state.doc.cut(selection.from, selection.to).textContent;
    const node = mdxInlineSchema.type(ctx).create(null, text ? state.schema.text(text) : null);
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(node));
    }
    return true;
  },
);

// We need no input rules since the inline-sync plugin does it for us.

export const mdxPlugin: MilkdownPlugin[] = [
  remarkMdxPlugin,
  mdxInlineAttr,
  mdxInlineEscapeRule,
  mdxInlineSchema,
  toggleMdxInlineCommand,
].flat();
