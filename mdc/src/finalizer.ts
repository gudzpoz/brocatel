import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode,
  LuaNode,
  MetaArray, Metadata, SelectNode, TextNode, TreeNode, ValueNode,
} from './ast';
import AstTransformer from './transformer';

// It does not seem possible to do LuaMetaArray = [Metadata, ..Array<LuaArrayMember>].
export type LuaArrayMember = LuaMetaArray | ValueNode | Metadata | string;
export type LuaMetaArray = LuaArrayMember[];

/**
 * Transforms the AST into out Lua format.
 */
class BrocatelFinalizer {
  root: MetaArray;

  vfile: VFile;

  unresolved: LinkNode[];

  constructor(root: MetaArray, transformer: AstTransformer, vfile: VFile) {
    this.unresolved = transformer.links;
    this.root = root;
    this.vfile = vfile;
  }

  finalize() {
    this.generateMeta();
    this.resolveAll();
    return this.convert(this.root);
  }

  generateMeta() {
    const iter = (node?: ValueNode | MetaArray) => {
      if (!node) {
        return;
      }
      if (!(node as MetaArray).meta) {
        const ifElse = node as IfElseNode;
        const code = node as LuaNode;
        const select = node as SelectNode;
        if (ifElse.condition) {
          iter(ifElse.ifThen);
          iter(ifElse.otherwise);
        } else if (code.lua) {
          iter(code.args);
        } else if (select.options) {
          select.options.forEach(iter);
        }
        return;
      }
      const array = node as MetaArray;
      array.chilren.forEach(iter);
      if (!array.meta.label) {
        return;
      }
      if (!array.parent) {
        this.vfile.message('unexpected root label', array.node);
        return;
      }
      let parent = array.parent[0];
      const path = array.parent[1];
      while (!(parent as MetaArray).meta?.label) {
        if (!parent.parent) {
          break;
        }
        path.push(...parent.parent[1]);
        [parent] = parent.parent;
      }
      const knot = parent as MetaArray;
      if (!knot.meta.labels) {
        knot.meta.labels = {};
      }
      if (knot.meta.labels[array.meta.label]) {
        this.vfile.message('duplicate labels directly under the same node', knot.node);
      }
      knot.meta.labels[array.meta.label] = path.reverse();
    };
    iter(this.root);
  }

  resolveAll() {
    this.unresolved.forEach((link) => {
      if (!link.parent) {
        this.vfile.message(`internal error: deattached link node ${link.link.join('/')}`, link.node);
      }
    });
    this.unresolved = [];
  }

  convert(n: TreeNode): LuaArrayMember {
    const node = n;
    node.parent = null;
    node.node = null;
    if ((node as MetaArray).meta) {
      const metaArray = node as MetaArray;
      delete metaArray.meta.label;
      if (metaArray.meta.labels && Object.keys(metaArray.meta.labels).length === 0) {
        delete metaArray.meta.labels;
      }
      return [metaArray.meta, ...metaArray.chilren.map((e) => this.convert(e))];
    }
    if ((node as LinkNode).link) {
      node.type = 'link';
      return node as LinkNode;
    }
    if ((node as TextNode).text) {
      const text = node as TextNode;
      if (BrocatelFinalizer.notEmpty(text.plural, text.tags, text.values)) {
        text.type = 'text';
        if (text.values) {
          text.values = Object.fromEntries(Object.entries(text.values)
            .sort(BrocatelFinalizer.entryCompare).map(
              ([k, v]) => [k, { raw: `function()return(\n${v}\n)end` }],
            )) as any;
        }
        return text;
      }
      return text.text;
    }
    if ((node as IfElseNode).condition) {
      const ifElse = node as IfElseNode;
      const block: any[] = [{
        raw: ifElse.condition.startsWith('--')
          ? 'function()end'
          : `function()return(\n${ifElse.condition}\n)end`,
      }];
      if (ifElse.ifThen) {
        block.push(this.convert(ifElse.ifThen));
        if (ifElse.otherwise) {
          block.push(this.convert(ifElse.otherwise));
        }
      }
      return block;
    }
    if (node) {
      this.vfile.fail(`internal ast error: ${Object.keys(node)}`);
    }
    return '';
  }

  static notEmpty(...objects: any[]): boolean {
    return objects.some((o) => o && (!(o instanceof Object) || Object.keys(o).length !== 0));
  }

  static entryCompare(a: [string, any], b: [string, any]): number {
    return a[0].localeCompare(b[0]);
  }
}

export default BrocatelFinalizer;
