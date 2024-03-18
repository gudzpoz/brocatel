import remarkFrontmatter from 'remark-frontmatter';
import remarkJoinCJKLines from 'remark-join-cjk-lines';
import remarkParse from 'remark-parse';
import { Processor, unified } from 'unified';
import { VFile } from 'vfile';
import _wasmoon from 'wasmoon';

import { directiveForMarkdown, mdxForMarkdown } from '@brocatel/md';

import astCompiler, { serializeTableInner } from './ast-compiler';
import expandMacro from './expander';
import remapLineNumbers from './line-remap';
import transformAst from './transformer';
import { LuaGettextData, compileGettextData } from './lgettext';

export {
  StoryRunner, type SelectLine, type TextLine, type StoryLine,
} from './lua';

const VERSION = 1;

/**
 * Configurations.
 */
export interface CompilerConfig {
  /**
   * Requiring correct Markdown paragraphs.
   *
   * AutoNewLine adds line breaks, allowing the Markdown file to be more compact.
   *
   * Default: `true`.
   */
  autoNewLine?: boolean;
  /**
   * Whether to attach debug info.
   *
   * Default: `true`.
   */
  debug?: boolean;
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
    this.config = {
      autoNewLine: true,
      debug: true,
      ...config,
    };
    this.remark = unified()
      .use(remarkParse)
      .use(remarkJoinCJKLines)
      .use(remarkFrontmatter, ['yaml'])
      .use(remapLineNumbers)
      .use(directiveForMarkdown)
      .use(mdxForMarkdown)
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
    const stem = removeMdExt(name);
    const target = new VFile({ path: `${stem}.lua` });
    const gettextTarget = new VFile({ path: `${stem}.pot` });
    const files: Record<string, VFile | null> = {};
    const input: Record<string, VFile> = {};
    const globalLua: string[] = [];

    const asyncCompile = async (filename: string) => {
      const task = removeMdExt(filename);
      const content = await fetcher(task);
      if (!content) {
        target.message(`cannot load file ${task}(.md)`);
      } else {
        const file = await this.compile(content, filename);
        if (file.data.IFID && !target.data.IFID) {
          target.data.IFID = file.data.IFID;
        }
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

    const gettextData: LuaGettextData[] = [];
    const contents = serializeTableInner(files, (v) => {
      if (!v) {
        return 'nil';
      }
      if (v.data.gettext) {
        gettextData.push(v.data.gettext as LuaGettextData);
      }
      target.messages.push(...v.messages);
      return v.toString();
    });
    const uuids = target.data.IFID ? `IFID={${
      (target.data.IFID as string[])
        .map((u) => JSON.stringify(`UUID://${u}//`))
        .join(',')
    }},` : '';
    target.value = `${globalLua.join('\n')}
_={}
return {[""]={\
${uuids}\
version=${VERSION},\
entry=${JSON.stringify(removeMdExt(name))}\
},${contents}}`;
    target.data.input = input;
    gettextTarget.value = compileGettextData(gettextData);
    target.data.gettext = gettextTarget;
    return target;
  }

  /**
   * Compiles one Markdown file.
   *
   * @param content Markdown
   */
  async compile(content: string, filename?: string): Promise<VFile> {
    const preprocessed = content.replace(/\r\n/g, '\n');
    let vfile: VFile | null = null;
    if (this.config.autoNewLine) {
      const originalLineNumbers: number[] = [];
      const newLineNumbers: number[] = [];
      const lines = preprocessed.split('\n');
      const newLines: string[] = [];
      const empty = /^\s+$/;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        originalLineNumbers.push(i);
        newLineNumbers.push(newLines.length);
        newLines.push(line);
        if (!empty.test(line)) {
          if (i + 1 >= lines.length || !empty.test(lines[i + 1])) {
            newLines.push('');
          }
        }
      }
      vfile = new VFile(newLines.join('\n'));
      vfile.path = filename ?? '<unknown>';
      vfile.data.lineMapping = {
        original: originalLineNumbers,
        newLines: newLineNumbers,
      };
    } else {
      vfile = new VFile(preprocessed);
    }
    if (this.config.debug) {
      vfile.data.debug = true;
    }
    return this.remark.process(vfile);
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

export const wasmoon = _wasmoon;
