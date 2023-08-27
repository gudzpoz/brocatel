import { type MilkdownPlugin } from '@milkdown/ctx';
import { $remark } from '@milkdown/utils';
import remarkSqueezeParagraphs from 'remark-squeeze-paragraphs';

export const remarkSqueezeParagraphPlugin = $remark('remarkSqueezeParagraphs', () => remarkSqueezeParagraphs);

export const normalizationPlugin: MilkdownPlugin[] = [
  remarkSqueezeParagraphPlugin,
].flat();
