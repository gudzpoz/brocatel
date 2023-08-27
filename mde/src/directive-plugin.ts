import { type MilkdownPlugin } from '@milkdown/ctx';
import {
  bulletListSchema, listItemSchema, paragraphSchema,
} from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { TextSelection } from '@milkdown/prose/state';
import {
  $inputRule, $nodeAttr, $nodeSchema, $remark,
} from '@milkdown/utils';

import { plugins } from 'brocatel-mdc/src/index';

export const remarkDirectivePlugin = $remark('remarkDirectivePlugin', () => plugins.remarkSimplifiedDirective as any);

const DIRECTIVE_NAME_TYPE = 'directiveName';
export const directiveNameAttr = $nodeAttr(DIRECTIVE_NAME_TYPE, () => ({ 'data-type': DIRECTIVE_NAME_TYPE }));
export const directiveNameSchema = $nodeSchema(DIRECTIVE_NAME_TYPE, (ctx) => ({
  content: 'text*',
  group: 'block',
  defining: true,
  parseDOM: [{ tag: `p[data-type="${DIRECTIVE_NAME_TYPE}"]` }],
  toDOM: (node) => ['p', ctx.get(directiveNameAttr.key)(node), ['code', 0]],
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: (node) => node.type.name === DIRECTIVE_NAME_TYPE,
    runner: (state, node) => {
      const top = state.top();
      if (top) {
        const name = node.textContent || 'nil';
        if (top.props) {
          top.props.name = name;
        } else {
          top.props = { name };
        }
      }
    },
  },
}));

const DIRECTIVE_TYPE = 'containerDirective';
export const directiveAttr = $nodeAttr(DIRECTIVE_TYPE, () => ({ 'data-type': DIRECTIVE_TYPE }));
export const directiveSchema = $nodeSchema(DIRECTIVE_TYPE, (ctx) => ({
  content: `${DIRECTIVE_NAME_TYPE} bullet_list`,
  group: 'block',
  defining: true,
  atom: false,
  parseDOM: [{
    tag: `div[data-type="${DIRECTIVE_TYPE}"]`,
  }],
  toDOM: (node) => ['div', ctx.get(directiveAttr.key)(node), 0],
  parseMarkdown: {
    match: (node) => node.type === DIRECTIVE_TYPE,
    runner: (state, node, type) => {
      const { name } = node as any;
      state
        .openNode(type, { name })
        .openNode(directiveNameSchema.type(ctx))
        .addText(name || 'nil')
        .closeNode()
        .next(node.children)
        .closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === DIRECTIVE_TYPE,
    runner: (state, node) => {
      state
        .openNode(DIRECTIVE_TYPE)
        .next(node.content)
        .closeNode();
    },
  },
}));

export const directiveInputRule = $inputRule((ctx) => new InputRule(
  /:::$/,
  (state, _, start, end) => {
    const pos = state.tr.doc.resolve(start);
    if (pos.node(pos.depth - 1).type.name === DIRECTIVE_NAME_TYPE) {
      return null;
    }
    const tr = state.tr.replaceRangeWith(
      start,
      end,
      directiveSchema.type(ctx).createChecked(null, [
        directiveNameSchema.type(ctx).createChecked(),
        bulletListSchema.type(ctx).createChecked(null, [
          listItemSchema.type(ctx).createChecked(null, [
            paragraphSchema.type(ctx).createChecked(),
          ]),
        ]),
      ]),
    );
    return tr.setSelection(new TextSelection(tr.doc.resolve(start + 1)));
  },
));

export const directivePlugin: MilkdownPlugin[] = [
  directiveNameAttr,
  directiveNameSchema,

  directiveAttr,
  directiveInputRule,
  directiveSchema,

  remarkDirectivePlugin,
].flat();
