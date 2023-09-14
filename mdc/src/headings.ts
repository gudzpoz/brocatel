import { VFile } from 'vfile';
import { LuaArray, MarkdownParent, luaArray } from './ast';

export function hasReturned(func: LuaArray): boolean {
  const last = func.children[func.children.length - 1];
  return last?.type === 'func' && last.code.trim() === 'END()';
}

export function appendReturn(array: LuaArray) {
  array.children.push({
    type: 'func',
    code: 'END()',
    children: [],
    node: array.node,
  });
}

export class HeadingStack {
  vfile: VFile;

  root: LuaArray;

  depths: number[];

  stack: LuaArray[];

  constructor(block: MarkdownParent, vfile: VFile) {
    this.vfile = vfile;
    this.root = luaArray(block);
    this.stack = [this.root];
    this.depths = [0];
  }

  lastDepth() {
    return this.depths[this.depths.length - 1];
  }

  last() {
    return this.stack[this.stack.length - 1];
  }

  push(array: LuaArray, depth: number) {
    this.depths.push(depth);
    this.stack.push(array);
  }

  popUntil(depth: number) {
    while (depth <= this.lastDepth()) {
      const last = this.last();
      /* Insert implicit returns at the end of a function:
       * # non-function-1
       * ## a-function {}
       * <-- `---` implicitly inserted here
       * # non-function-2
       */
      if ((depth !== 0 || last.data?.routine) && !hasReturned(last)) {
        appendReturn(last);
      }
      this.depths.pop();
      this.stack.pop();
    }
  }
}
