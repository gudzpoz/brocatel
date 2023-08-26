import { headingSchema, paragraphSchema } from '@milkdown/preset-commonmark';
import { $inputRule, $view } from '@milkdown/utils';

import HeadingView from './HeadingView';
import ParagraphView from './ParagraphView';
import { InputRule } from '@milkdown/prose/inputrules';

export const detailedHeadingView = $view(
  headingSchema.node,
  () => (node) => new HeadingView(node),
);

export const specialParagraphView = $view(
  paragraphSchema.node,
  (ctx) => (node, view, getPos) => new ParagraphView(ctx, node, view, getPos),
);

export const emptyLinkPlugin = $inputRule(() => new InputRule(/\[\]$/, '[\u200B]'));

export const betterViewPlugin = [
  detailedHeadingView,
  emptyLinkPlugin,
  specialParagraphView,
].flat();
