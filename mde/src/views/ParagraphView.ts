import { commandsCtx } from '@milkdown/core';
import { Ctx } from '@milkdown/ctx';
import { updateLinkCommand } from '@milkdown/preset-commonmark';
import { Node } from '@milkdown/prose/model';
import { TextSelection } from '@milkdown/prose/state';
import { EditorView, type NodeView } from '@milkdown/prose/view';

/**
 * A view for special paragraphs (containing only a link (a goto statement),
 * or only an inline code (a conditional statement)).
 */
export default class ParagraphView implements NodeView {
  dom: HTMLSpanElement;

  contentDOM?: HTMLElement;

  linkInput?: HTMLInputElement;

  linkIcon?: HTMLAnchorElement;

  type: 'link' | 'code' | 'conditional' | 'normal';

  constructor(ctx: Ctx, node: Node, view: EditorView, getPos: () => number | undefined) {
    this.dom = document.createElement('p');
    this.contentDOM = this.dom;
    this.type = ParagraphView.getType(node);
    switch (this.type) {
      case 'link': {
        this.dom.classList.add('link');
        const link = document.createElement('span');
        const input = document.createElement('input');
        input.classList.add('not-prose');
        const icon = document.createElement('a');
        icon.classList.add('not-prose');
        icon.innerText = '🔗';
        icon.contentEditable = 'false';
        input.addEventListener('change', () => {
          const pos = getPos();
          if (pos) {
            ctx.get(commandsCtx).call(updateLinkCommand.key, {
              href: input.value,
            });
          }
        });
        input.addEventListener('focus', () => {
          const pos = getPos();
          if (pos) {
            const { state } = view;
            const { tr } = state;
            view.dispatch(state.tr.setSelection(new TextSelection(tr.doc.resolve(pos + 1))));
          }
        });
        this.contentDOM = link;
        this.linkInput = input;
        this.linkIcon = icon;
        this.dom.append(link, input, icon);
        this.update(node);
        break;
      }
      case 'code':
      case 'conditional':
      case 'normal':
      default:
        this.contentDOM = this.dom;
        break;
    }
  }

  update(node: Node) {
    if (node.type.name !== 'paragraph' || this.type !== ParagraphView.getType(node)) {
      return false;
    }
    if (this.type === 'link') {
      const { href } = node.firstChild!.marks[0]!.attrs;
      (this.contentDOM as HTMLAnchorElement).href = href;
      this.linkInput!.value = href;
      this.linkIcon!.href = href;
    }
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  ignoreMutation(mutation: MutationRecord) {
    return (mutation.target as HTMLElement).classList.contains('not-prose');
  }

  static isMarkedText(node: Node | null, mark: 'inlineCode' | 'link') {
    if (node?.isText) {
      if (node.marks.length === 1 && node.marks[0].type.name === mark) {
        return true;
      }
    }
    return false;
  }

  static getType(node: Node): typeof ParagraphView.prototype.type {
    const count = node.childCount;
    if (count === 0) {
      return 'normal';
    }
    if (count === 1) {
      if (ParagraphView.isMarkedText(node.child(0), 'link')) {
        return 'link';
      }
    }
    if (ParagraphView.isMarkedText(node.child(0), 'inlineCode')) {
      if (count === 1) {
        return 'code';
      }
      return 'conditional';
    }
    return 'normal';
  }
}
