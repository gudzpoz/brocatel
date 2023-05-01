import { directiveFromMarkdown } from 'mdast-util-directive';
import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { directive } from 'micromark-extension-directive';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkJoinCJKLines from 'remark-join-cjk-lines';
import remarkParse from 'remark-parse';
import { Processor, unified } from 'unified';
import { VFile } from 'vfile';

import brocatelCompile from './compiler';
import { convertValue } from './lua';

/**
 * Configurations.
 */
interface CompilerConfig {
  /**
   * Requiring correct Markdown paragraphs.
   *
   * AutoNewLine adds line breaks, allowing the Markdown file to be more compact.
   */
  noAutoNewLine?: boolean;
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
   * Compiles a bunch of Markdown files.
   *
   * @param name the name of the entry Markdown file
   * @param content the content fo the entry file
   * @param fetcher a function that fetches the content of the given filename
   */
  async compileAll(name: string, fetcher: (name: string) => Promise<string>) {
    const target = new VFile();
    const files: { [name: string]: VFile | null } = {};
    const globalLua: string[] = [];

    const asyncCompile = async (task: string) => {
      const content = await fetcher(task);
      if (!content) {
        target.message(`cannot load file ${task}(.md)`);
      } else {
        const file = await this.compile(content);
        files[task] = file;
        globalLua.push(...file.data.globalLua as string[]);
        const tasks: Promise<any>[] = [];
        (file.data.dependencies as Set<string>).forEach((f) => {
          if (typeof files[f] === 'undefined') {
            files[task] = null;
            tasks.push(asyncCompile(f));
          }
        });
        await Promise.all(tasks);
      }
    };
    await asyncCompile(name);

    const root = Object.fromEntries(
      Object.entries(files).map(([f, v]) => [f, { raw: v?.toString() }]),
    );
    root[''] = { version: 1, entry: name } as any;
    return `${globalLua.join('\n')}\nreturn ${convertValue(root, true)}`;
  }

  /**
   * Compiles one Markdown file.
   *
   * @param content Markdown
   */
  async compile(content: string): Promise<VFile> {
    let preprocessed = content.replace(/\r\n/g, '\n');
    if (!this.config.noAutoNewLine) {
      preprocessed = content
        .replace(/\s+/g, (s) => {
          if (s.startsWith('\n') && !s.includes('\n', 1)) {
            return `\n${s}`;
          }
          return s;
        });
    }
    return this.remark.process(preprocessed);
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

export default BrocatelCompiler;
