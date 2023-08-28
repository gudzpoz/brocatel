import { type MilkdownPlugin } from '@milkdown/ctx';
import { $remark } from '@milkdown/utils';
import remarkSqueezeParagraphs from 'remark-squeeze-paragraphs';
import { visit } from 'unist-util-visit';

import { BIG_LEFT_BRACE, BIG_RIGHT_BRACE } from '../nodes/mdx';

export const remarkSqueezeParagraphPlugin = $remark('remarkSqueezeParagraphs', () => remarkSqueezeParagraphs);

export const remarkReplaceEscapedBraces = $remark('remarkReplaceEscapedBraces', () => () => (root) => {
  visit(root, (node) => node.type === 'text', (node) => {
    const text = node as { value: string };
    text.value = text.value.replace(/\{/g, BIG_LEFT_BRACE).replace(/\}/g, BIG_RIGHT_BRACE);
  });
});

export const normalizationPlugin: MilkdownPlugin[] = [
  remarkSqueezeParagraphPlugin,
  remarkReplaceEscapedBraces,
].flat();
