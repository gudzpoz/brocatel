import { sha256 } from 'js-sha256';
import { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkJoinCJKLines from 'remark-join-cjk-lines';
import remarkParse from 'remark-parse';
import { SourceNode } from 'source-map-js';
import { Processor, unified } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';
import _wasmoon from 'wasmoon';

import { directiveForMarkdown, mdxForMarkdown } from '@brocatel/md';

import astCompiler from './ast-compiler';
import * as debugging from './debug';
import expandMacro from './expander';
import { LuaGettextData, compileGettextData } from './lgettext';
import remapLineNumbers from './line-remap';
import { InvalidNode, StoryRunner } from './lua';
import LuaTableGenerator from './lua-table';
import transformAst from './transformer';
import * as utils from './utils';

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

function packBundle(
  name: string,
  target: VFile,
  inputs: Record<string, VFile>,
  outputs: Record<string, VFile | null>,
  globalLua: SourceNode[],
): [SourceNode, LuaGettextData[], string] {
  const data = debugging.getRootData(target);
  const gettextData: LuaGettextData[] = [];
  const contents = new LuaTableGenerator();
  const checksumPlaceholder = sha256('_brocatel_checksum_placeholder_');
  contents.startTable().pair('')
    .startTable()
    .pair('checksum').value(checksumPlaceholder);

  if (data.IFID) {
    contents.pair('IFID').startTable();
    data.IFID.forEach((u) => {
      contents.value(`UUID://${u}//`);
    });
    contents.endTable();
  }
  contents
    .pair('version')
    .value(VERSION)
    .pair('entry')
    .value(removeMdExt(name))
    .endTable();
  Object.entries(outputs).forEach(([file, v]) => {
    const fdata = v && debugging.getData(v);
    contents.pair(file);
    if (fdata?.sourceMap) {
      const source = fdata.sourceMap;
      source.setSourceContent(file, inputs[file].toString());
      contents.raw(source);
    } else {
      contents.raw(v?.toString() ?? 'nil');
    }
    if (fdata?.gettext) {
      gettextData.push(fdata.gettext);
    }
  });
  contents.endTable();
  const bundle = utils.sourceNode(
    undefined,
    undefined,
    undefined,
    [
      globalLua.map((item) => [item, '\n']).flat(),
      ['_={}\n', 'return ', contents.toSourceNode()],
    ].flat(),
  );
  return [bundle, gettextData, checksumPlaceholder];
}

export async function validate(vfile: VFile) {
  const data = debugging.getRootData(vfile);
  const { inputs } = data;
  const story = new StoryRunner();
  try {
    await story.loadStory(vfile.value.toString());
  } catch (e) {
    const err = debugging.luaErrorToSource(data, e as Error);
    if (err) {
      const file = inputs?.[removeMdExt(err.source)];
      const point = { line: err.start.line, column: err.start.column };
      (file ?? vfile).message('invalid lua code', {
        start: point, end: err.end ?? point,
      });
    } else {
      vfile.message(`invalid lua code found: ${e}`);
    }
    return;
  }
  if (!story.isLoaded()) {
    throw new Error('story not loaded');
  }
  const invalidLinks: InvalidNode[] | Record<string, InvalidNode> = story.L!
    .doStringSync('return story:validate_links()');
  (Array.isArray(invalidLinks)
    ? invalidLinks
    : Object.values(invalidLinks)
  ).forEach((l) => {
    const position = l.source ? debugging.sourceToPosition(l.source) : null;
    inputs?.[l.root]?.message(
      `link target not found: ${l.node.root ?? ''}#${l.node.link?.join('#')}`,
      position,
    );
  });
}

/**
 * The compiler.
 */
export class BrocatelCompiler {
  config: CompilerConfig;

  remark: Processor<Root, Node, Node>;

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
    const rootData = debugging.getRootData(target);
    const gettextTarget = new VFile({ path: `${stem}.pot` });
    const outputs: Record<string, VFile | null> = {};
    const inputs: Record<string, VFile> = {}; // processed files
    const globalLua: SourceNode[] = [];

    const asyncCompile = async (filename: string) => {
      const task = removeMdExt(filename);
      let content;
      try {
        content = await fetcher(task);
      } catch (e) {
        target.message(`cannot load file ${task}(.md)`);
        return;
      }
      if (!content) {
        target.message(`cannot load file ${task}(.md)`);
        return;
      }
      const file = await this.compile(content, filename);
      const data = debugging.getData(file);
      // Only IFIDs from the first (i.e. the main file) is extracted.
      if (data.IFID && !rootData.IFID) {
        rootData.IFID = data.IFID;
      }
      outputs[task] = file;
      const processed = new VFile({ path: `${task}.md` });
      inputs[task] = processed;
      processed.messages.push(...file.messages);
      processed.value = content;
      processed.data = file.data;

      globalLua.push(...data.globalLua || []);
      const tasks: Promise<any>[] = [];
      (data.dependencies ?? new Map()).forEach((_, f) => {
        if (typeof outputs[removeMdExt(f)] === 'undefined') {
          outputs[f] = null;
          tasks.push(asyncCompile(f));
        }
      });
      await Promise.all(tasks);
    };
    await asyncCompile(name);

    const [bundle, gettextData, checksumPlaceholder] = packBundle(
      name,
      target,
      inputs,
      outputs,
      globalLua,
    );
    const placeholded = bundle.toString();
    target.value = placeholded.replace(checksumPlaceholder, sha256(placeholded));
    rootData.sourceMap = bundle;
    rootData.inputs = inputs;
    gettextTarget.value = compileGettextData(gettextData);
    rootData.gettext = gettextTarget;
    try {
      await validate(target);
    } catch (e) {
      target.message(e as Error);
    }
    Object.values(inputs).forEach((v) => {
      target.messages.push(...v.messages);
    });
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
      debugging.getData(vfile).lineMapping = {
        original: originalLineNumbers,
        newLines: newLineNumbers,
      };
    } else {
      vfile = new VFile(preprocessed);
    }
    if (this.config.debug) {
      debugging.getData(vfile).debug = true;
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
      throw new Error(
        `${file.message.length} compilation warning(s): \n${file.messages.join(
          '\n',
        )}`,
      );
    }
    return file.toString();
  }
}
