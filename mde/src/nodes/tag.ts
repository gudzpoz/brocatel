import { Ctx, type MilkdownPlugin } from '@milkdown/ctx';
import { EditorState, TextSelection } from '@milkdown/prose/state';
import {
  $command, $nodeAttr, $nodeSchema,
} from '@milkdown/utils';

const TEXT_DIRECTIVE_NAME_TYPE = 'textDirectiveName';
export const textDirectiveNameAttr = $nodeAttr(
  TEXT_DIRECTIVE_NAME_TYPE,
  () => ({ 'data-type': TEXT_DIRECTIVE_NAME_TYPE }),
);
export const textDirectiveNameSchema = $nodeSchema(TEXT_DIRECTIVE_NAME_TYPE, (ctx) => ({
  content: 'text*',
  group: 'inline',
  inline: true,
  isolating: true,
  code: true,
  atom: false,
  allowGapCursor: true,
  attrs: {
    name: {
      default: 'nil',
    },
  },
  parseDOM: [{ tag: `span[data-type="${TEXT_DIRECTIVE_NAME_TYPE}"]` }],
  toDOM: (node) => ['span', ctx.get(textDirectiveNameAttr.key)(node), 0],
  parseMarkdown: {
    match: (node) => node.type === TEXT_DIRECTIVE_NAME_TYPE,
    runner: (state, node, type) => {
      const { name } = node as any;
      state
        .openNode(type, { name })
        .next({ type: 'text', value: name })
        .closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === TEXT_DIRECTIVE_NAME_TYPE,
    runner: () => {},
  },
}));

const TEXT_DIRECTIVE_TYPE = 'textDirective';
export const textDirectiveAttr = $nodeAttr(
  TEXT_DIRECTIVE_TYPE,
  () => ({ 'data-type': TEXT_DIRECTIVE_TYPE }),
);
export const textDirectiveSchema = $nodeSchema(TEXT_DIRECTIVE_TYPE, (ctx) => ({
  content: `${TEXT_DIRECTIVE_NAME_TYPE} text*`,
  group: 'inline',
  inline: true,
  isolating: true,
  atom: false,
  allowGapCursor: true,
  parseDOM: [{ tag: `span[data-type="${TEXT_DIRECTIVE_TYPE}"]` }],
  toDOM: (node) => ['span', ctx.get(textDirectiveAttr.key)(node), 0],
  parseMarkdown: {
    match: (node) => node.type === TEXT_DIRECTIVE_TYPE,
    runner: (state, node, type) => {
      const { name } = node as any;
      state
        .openNode(type)
        .next({ type: TEXT_DIRECTIVE_NAME_TYPE, name })
        .next(node.children)
        .closeNode();
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === TEXT_DIRECTIVE_TYPE,
    runner: (state, node) => {
      const name = node.firstChild;
      if (!name) {
        return;
      }
      state.openNode(
        TEXT_DIRECTIVE_TYPE,
        undefined,
        {
          name: name.textContent.replace(/\W+/g, ''),
        },
      )
        .next(node.content)
        .closeNode();
    },
  },
}));

export type InsertTextDirectivePayload = {
  name?: string;
};

function insertTextDirective(
  ctx: Ctx,
  state: EditorState,
  name?: string,
  range?: { from: number, to: number },
) {
  const { from, to } = range ?? state.selection;
  const tr = state.tr.replaceRangeWith(
    from,
    to,
    textDirectiveSchema.type(ctx).create({ name }),
  );
  return tr.setSelection(new TextSelection(tr.doc.resolve(from)));
}

const insertTextDirectiveCommand = $command(
  'insertTextDirective',
  (ctx) => (payload: InsertTextDirectivePayload = {}) => (state, dispatch) => {
    const tr = insertTextDirective(ctx, state, payload.name);
    if (tr) {
      if (dispatch) {
        dispatch(tr);
      }
      return true;
    }
    return false;
  },
);

export const tagPlugin: MilkdownPlugin[] = [
  textDirectiveNameAttr,
  textDirectiveNameSchema,

  textDirectiveAttr,
  textDirectiveSchema,
  insertTextDirectiveCommand,
].flat();
