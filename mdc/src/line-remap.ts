import { Root } from 'mdast';
import { Plugin } from 'unified';
import { Node } from 'unist';
import { visitParents } from 'unist-util-visit-parents';
import { VFile } from 'vfile';

import { getData } from './debug';

const remapLineNumbers: Plugin = () => (rootNode: Node, vfile: VFile) => {
  const data = getData(vfile);
  if (!data.lineMapping) {
    return rootNode;
  }
  const { original, newLines } = data.lineMapping;
  const root = rootNode as Root;
  function binarySearch(value: number, start: number, end: number): number {
    if (end - start <= 1) {
      return start;
    }
    if (newLines[start] === value) {
      return start;
    }
    const middle = Math.floor((end + start) / 2);
    if (newLines[middle] > value) {
      return binarySearch(value, start, middle);
    }
    return binarySearch(value, middle, end);
  }
  visitParents(root, (node) => {
    const pos = node.position;
    if (pos) {
      pos.start.line = original[binarySearch(pos.start.line, 0, newLines.length)] + 1;
      pos.end.line = original[binarySearch(pos.end.line, 0, newLines.length)] + 1;
      pos.start.offset = 0;
      pos.end.offset = 0;
    }
  });
  return root;
};

export default remapLineNumbers;
