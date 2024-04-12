import type {
  BlockContent,
  InlineCode, Paragraph, Parent, PhrasingContent,
  Root, RootContent, Text,
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
import { visitParents } from 'unist-util-visit-parents';
import type { VFile } from 'vfile';

import type { MarkdownData } from './types';

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
  const tracker = state.createTracker(info);
  const containerExit = state.enter('containerDirective');
  let value = tracker.move(`:::${node.name}`);
  const label = node.children[0];
  let content;
  if (label.type === directiveLabelType) {
    const exit = state.enter('label');
    // The PhrasingParents definition in mdast-util-to-markdown is hard-coded...
    value += tracker.move(state.containerPhrasing(label as any as Paragraph, {
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
  value += tracker.move(state.containerFlow(content, tracker.current()));
  containerExit();
  return value;
}

/**
 * A `mdast-util-to-markdown` extension that serializes `textDirective`
 * and `containerDirective` to Markdown.
 */
export const directiveToMarkdown: Options = {
  // The definition is borrowed from mdast-util-directive.
  handlers: {
    textDirective: allDirectivesToMarkdown().handlers!.textDirective,
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

function isDirectiveLine(node: RootContent): boolean {
  if (node.type !== 'paragraph' || node.children.length === 0) {
    return false;
  }
  const prefix = node.children[0];
  return prefix.type === 'text' && prefix.value.startsWith(':::');
}

/**
 * Creates a directive label node.
 */
export function directiveLabel(value: InlineCode): ContainerDirectiveLabel {
  return {
    type: directiveLabelType,
    children: [value],
    position: value.position,
  };
}

function filterFields(
  obj: Record<string, FromHandle>,
  keyPrefix: string,
): Record<string, FromHandle> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => key.startsWith(keyPrefix)),
  );
}

const {
  enter: allDirectivesFromMarkdownEnter,
  exit: allDirectivesFromMarkdownExit,
} = allDirectivesFromMarkdown();
/**
 * A `mdast-util-from-markdown` extension that parses `textDirective` nodes.
 */
export const tagDirectiveFromMarkdown: FromExtension = {
  // The definition is borrowed from mdast-util-directive.
  canContainEols: ['textDirective'],
  enter: filterFields(allDirectivesFromMarkdownEnter!, 'directiveText'),
  exit: filterFields(allDirectivesFromMarkdownExit!, 'directiveText'),
};

const simpleDirectiveLineRegex = /^:::(\S+)\s*$/;

class DirectiveMerger {
  merged: RootContent[] = [];

  pending: RootContent[] = [];

  inDirective = false;

  vfile: VFile;

  constructor(vfile: VFile) {
    this.vfile = vfile;
  }

  restore() {
    this.merged.push(...this.pending.slice(1));
  }

  commit() {
    const containerDirective = this.pending[0] as ContainerDirective;
    containerDirective.children.push(...this.pending.slice(2) as BlockContent[]);
    this.merged.push(containerDirective);
  }

  submit() {
    this.inDirective = false;
    const container = this.pending[0] as ContainerDirective;
    const codeOrList = this.pending[2];
    const listWhenCode = this.pending[3];
    if (!codeOrList) {
      this.vfile.message('empty directive', this.pending[1]);
      this.restore();
      return;
    }
    if (!listWhenCode) {
      const list = codeOrList;
      if (list.type !== 'list') {
        this.vfile.message('expecting a list after the directive block', list);
        this.restore();
        return;
      }
      this.commit();
      return;
    }
    const code = codeOrList;
    const list = listWhenCode;
    if (code.type !== 'code' || code.lang !== 'lua' || code.meta !== 'func') {
      this.vfile.message('expecting a code block of lua func type after the directive block', code);
      this.restore();
      return;
    }
    if (container.children.length > 0) {
      this.vfile.message('a labeled directive should not contain a lua func code block', container);
      this.restore();
      return;
    }
    if (list.type !== 'list') {
      this.vfile.message('expecting a list after the code block', list);
      this.restore();
      return;
    }
    this.commit();
  }

  process(node: RootContent) {
    if (this.inDirective) {
      this.pending.push(node);
      if (this.pending.length >= 4) {
        this.submit();
        return;
      }
      switch (node.type) {
        case 'code':
          break;
        case 'list':
        default:
          this.submit();
          break;
      }
    } else if (isDirectiveLine(node)) {
      const directive = this.parseDirectiveLine(node as Paragraph);
      if (!directive) {
        this.merged.push(node);
        return;
      }
      this.pending = [directive, node];
      this.inDirective = true;
    } else {
      this.merged.push(node);
    }
  }

  end() {
    if (this.inDirective) {
      this.submit();
    }
  }

  parseDirectiveLine(line: Paragraph): ContainerDirective | null {
    const directive: ContainerDirective = {
      type: 'containerDirective',
      name: '',
      children: [],
      position: line.position,
    };
    const match = simpleDirectiveLineRegex.exec((line.children[0] as Text).value);
    if (!match || line.children.length > 2
      || (line.children.length === 2 && line.children[1].type !== 'inlineCode')) {
      this.vfile.message('invalid directive line', line);
      return null;
    }
    [, directive.name] = match;
    const condition = line.children[1];
    if (condition) {
      directive.children.push(directiveLabel(condition as InlineCode));
    }
    return directive;
  }
}

/**
 * A `remark` plugins that installs the following extensions:
 *
 * - `micromark`: `textDirective`,
 * - `mdast-util-from-markdown`: `textDirective`,
 * - `mdast-util-to-markdown`: `textDirective`, `containerDirective`,
 * - `remark`: a transformer that parses `containerDirective`.
 */
// eslint-disable-next-line func-names
export const directiveForMarkdown: Plugin<Root[], Root> = function () {
  const data = this.data() as any as MarkdownData;
  function addTo(field: keyof MarkdownData, ext: any) {
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
        const merger = new DirectiveMerger(vfile);
        children.forEach((child) => {
          merger.process(child);
        });
        merger.end();
        container.children = merger.merged;
      }
    });
  };
};
