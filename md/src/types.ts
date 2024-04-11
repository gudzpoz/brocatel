export interface MarkdownData {
  toMarkdownExtensions?: Array<any>;
  fromMarkdownExtensions?: Array<any>;
  micromarkExtensions?: Array<any>;
}

/**
 * All coordinates are 1-based.
 */
export interface MarkdownPoint {
  line: number;
  column: number;
  offset?: number;
}

export interface MarkdownSourceError {
  message: string;
  source: string;
  start: MarkdownPoint;
  end?: MarkdownPoint;
}
