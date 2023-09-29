import { directivePlugin } from '../nodes/directive';
import { mdxPlugin } from '../nodes/mdx';
import { tagPlugin } from '../nodes/tag';
import { normalizationPlugin } from './normalize';

export default [
  directivePlugin,
  mdxPlugin,
  tagPlugin,
  normalizationPlugin,
].flat();
