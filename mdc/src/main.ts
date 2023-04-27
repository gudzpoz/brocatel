import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkParse from 'remark-parse';
import { Processor, unified } from 'unified';

import brocatelCompile from './compiler';

/**
 * Configurations.
 */
interface CompilerConfig {
}

/**
 * The compiler.
 */
class BrocatelCompiler {
  config: CompilerConfig;

  remark: Processor;

  constructor(config: CompilerConfig) {
    this.config = config;
    this.remark = unified().use(remarkParse).use(function mdxExpressionPlugin() {
      const data = this.data();
      data.fromMarkdownExtensions = [[mdxExpressionFromMarkdown]];
      data.micromarkExtensions = [mdxExpression()];
    }).use(brocatelCompile);
  }

  /**
   * Compiles one Markdown file.
   *
   * @param content Markdown
   */
  async compile(content: string): Promise<string> {
    const file = await this.remark.process(content);
    return file.value.toString();
  }
}

export = BrocatelCompiler;
