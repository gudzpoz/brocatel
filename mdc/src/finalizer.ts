import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode,
  LuaNode,
  MetaArray, Metadata, Path, RelativePath, SelectNode, TextNode, ValueNode,
} from './ast';
import { allEmpty, detectLuaErrors } from './lua';
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
      this.registerLabel(array, array.meta.label);
    });
  }

  registerLabel(node: MetaArray, label: string) {
    const array = node;
    const path: RelativePath = [];
    let registered = false;
    let edge = array.parent;
    while (edge) {
      const parent = edge[0];
      path.push(...edge[1]);
      if (parent.type === 'array') {
        if (!registered && (parent.meta.label || !parent.parent)) {
          if (parent.meta.labels[label]) {
            this.vfile.message('duplicate labels directly under the same node', parent.node);
          }
          parent.meta.labels[label] = path.slice().reverse();
          parent.meta.refs[label] = array;
          array.meta.upper = parent;
          registered = true;
        }
        if (parent.meta.children[label]) {
          parent.meta.children[label].push(path.slice().reverse());
        } else {
          parent.meta.children[label] = [path.slice().reverse()];
        }
      }
      edge = parent.parent;
    }
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
          if (link.link.length === 1) {
            const path = this.tryResolveUniqueLink(link);
            if (path) {
              return;
            }
          }
          this.vfile.message(`link not found: ${link.link.join('/')}`, link.node);
          return;
        }
        [parent] = parent.parent;
      }
      this.resolveLink(parent, link);
    });
    this.unresolved = [];
  }

  tryResolveUniqueLink(link: LinkNode) {
    let edge = link.parent;
    while (edge) {
      const parent = edge[0];
      if (parent.type === 'array' && parent.meta.children[link.link[0]]?.length === 1) {
        const path = this.resolveLink(parent, {
          type: 'link', link: [], node: link.node, parent: null,
        });
        path.push(...parent.meta.children[link.link[0]][0]);
        return path;
      }
      edge = parent.parent;
    }
    return null;
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
    delete metaArray.meta.upper;
    metaArray.meta.refs = {};
    metaArray.meta.children = {};
    return [metaArray.meta, ...metaArray.children.map((e) => this.convert(e))];
  }

  convertText(node: TextNode) {
    const text = node;
    if (!allEmpty(text.plural, text.tags, text.values)) {
      if (text.values) {
        text.values = Object.fromEntries(Object.entries(text.values)
          .map(([k, v]) => {
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
    let raw;
    if (ifElse.condition.startsWith('--')) {
      raw = 'function()end';
    } else if (ifElse.ifThen) {
      raw = `function()return(\n${ifElse.condition}\n)end`;
    } else {
      raw = `function()\n${ifElse.condition}\nend`;
    }
    const block: any[] = [{ raw }];
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
    lua.args = lua.args.map((arg) => this.convertMetaArray(arg)) as any;
    return lua;
  }
}

export default BrocatelFinalizer;
