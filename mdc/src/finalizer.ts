import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode,
  LuaNode,
  MetaArray, Metadata, Path, SelectNode, TextNode, ValueNode,
} from './ast';
import { detectLuaErrors } from './lua';
import AstTransformer from './transformer';

// It does not seem possible to do LuaMetaArray = [Metadata, ..Array<LuaArrayMember>].
export type LuaArrayComplexMember = LuaMetaArray | ValueNode;
export type LuaArrayMember = LuaArrayComplexMember | string;
export type LuaMetaArray = (LuaArrayMember | Metadata)[];

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
      const array = node;
      if (array instanceof Array || array.type !== 'array') {
        return;
      }
      if (!array.meta.label) {
        return;
      }
      if (!array.parent) {
        this.vfile.message('unexpected root label', array.node);
        return;
      }
      let parent = array.parent[0];
      const path = array.parent[1];
      while (parent.type !== 'array' || !parent.meta.label) {
        if (!parent.parent) {
          if (parent.type !== 'array') {
            this.vfile.message('unexpected non-array root node', parent.node);
            return;
          }
          break;
        }
        path.push(...parent.parent[1]);
        [parent] = parent.parent;
      }
      if (parent.meta.labels[array.meta.label]) {
        this.vfile.message('duplicate labels directly under the same node', parent.node);
      }
      parent.meta.labels[array.meta.label] = path.reverse();
      parent.meta.refs[array.meta.label] = array;
      array.meta.upper = parent;
    });
  }

  cleanCyclicRefs(root: any) {
    this.iterAllNodes((e) => {
      if (e instanceof Array) {
        return;
      }
      if (e.node) {
        e.node = null;
      }
      if (e.parent) {
        e.parent = null;
      }
    }, root);
  }

  iterAllNodes(func: (node: MetaArray | LuaArrayComplexMember) => void, root?: any) {
    const iter = (node?: MetaArray | Metadata | LuaArrayComplexMember) => {
      if (!node) {
        return;
      }
      if (node instanceof Array) {
        // Converted MetaArray, skipping the first item (meta info)
        func(node);
        node.forEach((e, i) => i && typeof e !== 'string' && iter(e));
        return;
      }
      switch (node.type) {
        case 'meta':
          return;
        case 'array':
          node.children.forEach(iter);
          break;
        case 'if-else':
          iter(node.ifThen);
          iter(node.otherwise);
          break;
        case 'func':
          node.args.forEach(iter);
          break;
        case 'select':
          node.select.forEach(iter);
          break;
        default:
          break;
      }
      func(node);
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
      while (parent.type !== 'array' || !parent.meta.labels[link.link[0]]) {
        if (!parent.parent) {
          this.vfile.message(`link not found: ${link.link.join('/')}`, link.node);
          return;
        }
        [parent] = parent.parent;
      }
      link.link = this.resolveLink(parent, link);
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
      if (!current.meta.labels[seg] || !current.meta.refs[seg]) {
        this.vfile.message(`link not found at ${seg}: ${link.link.join('/')}`, current.node);
      }
      abs.push(...current.meta.labels[seg]);
      current = current.meta.refs[seg];
    });
    return abs;
  }

  // eslint-disable-next-line consistent-return
  convert(n: ValueNode | MetaArray): LuaArrayMember {
    const node = n;
    switch (node.type) {
      case 'array':
        return this.convertMetaArray(node);
      case 'link':
        return node;
      case 'text':
        return this.convertText(node);
      case 'if-else':
        return this.convertIfElse(node);
      case 'func':
        return this.convertLua(node);
      case 'select':
        return this.convertSelect(node);
      default:
        this.vfile.fail(`internal ast error: ${Object.keys(node)}`);
    }
  }

  convertSelect(node: SelectNode): LuaArrayMember {
    const select = node;
    select.select = select.select.map((opt) => this.convertMetaArray(opt) as any);
    return select;
  }

  convertMetaArray(node: MetaArray): LuaMetaArray {
    const metaArray = node;
    delete metaArray.meta.label;
    delete metaArray.meta.upper;
    metaArray.meta.refs = {};
    return [metaArray.meta, ...metaArray.children.map((e) => this.convert(e))];
  }

  convertText(node: TextNode) {
    const text = node;
    if (BrocatelFinalizer.notEmpty(text.plural, text.tags, text.values)) {
      if (text.values) {
        text.values = Object.fromEntries(Object.entries(text.values)
          .sort(BrocatelFinalizer.entryCompare).map(([k, v]) => {
            const raw = `function()return(\n${v}\n)end`;
            const error = detectLuaErrors(`return (\n${raw}\n)`);
            if (error) {
              this.vfile.message(error, text.node);
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
    const error = detectLuaErrors(node.func.raw);
    if (error) {
      this.vfile.message(error, node.node);
    }
    lua.func.raw = `function(args)\n${node.func.raw}\nend`;
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
