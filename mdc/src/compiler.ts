import { Root } from 'mdast';
import { Plugin } from 'unified';
import { VFile } from 'vfile';

import BrocatelFinalizer from './finalizer';
import AstTransformer from './transformer';

/**
 * Recursively converts a node into Lua table.
 *
 * There is a special node: `{ raw: string_element }`.
 * The content of the string element will be dumped as is, so as to
 * generate Lua functions.
 *
 * @param node the node
 * @param builder the string builder
 */
function format(node: any, builder: string[]) {
  if (typeof node === 'string') {
    builder.push(JSON.stringify(node));
  } else if (node instanceof Array) {
    builder.push('{');
    let first = true;
    node.forEach((e) => {
      if (!first) {
        builder.push(',');
      }
      first = false;
      format(e, builder);
    });
    builder.push('}');
  } else if (node instanceof Object) {
    if (typeof node.raw === 'string') {
      builder.push(node.raw);
    } else {
      builder.push('{');
      let first = true;
      Object.entries(node).filter((e) => e[1]).forEach((e) => {
        builder.push(first ? '' : ',', e[0], '=');
        first = false;
        format(e[1], builder);
      });
      builder.push('}');
    }
  } else {
    throw new TypeError(`unexpected ${node}`);
  }
}

const attachBrocatelCompiler: Plugin = function plugin() {
  function compile(root: any): string {
    const builder: string[] = [];
    format(root, builder);
    return builder.join('');
  }
  this.Compiler = (root: Root, vfile: VFile) => {
    const transformer = new AstTransformer(root, vfile);
    const finalizer = new BrocatelFinalizer(transformer.transform(), vfile);
    return compile(finalizer.finalize());
  };
};

export default attachBrocatelCompiler;
