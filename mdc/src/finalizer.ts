import { VFile } from 'vfile';
import {
  IfElseNode,
  LinkNode,
  MetaArray, Metadata, TextNode, TreeNode, ValueNode,
} from './ast';

// It does not seem possible to do LuaMetaArray = [Metadata, ..Array<LuaArrayMember>].
export type LuaArrayMember = LuaMetaArray | ValueNode | Metadata | string;
export type LuaMetaArray = LuaArrayMember[];

/**
 * Transforms the AST into out Lua format.
 */
class BrocatelFinalizer {
  root: MetaArray;

  vfile: VFile;

  constructor(root: MetaArray, vfile: VFile) {
    this.root = root;
    this.vfile = vfile;
  }

  finalize() {
    return this.convert(this.root);
  }

  convert(n: TreeNode): LuaArrayMember {
    const node = n;
    node.parent = null;
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
      if (text.plural || text.tags || text.values) {
        text.type = 'text';
        return text;
      }
      return text.text;
    }
    if ((node as IfElseNode).condition) {
      const ifElse = node as IfElseNode;
      const block: any[] = [[`function()return(${ifElse.condition})end`]];
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
}

export default BrocatelFinalizer;
