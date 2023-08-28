import { type MilkdownPlugin } from '@milkdown/ctx';
import Editor from './editor/Editor.vue';
import brocatelPlugins from './plugins/index';

export { directivePlugin } from './nodes/directive';
export { mdxPlugin } from './nodes/mdx';
export { normalizationPlugin } from './plugins/normalize';
export { useBetterViewPlugins } from './views/index';

export const BrocatelEditor = Editor;

export const plugins: MilkdownPlugin[] = brocatelPlugins;
