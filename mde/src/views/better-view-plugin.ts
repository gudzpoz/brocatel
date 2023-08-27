import { type MilkdownPlugin } from '@milkdown/ctx';
import { headingSchema, paragraphSchema } from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { $inputRule, $view } from '@milkdown/utils';
import { type NodeViewFactory } from '@prosemirror-adapter/vue';

import HeadingView from './HeadingView.vue';
import ParagraphView from './ParagraphView.vue';

export const emptyLinkPlugin: MilkdownPlugin = $inputRule(() => new InputRule(/\[\]$/, '[\u200B]'));

export function useBetterViewPlugins(nodeViewFactory: NodeViewFactory): MilkdownPlugin[] {
  return [
    $view(headingSchema.node, () => nodeViewFactory({ component: HeadingView })),
    $view(paragraphSchema.node, () => nodeViewFactory({
      component: ParagraphView,
      stopEvent(e) {
        return (e.target as HTMLElement).classList.contains('not-prose');
      },
    })),
    emptyLinkPlugin,
  ].flat();
}
