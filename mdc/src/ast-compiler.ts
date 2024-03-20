import { Plugin } from 'unified';
import { VFile } from 'vfile';

import {
  LuaArray, LuaCode, LuaElement, LuaIfElse, LuaLink, LuaText,
} from './ast';
import { collectGettextData } from './lgettext';
import { isIdentifier } from './lua';
import LuaTableGenerator from './lua-table';

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

/**
 * Utility function returning the inner part of the serialized table.
 *
 * If the object is empty, it returns ''.
 *
 * @param object the object to be serialized
 * @param encoder the value encoder
 */
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

function serializePosition(node: LuaElement) {
  const position = node.position || node.node.position;
  if (position) {
    return `"${position.start.line}:${position.start.column}"`;
  }
  return '""';
}

class AstCompiler {
  root: LuaArray;

  vfile: VFile;

  private builder: LuaTableGenerator;

  constructor(root: LuaArray, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
    this.builder = new LuaTableGenerator('_');
  }

  compile() {
    this.visitAll();
    this.vfile.data.gettext = collectGettextData(this.root, this.vfile);
    return this.builder.toString();
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

  serializeLink(child: LuaLink) {
    this.builder
      .startTable()
      .pair('link').startTable().raw(child.labels.map((label) => JSON.stringify(label)).join(','))
      .endTable();
    if (child.params !== undefined) {
      this.builder.pair('params').raw(child.params === '' ? 'true' : `function()return${child.params}end`);
    }
    if (child.root) {
      this.builder.pair('root').value(child.root);
    }
    this.builder.endTable();
  }

  serializeText(child: LuaText) {
    if (!child.plural && isEmpty(child.tags) && isEmpty(child.values)) {
      this.builder.value(child.text);
    } else {
      this.builder.startTable();
      if (child.plural) {
        this.builder.pair('plural').value(child.plural);
      }
      const tags = serializeTableInner(child.tags, (s) => JSON.stringify(s));
      if (tags !== '') {
        this.builder.pair('tags').startTable().raw(tags).endTable();
      }
      this.builder.pair('text').value(child.text);
      const values = serializeTableInner(
        child.values,
        (s) => `function()return(${s})end`,
      );
      if (values !== '') {
        this.builder.pair('values').startTable().raw(values).endTable();
      }
      this.builder.endTable();
    }
  }

  serialize(node: LuaArray | LuaCode | LuaIfElse, exit: boolean) {
    if (exit) {
      if (node.type !== 'func') {
        this.builder.endTable();
        return;
      }
      if (node.children.length !== 0) {
        this.builder.endTable();
      }
      this.builder.pair('func').raw(`function(args)${node.code.trim()}\nend}`);
      return;
    }

    switch (node.type) {
      case 'array': {
        this.builder.startTable().startTable();
        if (this.vfile.data.debug) {
          const positions = [serializePosition(node)];
          node.children.forEach((child) => positions.push(serializePosition(child)));
          let prev = 0;
          for (let i = 1; i < positions.length; i += 1) {
            if (positions[prev] === positions[i]) {
              positions[i] = '""';
            } else {
              prev = i;
            }
          }
          this.builder.pair('debug').startTable().raw(positions.join(',')).endTable();
        }
        if (node.data?.routine) {
          this.builder.pair('routine').startTable()
            .raw(node.data.routine.parameters.map((p) => JSON.stringify(p)).join(','))
            .endTable();
        }
        if (node.data?.label) {
          this.builder.pair('label').value(node.data.label);
        }
        const labels = serializeTableInner(
          node.data?.labels || {},
          (p) => `{${p.map((s) => JSON.stringify(s)).join(',')}}`,
        );
        if (labels) {
          this.builder.pair('labels').startTable().raw(labels).endTable();
        }
        this.builder.endTable();
        break;
      }
      case 'func':
        this.builder.startTable();
        if (node.children.length !== 0) {
          this.builder.pair('args').startTable().startTable().endTable();
        }
        break;
      case 'if-else':
        this.builder.startTable().raw(`function()return(${node.condition})end`);
        break;
      default:
        throw new Error('unreachable');
    }
  }
}

const compileAst: Plugin = function astCompiler() {
  this.Compiler = AstCompiler;
};

export default compileAst;
