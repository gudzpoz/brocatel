<template>
  <div class="paragraph">
    <p :ref="contentRef" :class="{ selected,
      link: type === 'link',
      conditional: type === 'conditional',
      code: type === 'code',
    }"></p>
    <span v-if="type === 'link'">
      <input type="text" :value="href" @change="updateHref" class="not-prose">
    </span>
    <a v-if="type === 'link'" :href="href" contenteditable="false">🔗</a>
  </div>
</template>
<script setup lang="ts">
import { commandsCtx } from '@milkdown/core';
import { updateLinkCommand } from '@milkdown/preset-commonmark';
import type { Node } from '@milkdown/prose/model';
import { TextSelection } from '@milkdown/prose/state';
import { useInstance } from '@milkdown/vue';
import { useNodeViewContext } from '@prosemirror-adapter/vue';
import { computed } from 'vue';

const { contentRef, getPos, node, selected, view } = useNodeViewContext();

const [, useEditor] = useInstance();
const type = computed(() => getType(node.value));
const href = computed(() => getLinkHref(node.value));

function updateHref(e: Event) {
  const editor = useEditor();
  editor?.action((ctx) => {
    const pos = getPos();
    if (pos) {
      const { state } = view;
      const { tr } = state;
      view.dispatch(state.tr.setSelection(new TextSelection(tr.doc.resolve(pos + 1))));
      ctx.get(commandsCtx).call(updateLinkCommand.key, {
        href: (e.target as HTMLInputElement).value,
      });
    }
  });
}

function getLinkHref(node: Node) {
  const href = node.firstChild?.marks[0]?.attrs?.href;
  return typeof href === 'string' ? href : '#';
}

function isMarkedText(node: Node, mark: 'inlineCode' | 'link') {
  if (node?.isText) {
    if (node.marks.length === 1 && node.marks[0].type.name === mark) {
      return true;
    }
  }
  return false;
}

function getType(node: Node): 'link' | 'code' | 'conditional' | 'normal' {
  const count = node.childCount;
  if (count === 0) {
    return 'normal';
  }
  if (count === 1) {
    if (isMarkedText(node.child(0), 'link')) {
      return 'link';
    }
  }
  if (isMarkedText(node.child(0), 'inlineCode')) {
    if (count === 1) {
      return 'code';
    }
    return 'conditional';
  }
  return 'normal';
}
</script>
<style>
.ProseMirror .paragraph {
  padding-top: 0.5em;
  display: flex;
}
.ProseMirror .paragraph div[data-node-view-content] {
  display: inline-block;
}
.ProseMirror .paragraph p {
  margin: 0;
}
.ProseMirror p.link > div > a::before {
  content: "[";
}
.ProseMirror p.link > div > a::after {
  content: "]";
}
.ProseMirror p.link + span::before {
  content: "(";
}
.ProseMirror p.link + span::after {
  content: ")";
}
.ProseMirror p.link + span > input {
    border: none;
    outline: none;
    text-decoration: underline;
}
</style>
