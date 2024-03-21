import type {
  Code, Content, Heading, Link, Paragraph, Root,
} from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { MdxTextExpression } from 'mdast-util-mdx-expression';
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import { visitParents } from 'unist-util-visit-parents';
import { v4 as uuidv4 } from 'uuid';
import { parse as parseYaml } from 'yaml';

import { getAnchorString, isNormalLink } from '@brocatel/md';

import {
  LuaArray, LuaCode, LuaElement, LuaIfElse, LuaLink, LuaTags, LuaText,
  MarkdownNode, MarkdownParent, RelativePath, luaArray,
} from './ast';
import { toMarkdownString } from './expander';
import { HeadingStack, appendReturn, hasReturned } from './headings';
import { isIdentifier, luaErrorDetector, type LuaErrorDetector } from './lua';

/**
 * Splits a url with `#`, where `#` is escaped by `\\#`.
 */
function parseLinkUrl(link: Link): string[] {
  const tokens = link.url.match(/(\\.|[^#])+/g) || [];
  return tokens.map((s) => getAnchorString(s.replace(/\\#/g, '#')));
}

function asIs(node: MarkdownNode): LuaText {
  return {
    type: 'text',
    text: toMarkdownString(node),
    tags: {},
    values: {},
    node,
  };
}

class AstTransformer {
  root: Root;

  vfile: VFile;

  /**
   * Other Markdown files that this file links to.
   */
  dependencies: Set<string>;

  /**
   * Global Lua snippets.
   */
  globalLua: string[];

  private validateLua!: LuaErrorDetector;

  constructor(root: Root, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.dependencies = new Set<string>();
    this.globalLua = [];

    this.vfile.data.dependencies = this.dependencies;
    this.vfile.data.globalLua = this.globalLua;
  }

  async transform(): Promise<LuaArray> {
    this.validateLua = await luaErrorDetector();
    this.parseFrontmatter(this.root);
    const transformed = this.parseBlock(this.root);
    this.attachRelativeLinks(transformed);
    this.validateLua.close();
    return transformed;
  }

  checkLua(snippet: string, node: Content): string {
    const error = this.validateLua(snippet);
    if (error) {
      this.vfile.message(`illegal lua snippet: ${error.message}`, node);
    }
    return snippet;
  }

  attachRelativeLinks(root: LuaArray) {
    visitParents(root, (node, parents) => {
      const n = node;
      n.position = node.node.position;
      if (node.type !== 'array' || !node.data?.label) {
        return;
      }
      const { label } = node.data;
      let i;
      for (i = parents.length - 1; i > 0; i -= 1) {
        const element = parents[i];
        if (element.data?.label) {
          break;
        }
      }
      const parent = parents[i];
      const path: RelativePath = [];
      for (; i < parents.length; i += 1) {
        const upper = parents[i];
        const child = parents[i + 1] || node;
        const children = upper.children as LuaElement[];
        const index = children.indexOf(child);
        if (index === -1) {
          this.vfile.message('unknown child', child);
          return;
        }
        if (upper.type === 'func') {
          path.push('args');
        }
        path.push(index + 2);
      }
      if (!parent.data?.labels) {
        parent.data = { labels: {} };
      }
      if (parent.data.labels[label]) {
        this.vfile.message('heading name collision', node);
      }
      parent.data.labels[label] = path;
    });
  }

  parseFrontmatter(root: Root) {
    const fronmatter = root.children.find((n) => n.type === 'yaml');
    if (fronmatter?.type === 'yaml') {
      try {
        const metadata: Record<string, unknown> = parseYaml(fronmatter.value);
        const ids = metadata.IFID ?? metadata.ifid ?? metadata.UUID ?? metadata.uuid;
        const uuids: string[] = (Array.isArray(ids) ? ids : [ids]).map((s) => {
          if (typeof s === 'string') {
            const uuid = s.toUpperCase();
            const match = /^(?:(?:UUID|IFID):\/\/)?([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\/{0,2}$/.exec(uuid);
            if (match) {
              return match[1].toUpperCase();
            }
          }
          this.vfile.message(`invalid IFID ${s}`, fronmatter);
          return '';
        }).filter((s) => s !== '');
        this.vfile.data.IFID = uuids;
      } catch (e) {
        this.vfile.message(e as Error, fronmatter);
      }
    }
  }

  parseBlock(block: MarkdownParent): LuaArray {
    const stack = new HeadingStack(block, this.vfile);
    // Levels of previous headings.
    block.children.forEach((node) => {
      const current = stack.last();
      switch (node.type) {
        case 'paragraph':
          current.children.push(this.parseParagraph(node));
          break;
        case 'code':
          current.children.push(this.parseCodeBlock(node));
          break;
        case 'containerDirective':
          current.children.push(this.parseDirective(node));
          break;
        case 'heading': {
          stack.popUntil(node.depth);
          const last = stack.last();
          const nested = this.parseHeading(node);
          if ((stack.lastDepth() !== 0 || nested.data?.routine) && !hasReturned(last)) {
            // Insert a return before function entry point.
            appendReturn(last);
          }
          last.children.push(nested);
          stack.push(nested, node.depth);
          break;
        }
        case 'html':
          if (!node.value.trim().startsWith('<!--')) {
            current.children.push(asIs(node));
          }
          break;
        case 'yaml':
          break;
        default:
          this.vfile.message(`unsupported markdown type: ${node.type}`, node);
          current.children.push(asIs(node));
          break;
      }
    });
    stack.popUntil(0);
    return stack.root;
  }

  parseHeading(node: Heading): LuaArray {
    if (node.children.some((child) => child.type as string === 'mdxTextExpression')) {
      return this.parseFunctionHeading(node);
    }
    return luaArray(
      node,
      this.extractHeadingLabel(node),
    );
  }

  parseFunctionHeading(node: Heading): LuaArray {
    if (node.children.length !== 2
        || node.children[0].type !== 'text'
        || node.children[1].type as string !== 'mdxTextExpression') {
      this.vfile.message('unexpected complex heading', node);
      return luaArray(node);
    }
    const name = node.children[0].value.trim();
    const params = (node.children[1] as unknown as MdxTextExpression).value.split(',')
      .map((s) => s.trim()).filter((s) => s);
    const invalid = params.filter((s) => !isIdentifier(s));
    if (invalid.length > 0) {
      this.vfile.message(`not valid identifier: ${invalid.join(', ')}`);
    }
    const array = luaArray(
      node,
      getAnchorString(name),
      params,
    );
    return array;
  }

  destructDirective(directive: ContainerDirective) {
    let label = null;
    let list = null;
    let func = false;
    if (directive.children.length === 1) {
      label = null;
      [list] = directive.children;
    } else if (directive.children.length === 2) {
      let first;
      [first, list] = directive.children;
      if (first.type === 'code' && first.meta === 'func') {
        label = first.value;
        func = true;
      } else if (first.type === 'paragraph' && first.children[0].type === 'inlineCode') {
        label = first.children[0].value;
      } else if (first.type === 'containerDirectiveLabel' && first.children[0].type === 'inlineCode') {
        label = first.children[0].value;
      }
    }
    if (list?.type !== 'list') {
      this.vfile.message('unexpected element inside directive', directive);
      list = null;
    }
    return { label, list, func };
  }

  parseDirective(node: ContainerDirective): LuaElement {
    if (node.name === 'nil') {
      return asIs({
        ...node as any,
        type: 'paragraph',
      });
    }
    const { label, list, func } = this.destructDirective(node);
    if (!list) {
      this.vfile.message('missing element', node);
      return this.parseBlock(node);
    }
    switch (node.name) {
      case 'local': {
        return this.parseBlock({
          type: 'listItem',
          children: list.children.map((i) => i.children).flat(),
          position: node.position,
        });
      }
      case 'if': {
        if (!label) {
          this.vfile.message('expecting condition and branches', node);
        }
        const condition = label || 'false';
        this.checkLua(`return(${label})`, node);
        const children = list.children.map((child) => this.parseBlock(child)) as any;
        if (children.length >= 1 && children.length <= 2) {
          const ifElse: LuaIfElse = {
            type: 'if-else',
            condition,
            children,
            node,
          };
          return ifElse;
        }
        this.vfile.message('only one or two branches allowed', node);
        break;
      }
      case 'do': {
        let code;
        if (!label) {
          this.vfile.message('expecting lua code', node);
          code = 'true';
        } else {
          code = func ? label : `${label}(args)`;
        }
        const luaFunc: LuaCode = {
          type: 'func',
          code,
          children: list.children.map((child) => this.parseBlock(child)),
          node,
        };
        return luaFunc;
      }
      default:
        this.vfile.message('unknown macro', node);
        break;
    }
    return this.parseBlock(node);
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
    return getAnchorString(node.children[0].value);
  }

  parseCodeBlock(code: Code): LuaCode | LuaText {
    if (code.lang !== 'lua') {
      this.vfile.message('unsupported code block type');
      return asIs(code);
    }
    let snippet;
    if (code.meta === 'global') {
      this.globalLua.push(code.value);
      snippet = '';
    } else if (code.meta === 'macro') {
      snippet = '';
    } else {
      snippet = code.value;
    }
    return {
      type: 'func',
      code: this.checkLua(snippet, code),
      children: [],
      node: code,
    };
  }

  /**
   * Converts a mdast paragraph to our own AST.
   *
   * Paragraphs should be leaf nodes, so handling them are quite simple.
   *
   * A paragraph is expected to:
   * - contain only a link (`LinkNode`),
   * - or starts with an inline code snippet (`IfElseNode` without `else` branch),
   *   which is already processed in expander.ts,
   * - or contains no link or inline code at all (normal texts).
   *
   * @param para the paragraph
   * @param parent the parent
   * @returns converted
   */
  parseParagraph(para: Paragraph): LuaText | LuaLink {
    if (para.children.length === 1 && para.children[0].type === 'link') {
      if (isNormalLink(para.children[0].url)) {
        return asIs(para);
      }
      return this.parseLink(para.children[0]);
    }
    const tags = this.extractTags(para);
    const text = this.toTextNode(para, tags);
    return text;
  }

  extractTags(node: Paragraph): LuaTags {
    const para = node;
    const tags: LuaTags = {};
    let i = 0;
    let tag = para.children[i];
    while (tag?.type === 'textDirective') {
      if (tag.attributes && Object.entries(tag.attributes).length !== 0) {
        this.vfile.message('directive attribute not supported');
      }
      tags[tag.name] = (
        tag.children.length === 0 ? ''
          : toMarkdownString({ type: 'paragraph', children: tag.children })
      );
      i += 1;
      const gap = para.children[i];
      if (gap?.type === 'text') {
        if (/^\s[,;]?\s*$/.test(gap.value)) {
          i += 1;
        } else {
          gap.value = gap.value.trimStart();
        }
      }
      tag = para.children[i];
    }
    para.children = i === 0 ? para.children : para.children.slice(i);
    return tags;
  }

  /**
   * Converts children of a paragraph to a text node.
   */
  toTextNode(para: Paragraph, tags: LuaTags): LuaText {
    const original = toMarkdownString(para);
    const references: { [id: string]: [string, MdxTextExpression] } = {};
    visitParents(para, (n) => {
      if (n.type as string === 'mdxTextExpression') {
        const node = n as unknown as MdxTextExpression;
        const id = uuidv4();
        references[id] = [node.value, node];
        node.value = id;
      }
    });
    const [text, values, plural] = this.replaceReferences(toMarkdownString(para), references);
    const textNode: LuaText = {
      type: 'text',
      text,
      tags,
      plural,
      values,
      original,
      node: para,
    };
    return textNode;
  }

  replaceReferences(
    s: string,
    references: { [id: string]: [string, MdxTextExpression] },
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
      this.checkLua(`return(${v})`, node);
      redirected[`v${i}`] = v;
      i += 1;
    });
    return [str, redirected, plural];
  }

  /**
   * Parses a link.
   *
   * The link title will get treated as the root node name,
   * while the url will be split by `#`.
   *
   * @param link the link
   * @param parent the parent
   * @returns a link node
   */
  parseLink(link: Link): LuaLink {
    const labels = parseLinkUrl(link);
    const match = link.url.match(/^([^#]+)\.md#./);
    const linkNode: LuaLink = {
      type: 'link',
      labels: match ? labels.slice(1) : labels,
      node: link,
      root: match ? match[1] : undefined,
    };
    if (!linkNode.root) {
      delete linkNode.root;
    }
    const expr = link.children[0];
    if (expr?.type as string === 'mdxTextExpression') {
      if (link.children.length > 1) {
        this.vfile.message('unexpected complex link content', link);
      }
      const params = (expr as unknown as MdxTextExpression).value.trim();
      linkNode.params = `{${params}}`;
    } else {
      linkNode.params = '';
    }
    if (link.data?.coroutine) {
      linkNode.coroutine = true;
    }
    return linkNode;
  }
}

const transformAst: Plugin = () => (node, vfile) => {
  const transformer = new AstTransformer(node as Root, vfile);
  return transformer.transform();
};

export default transformAst;
