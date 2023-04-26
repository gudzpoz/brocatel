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
    this.remark = unified().use(remarkParse).use(brocatelCompile);
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
