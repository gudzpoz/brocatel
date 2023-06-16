import { Plugin } from 'unified';
import { VFile } from 'vfile';
import {
  LuaArray, LuaCode, LuaElement, LuaIfElse, LuaLink, LuaText,
} from './ast';
import { detectLuaErrors, isIdentifier } from './lua';

function isEmpty(object: { [key: string]: any } | undefined): boolean {
  if (!object) {
    return true;
  }
  return Object.keys(object).length === 0;
}

/**
 * Compares between object entries.
 */
function entryCompare(a: [string, any], b: [string, any]): number {
  return a[0].localeCompare(b[0]);
}

export function serializeTableInner<T>(
  object: { [key: string]: T },
  encoder: (s: T) => string,
): string {
  return Object.entries(object).sort(entryCompare)
    .map(([k, v]) => {
      const key = isIdentifier(k) ? k : `[${JSON.stringify(k)}]`;
      return `${key}=${encoder(v)}`;
    })
    .join(',');
}

class AstCompiler {
  root: LuaArray;

  vfile: VFile;

  /**
   * The string builder.
   *
   * It seems string concatenation is actually faster than buffering and `join('')`,
   * so not bothering to use a buffer.
   */
  output: string;

  constructor(root: LuaArray, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.output = '';
  }

  compile() {
    this.visitAll();
    return this.output;
  }

  visitAll() {
    const stack: (LuaArray | LuaCode | LuaIfElse)[] = [this.root];
    const indices = [-1];
    while (stack.length !== 0) {
      const parent = stack[stack.length - 1];
      const index = indices[stack.length - 1];
      indices[stack.length - 1] += 1;
      if (index === -1) {
        this.serialize(parent, false);
      } else if (index < parent.children.length) {
        this.output += ',';
        const child = parent.children[index];
        switch (child.type) {
          case 'text':
            this.serializeText(child);
            break;
          case 'link':
            this.serializeLink(child);
            break;
          default:
            stack.push(child);
            indices.push(-1);
            break;
        }
      } else {
        this.serialize(parent, true);
        stack.pop();
        indices.pop();
      }
    }
  }

  checkLua(snippet: string, node: LuaElement): string {
    const error = detectLuaErrors(snippet);
    if (error) {
      this.vfile.message(error.message, node.node);
    }
    return snippet;
  }

  serializeLink(child: LuaLink) {
    const root = child.root ? `,root=${JSON.stringify(child.root)}` : '';
    const labels = child.labels.map((label) => JSON.stringify(label)).join(',');
    this.output += `{link={${labels}}${root}}`;
  }

  serializeText(child: LuaText) {
    const text = JSON.stringify(child.text);
    if (!child.plural && isEmpty(child.tags) && isEmpty(child.values)) {
      this.output += text;
    } else {
      // Keeps things alphabetical.
      let prior = child.plural ? `plural=${JSON.stringify(child.plural)},` : '';
      const tags = serializeTableInner(child.tags, (s) => JSON.stringify(s));
      prior += tags ? `tags={${tags}},` : '';
      const values = serializeTableInner(
        child.values,
        (s) => `function()${this.checkLua(`return(${s})`, child)}end`,
      );
      const post = values ? `,values={${values}}` : '';
      this.output += `{${prior}text=${text}${post}}`;
    }
  }

  serialize(node: LuaArray | LuaCode | LuaIfElse, exit: boolean) {
    if (exit) {
      if (node.type !== 'func') {
        this.output += '}';
        return;
      }
      this.output += node.children.length === 0 ? '' : ',';
      this.output += `func=function(args)${this.checkLua(node.code.trim(), node)}\nend}`;
      return;
    }

    switch (node.type) {
      case 'array': {
        this.output += '{{';
        const labels = serializeTableInner(
          node.data?.labels || {},
          (p) => `{${p.map((s) => JSON.stringify(s)).join(',')}}`,
        );
        if (node.data?.label) {
          this.output += `label=${JSON.stringify(node.data.label)}`;
          if (labels) {
            this.output += ',';
          }
        }
        if (labels) {
          this.output += `labels={${labels}}`;
        }
        this.output += '}';
        break;
      }
      case 'func':
        this.output += node.children.length === 0 ? '{' : '{args={{}';
        break;
      case 'if-else': {
        const body = this.checkLua(`return(${node.condition})`, node);
        this.output += `{function()${body}end`;
        break;
      }
      default:
        throw new Error('unreachable');
    }
  }
}

const compileAst: Plugin = function astCompiler() {
  this.Compiler = AstCompiler;
};

export default compileAst;
