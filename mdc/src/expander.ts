import {
  Code, Content, List, Root,
} from 'mdast';
import { ContainerDirective, Directive } from 'mdast-util-directive';
import { mdxExpressionToMarkdown } from 'mdast-util-mdx-expression';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visitParents } from 'unist-util-visit-parents';
import { Plugin } from 'unified';
import { Node as UnistNode } from 'unist';
import { VFile } from 'vfile';

import { directiveLabel, directiveToMarkdown } from '@brocatel/md';

import { MarkdownNode } from './ast';
import { isIdentifier, luaRunner, type LuaRunner } from './lua';
import { overwrite, shallowCopy, subParagraph } from './utils';

import builtInMacros from './macros/builtin.lua?raw';

type Node = Root | Content | Directive;

export function isBuiltInMacro(name: string): boolean {
  return name === 'do' || name === 'if' || name === 'nil';
}

export function toMarkdownString(node: MarkdownNode): string {
  return toMarkdown(node, {
    extensions: [directiveToMarkdown, mdxExpressionToMarkdown],
  }).trim();
}

class MacroExpander {
  root: Root;

  vfile: VFile;

  /**
   * User-defined macros.
   */
  macros: string[];

  private runLua!: LuaRunner;

  constructor(root: Root, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.macros = [];
  }

  async expand() {
    this.runLua = await luaRunner();
    visitParents(this.root, (n, parents) => {
      const node = n;
      if (node.type === 'root') {
        return;
      }
      let { position } = node;
      const parent = parents[parents.length - 1];
      while (this.expandSyntacticSugar(node, parent)
          || this.expandMacro(node)) {
        if (!node.position && position) {
          node.position = position;
        }
        position = node.position || position;
        // Until no further expansion is possible.
      }
    });
  }

  expandMacro(node: Node) {
    if (node.type === 'code' && node.lang === 'lua' && node.meta === 'macro') {
      this.macros.push(node.value);
      return false;
    }
    if (node.type !== 'containerDirective') {
      return false;
    }
    if (isBuiltInMacro(node.name)) {
      return false;
    }
    if (node.children.length > 2) {
      this.vfile.message('too many children inside a macro node', node);
      return false;
    }
    if (node.children.length === 1) {
      if (node.children[0].type !== 'list') {
        this.vfile.message('expecting a list inside the macro node', node);
        return false;
      }
    } else if (node.children[0]?.type !== 'containerDirectiveLabel' || node.children[1]?.type !== 'list') {
      this.vfile.message('invalid macro node', node);
      return false;
    }
    if (!isIdentifier(node.name.replace(/\./g, ''))) {
      this.vfile.message('not a lua identifier', node);
      return false;
    }
    try {
      const generated = this.runLua(node, [
        builtInMacros as string,
        ...this.macros,
        `return ${node.name}(arg)`,
      ], { TO_MARKDOWN: toMarkdownString });
      overwrite(node, generated);
    } catch (e) {
      this.vfile.message(e as Error, node);
      return false;
    }
    return true;
  }

  expandSyntacticSugar(node: Node, parent: Node) {
    return this.expandList(node, parent)
      || this.expandConditional(node)
      || MacroExpander.expandThematicBreak(node);
  }

  static expandThematicBreak(node: Node) {
    if (node.type !== 'thematicBreak') {
      return false;
    }
    const end: Code = {
      type: 'code',
      lang: 'lua',
      value: 'END()',
    };
    overwrite(node, end);
    return true;
  }

  /**
   * Lists not in directly inside a macro node are syntactic sugar for the default option call.
   *
   * @param node the current node
   * @param parent the parent node
   * @returns whether any expansion occurred
   */
  expandList(node: Node, parent: Node) {
    if (node.type !== 'list') {
      return false;
    }
    if (parent.type === 'containerDirective') {
      if (!isBuiltInMacro(parent.name)) {
        this.vfile.message('macro node not transformed', parent);
      }
      return false;
    }
    const list = shallowCopy(node);
    const macro: ContainerDirective = {
      type: 'containerDirective',
      name: 'do',
      children: [directiveLabel(node.ordered ? 'FUNC.S_RECUR' : 'FUNC.S_ONCE'), list],
    };
    overwrite(node, macro);
    return true;
  }

  /**
   * Paragraphs with inlineCode snippets are syntactic sugar.
   *
   * - If the inlineCode snippet is the only child node,
   *   it is treated as a Lua statement, which is not expected to return anything.
   * - Otherwise, the paragraph is treated as a conditional one,
   *   whose display depends on the evaluation result of the Lua expression.
   *
   * @param node the current node
   * @returns whether any expansion occurred
   */
  // eslint-disable-next-line class-methods-use-this
  expandConditional(node: Node) {
    if (node.type !== 'paragraph') {
      return false;
    }
    const { children } = node;
    if (children.length === 0 || children[0].type !== 'inlineCode') {
      return false;
    }
    if (children.length === 1) {
      const code: Code = {
        type: 'code',
        lang: 'lua',
        value: children[0].value,
      };
      overwrite(node, code);
      return true;
    }
    const branch = subParagraph(node, 1);
    const list: List = {
      type: 'list',
      children: [{
        type: 'listItem',
        children: [branch],
      }],
    };
    const macro: ContainerDirective = {
      type: 'containerDirective',
      name: 'if',
      children: [directiveLabel(children[0].value), list],
    };
    overwrite(node, macro);
    return true;
  }
}

const expandMacro: Plugin = () => (root: UnistNode, vfile: VFile) => {
  const expander = new MacroExpander(root as Root, vfile);
  return expander.expand();
};

export default expandMacro;
