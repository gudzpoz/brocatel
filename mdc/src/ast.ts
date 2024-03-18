import {
  BlockContent, Content, ListContent, Parent as MdAstParent,
} from 'mdast';
import { ContainerDirective } from 'mdast-util-directive';
import { Root } from 'remark-parse/lib';
import { Data, Parent, Node } from 'unist';

export type MarkdownNode = BlockContent | Content | ListContent | ContainerDirective | Root;
export type MarkdownParent = MarkdownNode & MdAstParent | ContainerDirective | ListContent;

export type PathSegment = number | string;
/**
 * A relative table path used only when compiling.
 */
export type RelativePath = PathSegment[];

export interface StoryRoutineInfo {
  parameters: string[],
}

/**
 * The metadata node of an array.
 */
export interface Metadata extends Data {
  /**
   * Label for the current array.
   */
  label?: string;
  /**
   * Paths to labeled children.
   */
  labels: { [label: string]: RelativePath };
  /**
   * Function info.
   */
  routine?: StoryRoutineInfo,
}

export type LuaElement = LuaArray | LuaText | LuaLink | LuaIfElse | LuaCode;

/**
 * The main kind of branch nodes in the Lua format.
 *
 * Transpiled into `[ metadata, ...children ]`.
 *
 * ## Markdown equivalence
 *
 * Any block of Markdown lines will turn into one or multiple LuaArrays.
 * Also, every heading generates a new labeled LuaArray.
 */
export interface LuaArray extends Parent<LuaElement, Metadata> {
  type: 'array';
  /**
   * The original node.
   */
  node: MarkdownNode;
}

/**
 * A transformed node tracking the original node.
 */
export interface LuaNode extends Node {
  /**
   * The original node.
   */
  node: MarkdownNode;
}

export type LuaTags = { [key: string]: string };

/**
 * The text node.
 *
 * It is either transpiled into a plain string, or a tagged text node.
 *
 * ## Markdown equivalence
 *
 * Lines. Texts. Normal paragraphs.
 *
 * (See LuaLink and LuaIfElse for "abnormal" paragraphs.)
 */
export interface LuaText extends LuaNode {
  type: 'text';
  text: string;
  /**
   * Tags, used by external programs (i.e. your games).
   */
  tags: LuaTags;
  /**
   * Values used for interpolation.
   */
  values: { [key: string]: string };
  /**
   * The plural value. See `ngettext`.
   */
  plural?: string;
  /**
   * Original text in Markdown format, used for translation.
   */
  original?: string;
}

/**
 * A relative link.
 *
 * If `root` is specified, the lookup starts from the root node of that `root` file.
 * Otherwise, the lookup starts where the current node lies.
 *
 * ## Markdown equivalence
 *
 * Paragraphs containing only a Markdown link are treated as LuaLinks.
 */
export interface LuaLink extends LuaNode {
  type: 'link';
  /**
   * Hierarchical labels.
   */
  labels: string[];
  /**
   * The root file.
   */
  root?: string;
  /**
   * Parameters.
   */
  params?: string;
}

/**
 * A simple if-else statement.
 *
 * It gets transpiled into `{ function()return ... end, ifThen, otherwise }`.
 *
 * ## Markdown equivalence
 *
 * Paragraphs starting with an inlineCode snippet are treated as conditionals,
 * except when the snippet is the only element in the paragraph, which will
 * get treated as an inline LuaCode snippet.
 *
 * Conditional links should be supported: `` `conditional` [](somewhere) ``.
 */
export interface LuaIfElse extends Parent<LuaArray> {
  type: 'if-else';
  /**
   * A Lua expresssion (e.g. `true`, `#list == 1`, etc.).
   */
  condition: string;
  /**
   * Branches.
   *
   * - The first element: the branch to jump to if the condition is satisfied.
   * - The second: otherwise.
   */
  children: [LuaArray] | [LuaArray, LuaArray];
  /**
   * The original node.
   */
  node: MarkdownNode;
}

/**
 * A Lua snippet.
 *
 * Its children are arbitrary parameters, probably coming from macros.
 *
 * ## Markdown equivalence
 *
 * A snippet without arguments:
 * ~~~markdown
 * ```lua
 * print("ok")
 * ```
 * ~~~
 *
 * To pass arguments, you will need to use a special macro `do`:
 * ~~~markdown
 * ```lua
 * function my_func(args)
 *   do_something_with(args)
 * end
 * ```
 *
 * :::do[my_func]
 * - List Item A
 * - List Item B
 * - List Item C
 * :::
 * ~~~
 *
 * (The `do` macro manipulates internal data in the AST nodes.)
 */
export interface LuaCode extends Parent<LuaArray> {
  type: 'func';
  /**
   * The Lua snippet (e.g. `return true`, `a = 1`, etc.).
   */
  code: string;
  /**
   * The original node.
   */
  node: MarkdownNode;
}

/**
 * The amalgamation result.
 *
 * Its children are the root nodes compiled from Markdown files,
 * whose filenames are recorded in the `files` field.
 */
export interface LuaEntry extends Parent<LuaArray> {
  type: 'root';
  ['']: {
    entry: string;
    version: number;
  };
  files: string[];
}

export function luaArray(node: MarkdownNode, label?: string, parameters?: string[]): LuaArray {
  return {
    type: 'array',
    data: {
      labels: {},
      label,
      routine: parameters ? { parameters } : undefined,
    },
    children: [],
    node,
  };
}
