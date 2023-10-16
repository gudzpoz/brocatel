import { Ctx, type MilkdownPlugin } from '@milkdown/ctx';
import {
  bulletListSchema, listItemSchema, paragraphSchema,
} from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { EditorState, TextSelection } from '@milkdown/prose/state';
import {
  $command,
  $inputRule, $nodeAttr, $nodeSchema, $remark,
} from '@milkdown/utils';

import { directiveForMarkdown } from '@brocatel/md';

export const remarkDirectivePlugin = $remark('remarkDirectivePlugin', () => directiveForMarkdown);

const DIRECTIVE_LABEL_TYPE = 'containerDirectiveLabel';
export const directiveLabelAttr = $nodeAttr(DIRECTIVE_LABEL_TYPE, () => ({ 'data-type': DIRECTIVE_LABEL_TYPE }));
export const directiveLabelSchema = $nodeSchema(DIRECTIVE_LABEL_TYPE, (ctx) => ({
  content: 'text*',
  group: 'block',
  marks: '',
  defining: true,
  code: true,
  parseDOM: [{ tag: `div[data-type="${DIRECTIVE_LABEL_TYPE}"]` }],
  toDOM: (node) => ['div', ctx.get(directiveLabelAttr.key)(node), ['span', 0]],
  parseMarkdown: {
    match: (node) => node.type === DIRECTIVE_LABEL_TYPE,
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
      const text = node.textContent.trim().replace(/\s+/g, ' ');
      if (text !== '') {
        state
          .openNode(DIRECTIVE_LABEL_TYPE)
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
  defining: true,
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
      if (node.children?.[0]?.type !== DIRECTIVE_LABEL_TYPE) {
        state.next({
          type: DIRECTIVE_LABEL_TYPE,
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

export type InsertDirectivePayload = {
  name?: string;
  label?: string;
};

function insertDirective(
  ctx: Ctx,
  state: EditorState,
  range?: { from: number, to: number },
  name?: string,
  label?: string,
) {
  const { from, to } = range ?? state.selection;
  const pos = state.tr.doc.resolve(from);
  if (pos.node(pos.depth - 1).type.name === DIRECTIVE_TYPE) {
    return null;
  }
  const tr = state.tr.replaceRangeWith(
    from,
    to,
    directiveSchema.type(ctx).createChecked({ name }, [
      directiveLabelSchema.type(ctx).createChecked(null, label ? state.schema.text(label) : null),
      bulletListSchema.type(ctx).createChecked(null, [
        listItemSchema.type(ctx).createChecked(null, [
          paragraphSchema.type(ctx).createChecked(),
        ]),
      ]),
    ]),
  );
  return tr.setSelection(new TextSelection(tr.doc.resolve(from + 1)));
}

export const insertDirectiveCommand = $command(
  'insertDirective',
  (ctx) => (payload: InsertDirectivePayload = {}) => (state, dispatch) => {
    const tr = insertDirective(ctx, state, undefined, payload.name, payload.label);
    if (tr) {
      if (dispatch) {
        dispatch(tr);
      }
      return true;
    }
    return false;
  },
);

export const insertDirectiveInputRule = $inputRule((ctx) => new InputRule(
  /^:::(?<name>[a-z]*)?(?:`(?<label>[^`]*)`)?[\s\n]$/,
  (state, match, start, end) => {
    const { name, label } = match.groups as InsertDirectivePayload;
    return insertDirective(ctx, state, { from: start, to: end }, name, label);
  },
));

export const directivePlugin: MilkdownPlugin[] = [
  directiveLabelAttr,
  directiveLabelSchema,

  directiveAttr,
  directiveSchema,

  insertDirectiveCommand,
  insertDirectiveInputRule,

  remarkDirectivePlugin,
].flat();
