import type {
  Content, InlineCode, Paragraph,
  Parent, PhrasingContent, Root, Text,
} from 'mdast';
import {
  directiveFromMarkdown as allDirectivesFromMarkdown,
  directiveToMarkdown as allDirectivesToMarkdown,
  type ContainerDirective,
} from 'mdast-util-directive';
import type { Extension as FromExtension, Handle as FromHandle } from 'mdast-util-from-markdown';
import type { Info, Options, State } from 'mdast-util-to-markdown';
import { directive as allDirectivesMircomark } from 'micromark-extension-directive';
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

/**
 * A `mdast-util-to-markdown` extension that serializes `textDirective`
 * and `containerDirective` to Markdown.
 */
export const directiveToMarkdown: Options = {
  handlers: {
    textDirective: allDirectivesToMarkdown.handlers!.textDirective,
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

function filterFields(
  obj: Record<string, FromHandle>,
  keyPrefix: string,
): Record<string, FromHandle> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => key.startsWith(keyPrefix)),
  );
}

/**
 * A `mdast-util-from-markdown` extension that parses `textDirective` nodes.
 */
export const tagDirectiveFromMarkdown: FromExtension = {
  canContainEols: ['textDirective'],
  enter: filterFields(allDirectivesFromMarkdown.enter!, 'directiveText'),
  exit: filterFields(allDirectivesFromMarkdown.exit!, 'directiveText'),
};

/**
 * A `remark` plugins that installs the following extensions:
 *
 * - `micromark`: `textDirective`,
 * - `mdast-util-from-markdown`: `textDirective`,
 * - `mdast-util-to-markdown`: `textDirective`, `containerDirective`,
 * - `remark`: a transformer that parses `containerDirective`.
 */
// eslint-disable-next-line func-names
export const directiveForMarkdown: Plugin<any[], Root> = function () {
  const data = this.data();
  function addTo(field: string, ext: any) {
    if (data[field]) {
      (data[field] as Array<any>).push(ext);
    } else {
      data[field] = [ext];
    }
  }
  addTo('toMarkdownExtensions', { extensions: [directiveToMarkdown] });
  addTo('fromMarkdownExtensions', tagDirectiveFromMarkdown);
  addTo('micromarkExtensions', { text: allDirectivesMircomark().text });

  return (root: Node, vfile: VFile) => {
    /*
     * Finds all directive lines and constructs containerDirective nodes
     * from the lines and the lists that come after.
     */
    visitParents(root as Root, (node) => {
      const container = node as Parent;
      const { children } = container;
      if (children && children.some(isDirectiveLine)) {
        const merged: Content[] = [];
        let inDirective = false;
        children.forEach((child) => {
          if (inDirective) {
            const directive = merged[merged.length - 1] as ContainerDirective;
            switch (child.type) {
              case 'list':
                directive.children.push(child);
                inDirective = false;
                break;
              case 'code':
                if (child.lang === 'lua' && child.meta === 'func' && directive.children.length === 0) {
                  vfile.message('function directive not implemented yet', children[children.length - 1]);
                }
                break;
              default:
                vfile.message('expecting a list after the container directive label', children[children.length - 1]);
                merged.push(child);
                inDirective = false;
                break;
            }
          } else if (isDirectiveLine(child)) {
            merged.push(parseDirectiveLine(child as Paragraph, vfile));
            inDirective = true;
          } else {
            merged.push(child);
          }
        });
        if (inDirective) {
          vfile.message('container directive without content', children[children.length - 1]);
        }
        merged.forEach((e) => {
          if (e.type === 'containerDirective' && e.children.length === 0) {
            e.children.push({ type: 'list', children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'text', value: '' }] }] }] });
          }
        });
        container.children = merged;
      }
    });
  };
};
