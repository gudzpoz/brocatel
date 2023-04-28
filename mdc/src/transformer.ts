import {
  Content, Heading, Link, Paragraph, Parent, PhrasingContent, Root,
} from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { mdxExpressionToMarkdown, MDXTextExpression } from 'mdast-util-mdx-expression';
import { v4 as uuidv4 } from 'uuid';
import { VFile } from 'vfile';

import {
  IfElseNode,
  LinkNode, LuaSnippet, MetaArray, ParentEdge, TextNode, ValueNode,
} from './ast';

class AstTransformer {
  root: Root;

  vfile: VFile;

  /**
   * Other Markdown files that this file links to.
   */
  dependencies: Set<string>;

  /**
   * Unresolved links.
   */
  links: LinkNode[];

  /**
   * Global Lua snippets.
   */
  globalLua: LuaSnippet[];

  constructor(root: Root, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.dependencies = new Set<string>();
    this.links = [];
    this.globalLua = [];

    this.vfile.data.dependencies = this.dependencies;
    this.vfile.data.links = this.links;
    this.vfile.data.globalLua = this.globalLua;
  }

  transform(): MetaArray {
    return this.parseBlock(this.root, null);
  }

  /**
   * Makes sure that the node and all nodes under matches the given condition.
   */
  checkChildren(node: Content, condition: (node: Content) => boolean, msg: string) {
    if (!condition(node)) {
      this.vfile.message(msg, node);
    }
    if ((node as Parent).children) {
      (node as Parent).children.forEach((child) => this.checkChildren(child, condition, msg));
    }
  }

  parseBlock(block: Parent, parent: ParentEdge | null): MetaArray {
    const array: MetaArray = {
      meta: { labels: {}, refs: {} },
      chilren: [],
      node: block,
      parent,
    };
    // Levels of previous headings.
    const headings = [0];
    let current = array;
    block.children.forEach((node) => {
      switch (node.type) {
        case 'paragraph':
          current.chilren.push(this.parseParagraph(node, [current, [current.chilren.length + 2]]));
          break;
        case 'heading': {
          while (node.depth <= headings[headings.length - 1]) {
            headings.pop();
            current = current.parent?.[0] as MetaArray;
          }
          const nested: MetaArray = {
            meta: { labels: {}, label: this.extractHeadingLabel(node), refs: {} },
            chilren: [],
            parent: [current, [current.chilren.length + 2]],
            node,
          };
          current.chilren.push(nested);
          current = nested;
          headings.push(node.depth);
          break;
        }
        default:
          this.vfile.message(`unsupported markdown type: ${node.type}`, node);
          break;
      }
    });
    return array;
  }

  extractHeadingLabel(node: Heading) {
    if (node.children.length === 0) {
      this.vfile.message('unexpected empty heading', node);
      return '';
    }
    if (node.children.length > 1 || node.children[0].type !== 'text') {
      this.vfile.message('unexpected complex heading', node);
      return '';
    }
    return node.children[0].value;
  }

  /**
   * Converts a mdast paragraph to our own AST.
   *
   * Paragraphs should be leaf nodes, so handling them are quite simple.
   *
   * A paragraph is expected to:
   * - contain only a link (`LinkNode`),
   * - or starts with a inline code snippet (`IfElseNode` without `else` branch),
   * - or contains no link or inline code at all (normal texts).
   *
   * @param para the paragraph
   * @param parent the parent
   * @returns converted
   */
  parseParagraph(para: Paragraph, parent: ParentEdge): MetaArray | ValueNode {
    if (para.children.length === 0) {
      const empty: MetaArray = {
        meta: { labels: {}, refs: {} },
        chilren: [],
        parent,
        node: para,
      };
      return empty;
    }
    if (para.children.length === 1 && para.children[0].type === 'link') {
      const link = this.parseLink(para.children[0], parent);
      this.links.push(link);
      return link;
    }
    if (para.children[0].type === 'inlineCode') {
      const ifElse: IfElseNode = {
        condition: para.children[0].value,
        node: para,
        parent,
      };
      const striped = para;
      striped.children = striped.children.slice();
      // Just to prevent starting spaces getting converted to `&#x20`.
      striped.children[0] = {
        type: 'text',
        value: '|',
      };
      const tags = this.extractTags(striped.children[1]);
      const text = this.toTextNode(para, tags, parent);
      text.text = text.text.substring(1).trim();
      ifElse.ifThen = {
        meta: { labels: {}, refs: {} },
        chilren: [text],
        node: para,
        parent: [ifElse, [1]],
      };
      return ifElse;
    }
    const tags = this.extractTags(para.children[0]);
    const text = this.toTextNode(para, tags, parent);
    return text;
  }

  extractTags(node: PhrasingContent | undefined): string[] {
    if (!node || node.type !== 'text') {
      return [];
    }
    const textNode = node;
    textNode.value = textNode.value.trimStart();
    if (textNode.value.startsWith('\\')) {
      textNode.value = textNode.value.substring(1).trimStart();
      return [];
    }

    const tags = [];
    while (textNode.value.startsWith('[')) {
      const i = textNode.value.indexOf(']');
      if (i === -1) {
        this.vfile.message('possibly incomplete tag', textNode);
        break;
      }
      tags.push(textNode.value.substring(1, i));
      textNode.value = textNode.value.substring(i + 1).trimStart();
    }
    return tags;
  }

  /**
   * Converts children of a paragraph to a text node.
   */
  toTextNode(para: Paragraph, tags: string[], parent: ParentEdge): TextNode {
    const references: { [id: string]: [string, MDXTextExpression] } = {};
    this.checkChildren(
      para,
      (n) => {
        const node = n;
        if (node.type === 'mdxTextExpression') {
          const id = uuidv4();
          references[id] = [node.value, node];
          node.value = id;
        }
        return node.type !== 'link' && node.type !== 'inlineCode';
      },
      'links or inline code snippets in text are not supported',
    );
    const [text, values, plural] = this.replaceReferences(toMarkdown(para, {
      extensions: [mdxExpressionToMarkdown],
    }).trim(), references);
    const textNode: TextNode = {
      text,
      tags,
      plural,
      values,
      parent,
      node: para,
    };
    return textNode;
  }

  replaceReferences(
    s: string,
    references: { [id: string]: [string, MDXTextExpression] },
  ): [string, { [id: string]: string }, string] {
    let i = 1;
    let str = s;
    const redirected: { [id: string]: string } = {};
    let plural = '';
    Object.entries(references).forEach(([k, [value, node]]) => {
      let v = value;
      v = v.trim();
      if (v.length === 0) {
        this.vfile.message('empty expression', node);
      }
      while (str.includes(`v${i}`)) {
        i += 1;
      }
      str = str.replace(k, `v${i}`);
      if (v.endsWith('?')) {
        if (plural) {
          this.vfile.message('multiple plural expression defined', node);
        }
        plural = `v${i}`;
        v = v.substring(0, v.length - 1).trim();
      }
      redirected[`v${i}`] = v;
      i += 1;
    });
    return [str, redirected, plural];
  }

  /**
   * Parses a link.
   *
   * The link title will get treated as the root node name,
   * while the url will be split by `|`.
   *
   * @param link the link
   * @param parent the parent
   * @returns a link node
   */
  parseLink(link: Link, parent: ParentEdge): LinkNode {
    let rootName = link.title || undefined;
    if (!rootName && link.children.length > 0) {
      const para: Paragraph = {
        type: 'paragraph',
        children: link.children,
      };
      rootName = toMarkdown(para);
    }
    if (rootName) {
      rootName.toLowerCase().endsWith('.md');
      rootName = rootName.substring(0, rootName.length - 3);
    }
    const linkNode: LinkNode = {
      link: this.parseLinkUrl(link),
      node: link,
      parent,
      rootName,
    };
    if (!linkNode.rootName) {
      delete linkNode.rootName;
    }
    return linkNode;
  }

  /**
   * Splits a url with `|`, where `|` is escaped by `||`.
   */
  parseLinkUrl(link: Link): string[] {
    const tokens = link.url.split('|');
    const finalized: string[] = [];
    let token = null;
    for (let i = 0; i < tokens.length; i += 1) {
      if (token === null) {
        token = tokens[i];
      } else {
        token += tokens[i];
      }
      if (!token.endsWith('|')) {
        finalized.push(token);
        token = null;
      }
    }
    if (token !== null) {
      this.vfile.message('link incomplete', link);
      finalized.push(token);
    }
    return finalized;
  }
}

export default AstTransformer;
