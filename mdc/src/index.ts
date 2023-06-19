import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import remarkJoinCJKLines from 'remark-join-cjk-lines';
import remarkParse from 'remark-parse';
import { Processor, unified } from 'unified';
import { VFile } from 'vfile';

import _fengari from 'fengari';
import _fengari_js from 'fengari-interop';
import astCompiler, { serializeTableInner } from './ast-compiler';
import { directiveFromMarkdown } from './directive';
import expandMacro from './expander';
import transformAst from './transformer';

import { convertSingleLuaValue } from './lua';

const VERSION = 1;

/**
 * Configurations.
 */
export interface CompilerConfig {
  /**
   * Requiring correct Markdown paragraphs.
   *
   * AutoNewLine adds line breaks, allowing the Markdown file to be more compact.
   */
  noAutoNewLine?: boolean;
}

function removeMdExt(name: string): string {
  if (name.toLowerCase().endsWith('.md')) {
    return name.substring(0, name.length - 3);
  }
  return name;
}

/**
 * The compiler.
 */
export class BrocatelCompiler {
  config: CompilerConfig;

  remark: Processor;

  constructor(config: CompilerConfig) {
    this.config = config;
    this.remark = unified()
      .use(remarkParse)
      .use(function remarkMdx() {
        // Remark-Mdx expects the expressions to be JS expressions,
        // while we use them as Lua ones.
        const data = this.data();
        data.fromMarkdownExtensions = [[mdxExpressionFromMarkdown]];
        data.micromarkExtensions = [mdxExpression()];
      })
      .use(remarkJoinCJKLines)
      .use(directiveFromMarkdown)
      .use(expandMacro)
      .use(transformAst)
      .use(astCompiler);
  }

  /**
   * Compiles a bunch of Markdown files.
   *
   * @param name the name of the entry Markdown file
   * @param content the content fo the entry file
   * @param fetcher a function that fetches the content of the given filename
   */
  async compileAll(name: string, fetcher: (name: string) => Promise<string>) {
    const target = new VFile({ path: `${removeMdExt(name)}.lua` });
    const files: { [name: string]: VFile | null } = {};
    const input: { [name: string]: VFile } = {};
    const globalLua: string[] = [];

    const asyncCompile = async (filename: string) => {
      const task = removeMdExt(filename);
      const content = await fetcher(task);
      if (!content) {
        target.message(`cannot load file ${task}(.md)`);
      } else {
        const file = await this.compile(content);
        files[task] = file;
        const processed = new VFile({ path: task });
        input[task] = processed;
        processed.messages.push(...file.messages);
        processed.value = content;

        globalLua.push(...file.data.globalLua as string[]);
        const tasks: Promise<any>[] = [];
        (file.data.dependencies as Set<string>).forEach((f) => {
          if (typeof files[removeMdExt(f)] === 'undefined') {
            files[task] = null;
            tasks.push(asyncCompile(f));
          }
        });
        await Promise.all(tasks);
      }
    };
    await asyncCompile(name);

    const contents = serializeTableInner(files, (v) => {
      if (!v) {
        return 'nil';
      }
      target.messages.push(...v.messages);
      return v.toString();
    });
    target.value = `${globalLua.join('\n')}
return {[""]={version=${VERSION},entry=${JSON.stringify(removeMdExt(name))}},${contents}}
`;
    target.data.input = input;
    return target;
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
_fengari.js = _fengari_js;
_fengari.tojs = convertSingleLuaValue;
export const fengari = _fengari;
