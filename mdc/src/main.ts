import { directiveFromMarkdown } from 'mdast-util-directive';
import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { directive } from 'micromark-extension-directive';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkJoinCJKLines from 'remark-join-cjk-lines';
import remarkParse from 'remark-parse';
import { Processor, unified } from 'unified';
import { VFile } from 'vfile';

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
    this.remark = unified()
      .use(remarkParse)
      .use(function micromarkPlugin() {
        const data = this.data();
        data.fromMarkdownExtensions = [[directiveFromMarkdown], [mdxExpressionFromMarkdown]];
        data.micromarkExtensions = [mdxExpression(), directive()];
      })
      .use(remarkJoinCJKLines)
      .use(brocatelCompile);
  }

  /**
   * Compiles one Markdown file.
   *
   * @param content Markdown
   */
  async compile(content: string): Promise<VFile> {
    return this.remark.process(content);
  }

  /**
   * Compiles Markdown contents into string.
   *
   * @param content Markdown
   * @returns Lua table
   */
  async compileToString(content: string): Promise<string> {
    const file = await this.compile(content);
    if (file.messages.length > 0) {
      throw new Error(`${file.message.length} compilation warning(s): \n${file.messages.join('\n')}`);
    }
    return file.toString();
  }
}

export = BrocatelCompiler;
