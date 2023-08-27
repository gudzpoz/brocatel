import { MilkdownPlugin } from '@milkdown/ctx';
import { headingSchema, paragraphSchema } from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { $inputRule, $view } from '@milkdown/utils';

import HeadingView from './HeadingView';
import ParagraphView from './ParagraphView';

export const detailedHeadingView: MilkdownPlugin = $view(
  headingSchema.node,
  () => (node) => new HeadingView(node),
);

export const specialParagraphView: MilkdownPlugin = $view(
  paragraphSchema.node,
  (ctx) => (node, view, getPos) => new ParagraphView(ctx, node, view, getPos),
);

export const emptyLinkPlugin: MilkdownPlugin = $inputRule(() => new InputRule(/\[\]$/, '[\u200B]'));

export const betterViewPlugin: MilkdownPlugin[] = [
  detailedHeadingView,
  emptyLinkPlugin,
  specialParagraphView,
].flat();
