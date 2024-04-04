import remarkHtml from 'remark-html';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const remark = unified().use(remarkParse).use(remarkHtml);

export default function useMarkdownToHtml() {
  return (markdown: string) => remark.processSync(markdown).value.toString();
}
