import { Root } from 'mdast';
import { mdxExpressionFromMarkdown, mdxExpressionToMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import type { Plugin } from 'unified';

const remarkInlineMdx: Plugin<any[], Root> = function remarkInlineMdx() {
  // Remark-Mdx expects the expressions to be JS expressions,
  // while we use them as Lua ones.
  const data = this.data();
  function addTo(field: string, ext: any) {
    if (data[field]) {
      (data[field] as Array<any>).push(ext);
    } else {
      data[field] = [ext];
    }
  }
  // We only allow inline mdx (mdxTextExpression), ruling out mdxFlowExpression.
  // Read the definition of mdxExpressionFromMarkdown, mdxExpressionToMarkdown
  //   and mdxExpression to understand the code below.
  addTo('fromMarkdownExtensions', [{
    enter: {
      mdxTextExpression: mdxExpressionFromMarkdown.enter?.mdxTextExpression,
    },
    exit: {
      mdxTextExpression: mdxExpressionFromMarkdown.exit?.mdxTextExpression,
      mdxTextExpressionChunk: mdxExpressionFromMarkdown.exit?.mdxTextExpressionChunk,
    },
  }]);
  addTo('toMarkdownExtensions', {
    extensions: [{
      handlers: {
        mdxTextExpression: (mdxExpressionToMarkdown.handlers as any)?.mdxTextExpression,
      },
      unsafe: mdxExpressionToMarkdown.unsafe,
    }],
  });
  addTo('micromarkExtensions', { text: mdxExpression().text });
};

export default remarkInlineMdx;
