import {
  BlockContent,
  Content, InlineCode, Paragraph, Parent, Root, Text,
} from 'mdast';
import { ContainerDirective } from 'mdast-util-directive';
import { Info, Options, State } from 'mdast-util-to-markdown';
import { containerFlow } from 'mdast-util-to-markdown/lib/util/container-flow';
import { containerPhrasing } from 'mdast-util-to-markdown/lib/util/container-phrasing';
import { track } from 'mdast-util-to-markdown/lib/util/track';
import { Plugin } from 'unified';
import { Node } from 'unist';
import { visitParents } from 'unist-util-visit-parents';
import { VFile } from 'vfile';

export function isDirectiveLabel(para: Node | undefined): boolean {
  const labeled = para?.data?.directiveLabel;
  return !!labeled && para.type === 'paragraph';
}

function handleDirective(node: ContainerDirective, _: any, state: State, info: Info): string {
  const tracker = track(info);
  const containerExit = state.enter('containerDirective');
  let value = tracker.move(`:::${node.name}`);
  const label = node.children[0];
  const labeled = isDirectiveLabel(label);
  if (labeled) {
    const exit = state.enter('label');
    value += tracker.move(containerPhrasing(label as Paragraph, state, {
      ...tracker.current(),
      before: value,
      after: '\n',
    }));
    exit();
  }
  const shallow = labeled ? ({ ...node, children: node.children.slice(1) }) : node;
  value += tracker.move('\n');
  value += tracker.move(containerFlow(shallow, state, tracker.current()));
  containerExit();
  return value;
}

export const directiveToMarkdown: Options = {
  handlers: {
    containerDirective: handleDirective,
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

export function directiveLabel(value: string | InlineCode): Paragraph {
  const code: InlineCode = typeof value === 'string' ? {
    type: 'inlineCode',
    value,
  } : value;
  const para: Paragraph = {
    type: 'paragraph',
    children: [code],
    data: { directiveLabel: true },
  };
  return para;
}

const simpleDirectiveLineRegex = /^:::(\S+)\s*$/;

function parseDirectiveLine(line: Paragraph, vfile: VFile): ContainerDirective {
  const directive: ContainerDirective = {
    type: 'containerDirective',
    name: '',
    children: [],
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

export const directiveFromMarkdown: Plugin = () => (root: Node, vfile: VFile) => {
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
