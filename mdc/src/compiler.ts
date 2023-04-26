import { format } from 'lua-json';
import {
  Content, Link, Paragraph, Parent, PhrasingContent, Root,
} from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { Plugin } from 'unified';

import {
  IfElseNode,
  LinkNode, MetaArray, TextNode, TreeNode, ValueNode,
} from './ast';

/**
 * Splits a url with `|`, where `|` is escaped by `||`.
 */
function parseLink(s: string): string[] {
  const tokens = s.split('|');
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
    throw new SyntaxError('link incomplete');
  }
  return finalized;
}

/**
 * Makes sure that the node and all nodes under matches the given condition.
 */
function checkChildren(node: Content, condition: (node: Content) => boolean, msg: string) {
  if (condition(node)) {
    throw new SyntaxError(msg);
  }
  if ((node as Parent).children) {
    (node as Parent).children.forEach((child) => checkChildren(child, condition, msg));
  }
}

/**
 * Converts children of a paragraph to a text node.
 */
function toTextNode(nodes: PhrasingContent[], parent: TreeNode): TextNode {
  const para: Paragraph = {
    type: 'paragraph',
    children: nodes,
  };
  checkChildren(
    para,
    (node) => node.type === 'link' || node.type === 'inlineCode',
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
function linkToLink(link: Link, parent: TreeNode): LinkNode {
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
    link: parseLink(link.url),
    parent,
    rootName,
  };
  if (!linkNode.rootName) {
    delete linkNode.rootName;
  }
  return linkNode;
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
function convertParagraph(para: Paragraph, parent: TreeNode): MetaArray | ValueNode {
  if (para.children.length === 0) {
    const empty: MetaArray = {
      meta: {},
      chilren: [],
      parent,
    };
    return empty;
  }
  if (para.children.length === 1 && para.children[0].type === 'link') {
    return linkToLink(para.children[0], parent);
  }
  if (para.children[0].type === 'inlineCode') {
    const ifElse: IfElseNode = {
      condition: para.children[0].value,
      parent,
    };
    ifElse.ifThen = {
      meta: {},
      chilren: [toTextNode(para.children.slice(1), parent)],
      parent: ifElse,
    };
    return ifElse;
  }
  return toTextNode(para.children, parent);
}

const attachBrocatelCompiler: Plugin = function plugin() {
  /**
   * Transforms the mdast into our own.
   */
  function transform(root: Root): MetaArray {
    const current: MetaArray = {
      meta: {},
      chilren: [],
      parent: null,
    };
    root.children.forEach((node) => {
      switch (node.type) {
        case 'paragraph':
          current.chilren.push(convertParagraph(node, current));
          break;
        default:
          break;
      }
    });
    return current;
  }
  /**
   * TODO: Transforms the AST into our Lua format.
   */
  function finalize(root: any): MetaArray {
    const node = root;
    delete node.parent;
    Object.values(node).forEach((v) => {
      if (v instanceof Object) {
        finalize(v);
      }
    });
    return node;
  }
  function compile(root: MetaArray): string {
    return format(root);
  }
  this.Compiler = (root: Root) => compile(finalize(transform(root)));
};

export default attachBrocatelCompiler;
