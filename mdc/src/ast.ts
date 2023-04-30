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

export type ParentEdge = [ValueNode | MetaArray, RelativePath];

/**
 * Nodes in the AST tree.
 */
export interface TreeNode {
  type: string;
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
  type: 'text';
  text: string;
  tags: string[];
  plural: string;
  values: TextValues;
}

/**
 * A link node (relative).
 */
export interface LinkNode extends TreeNode {
  type: 'link';
  link: RelativePath;
  rootName?: string;
}

/**
 * A if-else node.
 */
export interface IfElseNode extends TreeNode {
  type: 'if-else';
  condition: LuaSnippet,
  ifThen?: MetaArray,
  otherwise?: MetaArray,
}

/**
 * A function call node.
 */
export interface LuaNode extends TreeNode {
  type: 'func';
  func: { raw: LuaSnippet },
  args: MetaArray[],
}

/**
 * A selection node.
 */
export interface SelectNode extends TreeNode {
  type: 'select';
  select: MetaArray[];
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
  type: 'meta';
  /**
   * All direct labels of children.
   */
  labels: Labels;
  /**
   * All direct/indirect labels of children.
   */
  children: { [label: string]: Path[] };
  /**
   * References, used to look up children by labels.
   */
  refs: { [label: string]: MetaArray };
  /**
   * Upper node where the label is stored.
   */
  upper?: MetaArray;
  /**
   * Label for the current node, temporary.
   */
  label?: string;
}

/**
 * Arrays with metadata.
 */
export interface MetaArray extends TreeNode {
  type: 'array';
  meta: Metadata;
  children: (ValueNode | MetaArray)[];
}

export function metaArray(node: Node, parent: ParentEdge | null, label?: string): MetaArray {
  return {
    type: 'array',
    meta: {
      type: 'meta',
      labels: {},
      children: {},
      refs: {},
      label,
    },
    children: [],
    node,
    parent,
  };
}
