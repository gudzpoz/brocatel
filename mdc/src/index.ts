import _wasmoon from 'wasmoon';
import * as debugging from './debug';
import * as utils from './utils';

export {
  StoryRunner,
  type SelectLine,
  type TextLine,
  type StoryLine,
} from './lua';

export * from './compiler';

export const wasmoon = _wasmoon;

/**
 * Currently there are mainly three types of errors:
 * 1. Compile-time errors, exposed through the `VFile` interface (in its `messages` field).
 * 2. Runtime Lua errors from user code.
 * 3. Runtime Lua errors emitted by the VM.
 *
 * The first kind contains source location info. However, the other two don't
 * and need manual extraction by using source maps from the VM or embedded debug info:
 *
 * - Most Lua runtimes contains line numbers in their error messages. With the line numbers,
 *   a source map can maps to its corresponding Markdown source location.
 * - If the error originates in the VM code or if there is just no source maps, however,
 *   the source-map approach no longer applies, and we will need to extract the debug info
 *   manually (with the `VM:ip_debug_info` API on the Lua side).
 *
 * The utilities contained in the debug namespace aim to aid the extraction and help
 * attaching type hints for values passed from the Lua side.
 */
export namespace debug {
  export type MarkdownSourceError = debugging.MarkdownSourceError;
  export type InvalidNode = debugging.InvalidNode;
  export const { getData, getRootData, luaErrorToSource, nodeInfoToSourceError } = debugging;
  export const point2Position = utils.point2Position;
  export type CompilationData = debugging.CompilationData;
  export type RootData = debugging.RootData;

  export type CodeSnippet = debugging.CodeSnippet;
  export type LuaGettextData = debugging.LuaGettextData;
  export type LuaHeadingTree = debugging.LuaHeadingTree;
  export type LineMapping = debugging.LineMapping;
  export type SourceNode = debugging.SourceNode;
  export type StoryLink = debugging.StoryLink;
  export type VFile = debugging.VirtualFile;
}

import * as utilPinpoint from './unist-util-pinpoint';
export namespace util {
  export const pinpoint = utilPinpoint.pinpoint;
  export type Point = utilPinpoint.Point;
}
