import { remark } from 'remark';
import remarkHtml from 'remark-html';

const parser = remark().use(remarkHtml);

export function parse(markdown: string, strip?: boolean): string {
  const s = parser.processSync(markdown).toString().replace(/\n\n/g, '\n');
  if (strip) {
    return s.trim().replace(/^<p>/, '').replace(/<\/p>$/, '');
  }
  return s;
}
