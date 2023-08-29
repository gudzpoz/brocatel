import remarkInlineMdx from './mdx';

export {
  directiveLabel,
  directiveLabelType,
  directiveForMarkdown,
  directiveToMarkdown,
  type ContainerDirectiveLabel,
} from './directive';

export {
  getAnchorString,
  isNormalLink,
} from './spec';

export const mdxForMarkdown = remarkInlineMdx;
