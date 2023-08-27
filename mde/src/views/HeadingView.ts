import { Node } from '@milkdown/prose/model';
import { type NodeView } from '@milkdown/prose/view';
import { spec } from 'brocatel-mdc/src/index';

/**
 * A view for headings with viewable anchor ids.
 */
export default class HeadingView implements NodeView {
  dom: HTMLElement;

  contentDOM: HTMLElement;

  anchorDOM: HTMLAnchorElement;

  level: number;

  constructor(node: Node) {
    this.dom = document.createElement('h1');
    this.contentDOM = document.createElement('span');
    this.anchorDOM = document.createElement('a');
    this.anchorDOM.classList.add('show-anchor', 'not-prose');
    this.anchorDOM.setAttribute('contenteditable', 'false');
    this.anchorDOM.title = 'The anchor id. Click to copy.';
    this.anchorDOM.addEventListener('click', () => {
      this.anchorDOM.classList.add('copied');
      setTimeout(() => this.anchorDOM.classList.remove('copied'), 1000);
    });
    this.level = 0;
    this.update(node);
  }

  // eslint-disable-next-line class-methods-use-this
  ignoreMutation(mutation: MutationRecord) {
    const element = mutation.target as HTMLElement;
    return element.classList.contains('not-prose');
  }

  updateLevel(node: Node) {
    const level = Math.min(Math.max(node.attrs.level ?? 1, 1), 6);
    if (this.level !== level) {
      const { dom } = this;
      this.dom = document.createElement(`h${level}`);
      this.dom.classList.add('heading');
      dom.parentElement?.replaceChild(this.dom, dom);
      this.dom.append(this.contentDOM, this.anchorDOM);
      this.level = level;
    }
  }

  update(node: Node) {
    const id = spec.anchorer(node.textContent.trim());
    this.anchorDOM.innerText = id;
    this.anchorDOM.href = `#${id}`;
    this.updateLevel(node);
    this.dom.id = id;
    return true;
  }
}
