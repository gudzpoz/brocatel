import { type MilkdownPlugin } from '@milkdown/ctx';
import { directivePlugin } from './directive-plugin';
import { mdxPlugin } from './mdx-plugin';
import { normalizationPlugin } from './normalize-plugin';

export { directivePlugin } from './directive-plugin';
export { mdxPlugin } from './mdx-plugin';
export { normalizationPlugin } from './normalize-plugin';
export { useBetterViewPlugins } from './views/better-view-plugin';

export const plugins: MilkdownPlugin[] = [
  directivePlugin,
  mdxPlugin,
  normalizationPlugin,
].flat();
