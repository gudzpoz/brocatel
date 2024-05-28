import { Heading, Paragraph, Parent, Root, RootContent, Text } from 'mdast';
import { Plugin } from 'unified';
import { Point } from 'unist';
import { visit, SKIP } from 'unist-util-visit';
import { getData } from './debug';

function shouldSplitParagraph(node: Paragraph) {
  return node.children.some((node) => (
    (node.type === 'break')
    || (node.type === 'text' && node.value.includes('\n'))
  ));
}

function splitText(node: Text, paragraphStart: Point): Text[] {
  return node.value.split('\n').map((line, i) => {
    if (i === 0) {
      return {
        ...node,
        value: line,
        position: {
          start: node.position!.start,
          end: {
            line: node.position!.start.line,
            column: node.position!.start.column + line.length,
          }
        }
      }
    }
    return {
      ...node,
      value: line,
      position: {
        start: {
          line: node.position!.start.line + i,
          column: paragraphStart.column,
        },
        end: {
          line: node.position!.start.line + i,
          column: paragraphStart.column + line.length,
        },
      },
    };
  });
}

function splitParagraph(node: Paragraph) {
  const paragraph = node;
  const paragraphs: Paragraph[] = [];
  let children: typeof node.children = [];
  let count = 0;
  function flush() {
    count += 1;
    if (children.length === 0) {
      return;
    }
    paragraphs.push({
      ...paragraph,
      children,
      position: {
        start: {
          line: paragraph.position!.start.line + count - 1,
          column: paragraph.position!.start.column,
        },
        end: {
          line: paragraph.position!.start.line + count - 1,
          column: children[children.length - 1].position!.end.column,
        }
      },
    });
    children = [];
  }
  node.children.forEach((child) => {
    if (child.type === 'break') {
      children.push({ ...child, type: 'text', value: '\n' });
      flush();
    } else if (child.type === 'text' && child.value.includes('\n')) {
      const texts = splitText(child, paragraph.position!.start);
      texts.forEach((text, i) => {
        if (i !== 0) {
          flush();
        }
        if (text.value !== '') {
          children.push(text);
        }
      });
    } else {
      children.push(child);
    }
  });
  flush();
  return paragraphs;
}

function shouldSplitHeading(node: Heading) {
  const { start, end } = node.position!;
  // Something like:
  // ```markdown
  // Heading
  // ---
  // ```
  // Easily confused with thematic breaks.
  return start.line !== end.line;
}

function splitHeading(node: Heading) {
  const paragraph: Paragraph = {
    ...node,
    type: 'paragraph',
  };
  const expanded: RootContent[] = splitParagraph(paragraph);
  const { start, end } = node.position!;
  expanded.push({
    type: 'thematicBreak',
    position: {
      start: {
        line: end.line,
        column: start.column,
      },
      end: {
        line: end.line,
        column: end.column,
      },
    },
  });
  return expanded;
}

function splitParagraphs(rootNode: Root): Root {
  visit(rootNode, (node) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      return SKIP;
    }
    const parent = node as Parent;
    if (!parent.children) {
      return;
    }
    parent.children = parent.children.flatMap((node) => {
      if (node.type === 'paragraph') {
        if (shouldSplitParagraph(node)) {
          return splitParagraph(node);
        }
      } else if (node.type === 'heading') {
        if (shouldSplitHeading(node)) {
          return splitHeading(node);
        }
      }
      return node;
    });
  });
  return rootNode;
}

const remarkSplitParagraphs: Plugin = () => (node, vfile) => {
  const config = getData(vfile);
  if (config.splitParagraphs) {
    return splitParagraphs(node as Root)
  }
  return node;
};

export default remarkSplitParagraphs;
