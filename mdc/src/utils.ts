import { Paragraph } from 'mdast';
import { SourceNode } from 'source-map-js/lib/source-node';
import { Node, Point, Position } from 'unist';

/**
 * Shallow-copeis an object.
 *
 * @param node the object
 * @returns a new object with fields from the supplied one
 */
export function shallowCopy<T extends object>(node: T): T {
  return Object.fromEntries(Object.entries(node)) as T;
}

/**
 * Removes all fields from the target object and assigns all from the value object.
 *
 * @param target the node to get assigned to
 * @param value the value node where the assigned values come from
 */
export function overwrite<T extends Node>(target: Node, value: T): T {
  const { position, data } = target;
  const o = target as any;
  Object.keys(o).forEach((key) => delete o[key]);
  Object.entries(value).forEach(([k, v]) => { o[k] = v; });
  if (!o.data && data) {
    o.data = data;
  }
  if (!o.position && position) {
    o.position = position;
  }
  return o as T;
}

/**
 * Returns a new paragraph almost identical to the provided one, with a few children removed.
 *
 * @param para the paragraph
 * @param start the starting child index
 * @returns a new paragraph
 */
export function subParagraph(para: Paragraph, start: number): Paragraph {
  const children: typeof para.children = [];
  for (let i = start; i < para.children.length; i += 1) {
    const node = para.children[i];
    // Strip starting spaces.
    if (children.length === 0 && node.type === 'text') {
      const value = node.value.trimStart();
      if (value) {
        const trimmed = shallowCopy(node);
        trimmed.value = value;
        children.push(trimmed);
      }
    } else {
      children.push(node);
    }
  }
  const sub = shallowCopy(para);
  sub.children = children;
  return sub;
}

/**
 * Creates a new source node.
 *
 * @param line zero-based line number
 * @param column one-based column number
 * @param file the file name or path
 * @param children contents
 * @returns a new node
 */
export function sourceNode(
  line?: number,
  column?: number,
  file?: string,
  children?: (string | SourceNode)[],
) {
  // source-map-js has bad type annotations.
  return new SourceNode(
    line ?? null as any, // 1-based
    column ? column - 1 : null as any, // 0-based
    file ?? null as any,
    children ?? [] as any,
  );
}

/**
 * Returns a position created from a point or position.
 */
export function point2Position(p?: Point | Position): Position | null {
  if (!p) {
    return null;
  }
  return (p as Position).start ? (p as Position) : {
    start: p as Point,
    end: p as Point,
  };
}
