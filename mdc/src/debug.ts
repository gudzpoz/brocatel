import { Root } from 'mdast';
import { SourceMapConsumer, SourceNode } from 'source-map-js';
import { Position } from 'unist';
import { VFile } from 'vfile';

import { MarkdownSourceError } from '@brocatel/md';

import { LuaArray, LuaLink } from './ast';
import type { LuaGettextData } from './lgettext';

export type { VFile as VirtualFile } from 'vfile';
export type { SourceNode } from 'source-map-js';
export type { LuaGettextData } from './lgettext';
export type { MarkdownSourceError, MarkdownPoint } from '@brocatel/md';

export interface LuaHeadingTree {
  position?: Position;
  children: Record<string, LuaHeadingTree>;
}

export function toHeadingTree(root: LuaArray) {
  const tree: LuaHeadingTree = { position: root.node.position, children: {} };
  Object.entries(root.data?.labels ?? {}).forEach(([name, node]) => {
    tree.children[name] = toHeadingTree(node.node);
  });
  return tree;
}

export interface CodeSnippet {
  expression: boolean;
  position?: Position;
  value: string;
}

export interface LineMapping {
  original: number[];
  newLines: number[];
}

export type StoryLink = Omit<LuaLink, 'node'>;

export function toLink(link: LuaLink): StoryLink {
  const { node, ...rest } = link;
  rest.position = node.position;
  return rest;
}

export interface CompilationData {
  debug: boolean;

  IFID?: string[];
  codeSnippets?: CodeSnippet[];
  dependencies?: Map<string, StoryLink>;
  gettext?: LuaGettextData;
  globalLua?: SourceNode[];
  headings?: LuaHeadingTree;
  lineMapping?: LineMapping;
  links?: StoryLink[];
  markdown?: Root;
  sourceMap?: SourceNode;
}

// TypeScript type augmentation is too performance intensive
// and hard to configure an IDE for.
// So we are simply wrapping data with a function call.

export function getData(vfile: VFile): CompilationData {
  const { data } = vfile;
  data.debug = !!data.debug;
  return data as { debug: boolean };
}

export interface RootData {
  IFID?: string[];
  gettext?: VFile;
  inputs?: Record<string, VFile>;
  sourceMap?: SourceNode;
}

export function getRootData(vfile: VFile): RootData {
  return vfile.data as RootData;
}

export function luaErrorToSource(data: RootData, e?: Error): MarkdownSourceError | null {
  if (!(e?.message)) {
    return null;
  }
  const info = e.message.split('\n')[0];
  const match = /\[string "<input>"\]:(\d+): (.*)$/.exec(info);
  const { sourceMap } = data;
  if (!match || !sourceMap) {
    return null;
  }
  const line = Number(match[1]); // 1-based
  const column = 0; // 0-based
  const mapper = new SourceMapConsumer(
    JSON.parse(sourceMap.toStringWithSourceMap().map.toString()),
  );
  const position = mapper.originalPositionFor({ line, column });
  return {
    message: match[2],
    source: position.source,
    start: {
      line: position.line,
      column: position.column + 1, // 0-base to 1-based
    },
  };
}
