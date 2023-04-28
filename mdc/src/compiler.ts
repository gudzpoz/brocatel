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
function format(node: any, builder: string[], labels?: boolean) {
  if (typeof node === 'string' || typeof node === 'number') {
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
      Object.entries(node).filter((e) => BrocatelFinalizer.notEmpty(e[1]))
        .sort(BrocatelFinalizer.entryCompare).forEach((e) => {
          if (e[0] === 'type' && !labels) {
            return;
          }
          builder.push(first ? '' : ',');
          if (labels) {
            builder.push('[');
            format(e[0], builder);
            builder.push(']');
          } else {
            builder.push(e[0]);
          }
          builder.push('=');
          first = false;
          format(e[1], builder, e[0] === 'labels');
        });
      builder.push('}');
    }
  } else {
    throw new TypeError(`unexpected ${node}: ${builder.join('')}`);
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
    const finalizer = new BrocatelFinalizer(transformer.transform(), transformer, vfile);
    return compile(finalizer.finalize());
  };
};

export default attachBrocatelCompiler;
