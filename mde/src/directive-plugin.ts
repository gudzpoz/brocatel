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

const DIRECTIVE_LABEL_TYPE = 'directiveLabel';
export const directiveLabelAttr = $nodeAttr(DIRECTIVE_LABEL_TYPE, () => ({ 'data-type': DIRECTIVE_LABEL_TYPE }));
export const directiveLabelSchema = $nodeSchema(DIRECTIVE_LABEL_TYPE, (ctx) => ({
  priority: 100,
  content: 'text*',
  group: 'block',
  parseDOM: [{ tag: `p[data-type="${DIRECTIVE_LABEL_TYPE}"]` }],
  toDOM: (node) => ['p', ctx.get(directiveLabelAttr.key)(node), ['code', 0]],
  parseMarkdown: {
    match: (node) => node.type === 'paragraph' && node.data?.[DIRECTIVE_LABEL_TYPE] === true,
    runner: (state, node, type) => {
      let text;
      if (node.children?.length === 1 && node.children[0].type === 'inlineCode') {
        text = (node.children[0] as unknown as { value: string }).value.trim();
      } else {
        text = '';
      }
      state.openNode(type);
      if (text !== '') {
        state.addText(text);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === DIRECTIVE_LABEL_TYPE,
    runner: (state, node) => {
      const text = node.textContent.trim();
      if (text !== '') {
        state
          .openNode('paragraph', undefined, { data: { [DIRECTIVE_LABEL_TYPE]: true } })
          .openNode('inlineCode', text)
          .closeNode()
          .closeNode();
      }
    },
  },
}));

const DIRECTIVE_TYPE = 'containerDirective';
export const directiveAttr = $nodeAttr(DIRECTIVE_TYPE, () => ({ 'data-type': DIRECTIVE_TYPE }));
export const directiveSchema = $nodeSchema(DIRECTIVE_TYPE, (ctx) => ({
  content: `${DIRECTIVE_LABEL_TYPE} bullet_list`,
  group: 'block',
  atom: false,
  attrs: {
    name: {
      default: 'nil',
    },
  },
  parseDOM: [{
    tag: `div[data-type="${DIRECTIVE_TYPE}"]`,
  }],
  toDOM: (node) => ['div', ctx.get(directiveAttr.key)(node), 0],
  parseMarkdown: {
    match: (node) => node.type === DIRECTIVE_TYPE,
    runner: (state, node, type) => {
      const { name } = node as any;
      state.openNode(type, { name });
      if (node.children?.[0]?.type !== 'paragraph') {
        state.next({
          type: 'paragraph',
          data: { [DIRECTIVE_LABEL_TYPE]: true },
          children: [{
            type: 'inlineCode',
            value: ' ',
          }],
        });
      }
      state
        .next(node.children)
        .closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === DIRECTIVE_TYPE,
    runner: (state, node) => {
      state
        .openNode(DIRECTIVE_TYPE, undefined, { name: node.attrs.name ?? 'nil' })
        .next(node.content)
        .closeNode();
    },
  },
}));

export const directiveInputRule = $inputRule((ctx) => new InputRule(
  /:::$/,
  (state, _, start, end) => {
    const pos = state.tr.doc.resolve(start);
    if (pos.node(pos.depth - 1).type.name === DIRECTIVE_LABEL_TYPE) {
      return null;
    }
    const tr = state.tr.replaceRangeWith(
      start,
      end,
      directiveSchema.type(ctx).createChecked(null, [
        directiveLabelSchema.type(ctx).createChecked(),
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
  directiveLabelAttr,
  directiveLabelSchema,

  directiveAttr,
  directiveInputRule,
  directiveSchema,

  remarkDirectivePlugin,
].flat();
