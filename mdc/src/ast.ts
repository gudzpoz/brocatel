import { Node } from 'unist';

export type PathSegment = number | string;
/**
 * A relative table path used only when compiling.
 */
export type RelativePath = PathSegment[];
/**
 * Compiled absolute path.
 */
export type Path = PathSegment[];

/**
 * Lua scripts.
 */
export type LuaSnippet = string;

export type ParentEdge = [TreeNode, RelativePath];

/**
 * Nodes in the AST tree.
 */
export interface TreeNode {
  type?: 'link' | 'func' | 'select' | 'text';
  node: Node | null;
  parent: ParentEdge | null;
}

/**
 * Required Lua evaluation in text nodes.
 */
export interface TextValues {
  [key: string]: LuaSnippet;
}
/**
 * The text node, for both plain texts and tagged ones.
 */
export interface TextNode extends TreeNode {
  text: string;
  tags?: string[];
  plural?: string;
  values?: TextValues;
}

/**
 * A link node (relative).
 */
export interface LinkNode extends TreeNode {
  link: RelativePath;
  rootName?: string;
}

/**
 * A if-else node.
 */
export interface IfElseNode extends TreeNode {
  condition: LuaSnippet,
  ifThen?: MetaArray,
  otherwise?: MetaArray,
}

/**
 * A function call node.
 */
export interface LuaNode extends TreeNode {
  lua: LuaSnippet,
  args?: MetaArray,
}

/**
 * A selection node.
 */
export interface SelectNode extends TreeNode {
  options: MetaArray[];
}

/**
 * Values.
 */
export type ValueNode = TextNode | LinkNode | IfElseNode | LuaNode | SelectNode;

/**
 * Relative paths to childrens with labels.
 */
export interface Labels {
  [label: string]: Path;
}

export interface Metadata {
  /**
   * All direct labels of children.
   */
  labels?: Labels;
  /**
   * Label for the current node, temporary.
   */
  label?: string;
}

/**
 * Arrays with metadata.
 */
export interface MetaArray extends TreeNode {
  meta: Metadata;
  chilren: (ValueNode | MetaArray)[];
}
