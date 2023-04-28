import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode,
  LuaNode,
  MetaArray, Metadata, Path, SelectNode, TextNode, TreeNode, ValueNode,
} from './ast';
import { testLua } from './lua';
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
    const root = this.convert(this.root);
    this.cleanCyclicRefs(root);
    return root;
  }

  generateMeta() {
    this.iterAllNodes((node) => {
      if (!node.meta) {
        return;
      }
      const array = node as MetaArray;
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
      if (knot.meta.labels[array.meta.label]) {
        this.vfile.message('duplicate labels directly under the same node', knot.node);
      }
      knot.meta.labels[array.meta.label] = path.reverse();
      knot.meta.refs[array.meta.label] = array;
      array.meta.upper = knot;
    });
  }

  cleanCyclicRefs(root: any) {
    this.iterAllNodes((e) => {
      if (e.node) {
        e.node = null;
      }
      if (e.parent) {
        e.parent = null;
      }
    }, root);
  }

  iterAllNodes(func: (node: any) => void, root?: any) {
    const iter = (node?: ValueNode | MetaArray) => {
      if (!node) {
        return;
      }
      func(node);
      if (node instanceof Array) {
        // Converted MetaArray
        let first = true;
        node.forEach((e) => {
          if (first) {
            first = false;
          } else {
            iter(e);
          }
        });
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
          code.args.forEach(iter);
        } else if (select.select) {
          select.select.forEach(iter);
        }
        return;
      }
      const array = node as MetaArray;
      array.children.forEach(iter);
    };
    iter(root || this.root);
  }

  resolveAll() {
    this.unresolved.forEach((l) => {
      const link = l;
      if (!link.parent) {
        this.vfile.message(`internal error: deattached link node ${link.link.join('/')}`, link.node);
        return;
      }
      let parent = link.parent[0];
      while (!(parent as MetaArray).meta?.labels[link.link[0]]) {
        if (!parent.parent) {
          this.vfile.message(`link not found: ${link.link.join('/')}`, link.node);
          return;
        }
        [parent] = parent.parent;
      }
      link.link = this.resolveLink(parent as MetaArray, link);
    });
    this.unresolved = [];
  }

  resolveLink(base: MetaArray, link: LinkNode): Path {
    let parent = base;
    const abs: Path = [];
    while (parent.parent) {
      if (!parent.meta.label || !parent.meta.upper) {
        this.vfile.message('node with incomplete meta info', parent.node);
        return abs;
      }
      const { label } = parent.meta;
      parent = parent.meta.upper;
      abs.unshift(...parent.meta.labels[label]);
    }
    let current = base;
    link.link.forEach((seg) => {
      if (!current) {
        return;
      }
      if (current.meta.labels[seg] && current.meta.refs[seg]) {
        this.vfile.message(`link not found at ${seg}: ${link.link.join('/')}`, current.node);
      }
      abs.push(...current.meta.labels[seg]);
      current = current.meta.refs[seg];
    });
    return abs;
  }

  convert(n: TreeNode): LuaArrayMember {
    const node = n;
    if ((node as MetaArray).meta) {
      return this.convertMetaArray(node as MetaArray);
    }
    if ((node as LinkNode).link) {
      node.type = 'link';
      return node as LinkNode;
    }
    if ((node as TextNode).text) {
      return this.convertText(node as TextNode);
    }
    if ((node as IfElseNode).condition) {
      return this.convertIfElse(node as IfElseNode);
    }
    if ((node as LuaNode).lua) {
      return this.convertLua(node as LuaNode);
    }
    if ((node as SelectNode).select) {
      return this.convertSelect(node as SelectNode);
    }
    if (node) {
      this.vfile.fail(`internal ast error: ${Object.keys(node)}`);
    }
    return '';
  }

  convertSelect(node: SelectNode): LuaArrayMember {
    const select = node;
    select.type = 'select';
    select.select = select.select.map((opt) => this.convertMetaArray(opt) as any);
    return select;
  }

  convertMetaArray(node: MetaArray) {
    const metaArray = node;
    delete metaArray.meta.label;
    delete metaArray.meta.upper;
    metaArray.meta.refs = {};
    return [metaArray.meta, ...metaArray.children.map((e) => this.convert(e))];
  }

  convertText(node: TextNode) {
    const text = node;
    if (BrocatelFinalizer.notEmpty(text.plural, text.tags, text.values)) {
      text.type = 'text';
      if (text.values) {
        text.values = Object.fromEntries(Object.entries(text.values)
          .sort(BrocatelFinalizer.entryCompare).map(([k, v]) => {
            const raw = `function()return(\n${v}\n)end`;
            if (!testLua(`return ${raw}`)) {
              this.vfile.message(`invalid lua: ${v}`, text.node);
            }
            return [k, { raw }];
          })) as any;
      }
      return text;
    }
    return text.text;
  }

  convertIfElse(ifElse: IfElseNode) {
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

  convertLua(node: LuaNode): LuaArrayMember {
    const lua = node;
    lua.type = 'func';
    if (!testLua(node.lua)) {
      this.vfile.message('invalid lua', node.node);
    }
    (lua as any).func = { raw: `function(args)\n${node.lua}\nend` };
    lua.lua = '';
    return lua;
  }

  static notEmpty(...objects: any[]): boolean {
    return objects.some((o) => o && (!(o instanceof Object) || Object.keys(o).length !== 0));
  }

  static entryCompare(a: [string, any], b: [string, any]): number {
    return a[0].localeCompare(b[0]);
  }
}

export default BrocatelFinalizer;
