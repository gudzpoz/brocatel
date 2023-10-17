import { type MilkdownPlugin } from '@milkdown/ctx';
import Editor from './editor/BrocatelEditor.vue';
import brocatelPlugins from './plugins/index';

export type { Diagnostic } from '@codemirror/lint';

export { directivePlugin } from './nodes/directive';
export { mdxPlugin } from './nodes/mdx';
export { normalizationPlugin } from './plugins/normalize';
export { useBetterViewPlugins } from './views/index';

export const BrocatelEditor: typeof Editor = Editor;

export const plugins: MilkdownPlugin[] = brocatelPlugins;
