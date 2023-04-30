import { Root } from 'mdast';
import { Plugin } from 'unified';
import { VFile } from 'vfile';

import BrocatelFinalizer from './finalizer';
import { convertValue } from './lua';
import AstTransformer from './transformer';

const attachBrocatelCompiler: Plugin = function plugin() {
  function compile(root: any): string {
    return convertValue(root, true);
  }
  this.Compiler = (root: Root, vfile: VFile) => {
    const transformer = new AstTransformer(root, vfile);
    const finalizer = new BrocatelFinalizer(transformer.transform(), transformer, vfile);
    return compile(finalizer.finalize());
  };
};

export default attachBrocatelCompiler;
