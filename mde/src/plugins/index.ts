import { directivePlugin } from '../nodes/directive';
import { mdxPlugin } from '../nodes/mdx';
import { normalizationPlugin } from './normalize';

export default [
  directivePlugin,
  mdxPlugin,
  normalizationPlugin,
].flat();
