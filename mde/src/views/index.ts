import { type MilkdownPlugin } from '@milkdown/ctx';
import { headingSchema, paragraphSchema } from '@milkdown/preset-commonmark';
import { InputRule } from '@milkdown/prose/inputrules';
import { $inputRule, $view, type $NodeSchema } from '@milkdown/utils';
import { type NodeViewFactory, type VueNodeViewComponent } from '@prosemirror-adapter/vue';

import DirectiveView from './DirectiveView.vue';
import HeadingView from './HeadingView.vue';
import ParagraphView from './ParagraphView.vue';

import { directiveSchema } from '../nodes/directive';

export const emptyLinkPlugin: MilkdownPlugin = $inputRule(() => new InputRule(/\[\]$/, '[\u200B]'));

export function useBetterViewPlugins(nodeViewFactory: NodeViewFactory): MilkdownPlugin[] {
  function view<$Node extends string>(schema: $NodeSchema<$Node>, component: VueNodeViewComponent) {
    return $view(schema.node, () => nodeViewFactory({
      component,
      stopEvent(e) {
        return (e.target as HTMLElement).classList.contains('not-prose');
      },
    }));
  }

  return [
    view(directiveSchema, DirectiveView),
    view(headingSchema, HeadingView),
    view(paragraphSchema, ParagraphView),
    emptyLinkPlugin,
  ].flat();
}
