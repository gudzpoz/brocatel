import {
  Content, Link, Paragraph, Parent, Root,
} from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode, LuaSnippet, MetaArray, TextNode, TreeNode, ValueNode,
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

  parseBlock(block: Parent, parent: TreeNode | null): MetaArray {
    const array: MetaArray = { meta: { labels: {} }, chilren: [], parent };
    block.children.forEach((node) => {
      switch (node.type) {
        case 'paragraph':
          array.chilren.push(this.parseParagraph(node, array));
          break;
        default:
          this.vfile.message(`unsupported markdown type: ${node.type}`, node);
          break;
      }
    });
    return array;
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
  parseParagraph(para: Paragraph, parent: TreeNode): MetaArray | ValueNode {
    if (para.children.length === 0) {
      const empty: MetaArray = {
        meta: {},
        chilren: [],
        parent,
      };
      return empty;
    }
    if (para.children.length === 1 && para.children[0].type === 'link') {
      return this.parseLink(para.children[0], parent);
    }
    if (para.children[0].type === 'inlineCode') {
      const ifElse: IfElseNode = {
        condition: para.children[0].value,
        parent,
      };
      const striped = para;
      striped.children = striped.children.slice();
      // Just to prevent starting spaces getting converted to `&#x20`.
      striped.children[0] = {
        type: 'text',
        value: '|',
      };
      const text = this.toTextNode(para, parent);
      text.text = text.text.substring(1).trim();
      ifElse.ifThen = {
        meta: {},
        chilren: [text],
        parent: ifElse,
      };
      return ifElse;
    }
    return this.toTextNode(para, parent);
  }

  /**
   * Converts children of a paragraph to a text node.
   */
  toTextNode(para: Paragraph, parent: TreeNode): TextNode {
    this.checkChildren(
      para,
      (node) => node.type !== 'link' && node.type !== 'inlineCode',
      'links or inline code snippets in text are not supported',
    );
    const text: TextNode = {
      text: toMarkdown(para).trim(),
      parent,
    };
    return text;
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
  parseLink(link: Link, parent: TreeNode): LinkNode {
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
