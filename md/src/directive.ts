import type {
  BlockContent, Content,
  InlineCode, Paragraph, Parent, PhrasingContent, Root, Text,
} from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { Info, Options, State } from 'mdast-util-to-markdown';
import type { Plugin } from 'unified';
import type { Node } from 'unist';
import type { VFile } from 'vfile';

import { containerFlow } from 'mdast-util-to-markdown/lib/util/container-flow';
import { containerPhrasing } from 'mdast-util-to-markdown/lib/util/container-phrasing';
import { track } from 'mdast-util-to-markdown/lib/util/track';
import { visitParents } from 'unist-util-visit-parents';

export const directiveLabelType = 'containerDirectiveLabel';

/**
 * Directive label node.
 */
export interface ContainerDirectiveLabel extends Parent {
  type: typeof directiveLabelType;
  children: PhrasingContent[];
}

declare module 'mdast' {
  interface RootContentMap {
    conteinerDirective: ContainerDirective;
    containerDirectiveLabel: ContainerDirectiveLabel;
  }
  interface BlockContentMap {
    conteinerDirective: ContainerDirective;
    containerDirectiveLabel: ContainerDirectiveLabel;
  }
}

function handleDirective(node: ContainerDirective, _: any, state: State, info: Info): string {
  const tracker = track(info);
  const containerExit = state.enter('containerDirective');
  let value = tracker.move(`:::${node.name}`);
  const label = node.children[0];
  let content;
  if (label.type === directiveLabelType) {
    const exit = state.enter('label');
    value += tracker.move(containerPhrasing(label, state, {
      ...tracker.current(),
      before: value,
      after: '\n',
    }));
    exit();
    content = { ...node, children: node.children.slice(1) };
  } else {
    content = node;
  }
  value += tracker.move('\n');
  value += tracker.move('\n');
  value += tracker.move(containerFlow(content, state, tracker.current()));
  containerExit();
  return value;
}

export const directiveToMarkdown: Options = {
  handlers: {
    containerDirective: handleDirective,
    containerDirectiveLabel: () => '',
  },
  unsafe: [
    {
      character: '\r',
      inConstruct: ['containerDirectiveLabel'],
    },
    {
      character: '\n',
      inConstruct: ['containerDirectiveLabel'],
    },
    {
      before: '[^:]',
      character: ':',
      after: '[A-Za-z]',
      inConstruct: ['phrasing'],
    },
    { atBreak: true, character: ':', after: ':' },
  ],
};

function isDirectiveLine(node: Content): boolean {
  if (node.type !== 'paragraph' || node.children.length === 0) {
    return false;
  }
  const prefix = node.children[0];
  return prefix.type === 'text' && prefix.value.startsWith(':::');
}

/**
 * Creates a directive label node.
 */
export function directiveLabel(value: string | InlineCode): ContainerDirectiveLabel {
  const code: InlineCode = typeof value === 'string' ? {
    type: 'inlineCode',
    value,
  } : value;
  return {
    type: directiveLabelType,
    children: [code],
  };
}

const simpleDirectiveLineRegex = /^:::(\S+)\s*$/;

function parseDirectiveLine(line: Paragraph, vfile: VFile): ContainerDirective {
  const directive: ContainerDirective = {
    type: 'containerDirective',
    name: '',
    children: [],
    position: line.position,
  };
  const match = simpleDirectiveLineRegex.exec((line.children[0] as Text).value);
  if (match) {
    [, directive.name] = match;
  } else {
    vfile.message('invalid directive line', line);
  }
  if (line.children.length >= 2) {
    const condition = line.children[1];
    if (condition.type === 'inlineCode') {
      directive.children.push(directiveLabel(condition));
    } else {
      vfile.message('unsupported element', condition);
    }
    if (line.children.length >= 3) {
      vfile.message('unexpected element', line.children[2]);
    }
  }
  return directive;
}

export const directiveForMarkdown: Plugin<any[], Root> = function directiveFromMarkdown() {
  const data = this.data();
  const extension = { extensions: [directiveToMarkdown] };
  if (data.toMarkdownExtensions) {
    (data.toMarkdownExtensions as Array<any>).push(extension);
  } else {
    data.toMarkdownExtensions = [extension];
  }

  return (root: Node, vfile: VFile) => {
    visitParents(root as Root, (node) => {
      const container = node as Parent;
      const { children } = container;
      if (children && children.some(isDirectiveLine)) {
        const merged: Content[] = [];
        let inDirective = false;
        children.forEach((child) => {
          if (inDirective) {
            const directive = merged[merged.length - 1] as ContainerDirective;
            directive.children.push(child as BlockContent);
            inDirective = false;
            if (child.type === 'code' && child.lang === 'lua' && child.meta === 'func'
              && directive.children.length === 1) {
              inDirective = true;
            }
          } else if (isDirectiveLine(child)) {
            merged.push(parseDirectiveLine(child as Paragraph, vfile));
            inDirective = true;
          } else {
            merged.push(child);
          }
        });
        container.children = merged;
        if (inDirective) {
          vfile.message('container directive without content', children[children.length - 1]);
        }
      }
    });
  };
};
