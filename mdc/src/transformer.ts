import {
  Blockquote,
  Code,
  Content, Heading, Link, List, Paragraph, Parent, PhrasingContent, Root,
} from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { ContainerDirective, directiveToMarkdown } from 'mdast-util-directive';
import { mdxExpressionToMarkdown, MDXTextExpression } from 'mdast-util-mdx-expression';
import { v4 as uuidv4 } from 'uuid';
import { VFile } from 'vfile';

import {
  IfElseNode,
  LinkNode, LuaNode, LuaSnippet, metaArray, MetaArray, ParentEdge, SelectNode, TextNode, ValueNode,
} from './ast';
import { runLua, wrap } from './lua';

import builtInMacros from './macros/builtin.lua?raw';

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

  /**
   * Macro Lua snippets.
   */
  macros: LuaSnippet[];

  constructor(root: Root, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.dependencies = new Set<string>();
    this.links = [];
    this.globalLua = [];
    this.macros = [];

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
    const array = metaArray(block, parent);
    // Levels of previous headings.
    const headings = [0];
    let current = array;
    block.children.forEach((node) => {
      switch (node.type) {
        case 'paragraph':
          current.children.push(
            this.parseParagraph(node, [current, [current.children.length + 2]]),
          );
          break;
        case 'list':
          current.children.push(
            this.parseSelection(node, [current, [current.children.length + 2]]),
          );
          break;
        case 'code':
          current.children.push(
            this.parseCodeBlock(node, [current, [current.children.length + 2]]),
          );
          break;
        case 'blockquote':
          current.children.push(
            this.parseBlockquote(node, [current, [current.children.length + 2]]),
          );
          break;
        case 'containerDirective':
          current.children.push(
            this.parseDirective(node, [current, [current.children.length + 2]]),
          );
          break;
        case 'heading': {
          while (node.depth <= headings[headings.length - 1]) {
            headings.pop();
            current = current.parent?.[0] as MetaArray;
          }
          const nested = metaArray(
            node,
            [current, [current.children.length + 2]],
            this.extractHeadingLabel(node),
          );
          current.children.push(nested);
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

  parseDirective(node: ContainerDirective, parent: ParentEdge): ValueNode | MetaArray {
    if (!node.name) {
      return this.parseBlock(node, parent);
    }
    const codes = [builtInMacros as string];
    codes.push(...this.macros);
    codes.push(`return ${node.name}(arg)`);
    return this.parseBlockquote(
      runLua(node, codes, { to_markdown: wrap((n: any) => this.toMarkdown(n)) }),
      parent,
    );
  }

  parseBlockquote(node: Blockquote, parent: ParentEdge): ValueNode | MetaArray {
    if (node.data?.if) {
      const ifElse: IfElseNode = {
        type: 'if-else',
        condition: node.data.if as string,
        node,
        parent,
      };
      ifElse.ifThen = this.parseBlock(node.children[0] as Blockquote, [ifElse, [2]]);
      if (node.children.length > 1) {
        ifElse.otherwise = this.parseBlock(node.children[1] as Blockquote, [ifElse, [3]]);
      }
      return ifElse;
    }
    if (node.data?.func) {
      const funcNode: LuaNode = {
        type: 'func',
        func: { raw: node.data.func as string },
        args: [],
        node,
        parent,
      };
      node.children.forEach((n) => {
        const block: Parent = {
          type: 'blockquote',
          children: [n],
        };
        funcNode.args.push(this.parseBlock(block, [funcNode, [funcNode.args.length + 1, 'args']]));
      });
      return funcNode;
    }
    return this.parseBlock(node, parent);
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

  parseCodeBlock(code: Code, parent: ParentEdge): LuaNode {
    if (code.lang !== 'lua') {
      this.vfile.message('unsupported code block type');
    }
    let snippet;
    if (code.meta === 'global') {
      this.globalLua.push(code.value);
      snippet = '';
    } else if (code.meta === 'macro') {
      this.macros.push(code.value);
      snippet = '';
    } else {
      snippet = code.value;
    }
    return {
      type: 'func',
      func: { raw: snippet },
      args: [],
      node: code,
      parent,
    };
  }

  parseSelection(list: List, parent: ParentEdge): SelectNode {
    const node: SelectNode = {
      type: 'select',
      node: list,
      select: [],
      parent,
    };
    node.select = list.children.map((item, i) => this.parseBlock(item, [node, [i + 1, 'select']]));
    return node;
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
      const empty = metaArray(para, parent);
      return empty;
    }
    if (para.children.length === 1 && para.children[0].type === 'link') {
      const link = this.parseLink(para.children[0], parent);
      this.links.push(link);
      return link;
    }
    if (para.children[0].type === 'inlineCode') {
      const ifElse: IfElseNode = {
        type: 'if-else',
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
      if (striped.children.length >= 2) {
        const tags = this.extractTags(striped.children[1]);
        const text = this.toTextNode(para, tags, parent);
        if (text) {
          text.text = text.text.substring(1).trim();
          ifElse.ifThen = metaArray(para, [ifElse, [1]]);
          ifElse.ifThen.children.push(text);
        }
      }
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
    const [text, values, plural] = this.replaceReferences(this.toMarkdown(para), references);
    const textNode: TextNode = {
      type: 'text',
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
      rootName = this.toMarkdown(para);
    }
    if (rootName) {
      rootName.toLowerCase().endsWith('.md');
      rootName = rootName.substring(0, rootName.length - 3);
    }
    const linkNode: LinkNode = {
      type: 'link',
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

  toMarkdown(node: Content): string {
    try {
      return toMarkdown(node, {
        extensions: [directiveToMarkdown, mdxExpressionToMarkdown],
      }).trim();
    } catch (e) {
      this.vfile.message(e as Error, node);
      return '';
    }
  }
}

export default AstTransformer;
