<template>
  <div class="paragraph">
    <div
      :ref="contentRef"
      :class="{ selected,
                link: type === 'link',
                conditional: type === 'conditional',
                code: type === 'code',
      }"
    />
    <span v-if="type === 'link'">
      <resizable-input
        class="not-prose"
        placeholder="link"
        :value="href"
        @update:value="updateHref"
      />
    </span>
    <a
      v-if="type === 'link'"
      :href="href"
      contenteditable="false"
    >🔗</a>
  </div>
</template>
<script setup lang="ts">
import { commandsCtx } from '@milkdown/core';
import { updateLinkCommand } from '@milkdown/preset-commonmark';
import type { Node } from '@milkdown/prose/model';
import { TextSelection } from '@milkdown/prose/state';
import { useInstance } from '@milkdown/vue';
import { useNodeViewContext } from '@prosemirror-adapter/vue';
import { ref, watch } from 'vue';

import ResizableInput from './ResizableInput.vue';

const {
  contentRef, getPos, node, selected, view,
} = useNodeViewContext();

const [, useEditor] = useInstance();

function isMarkedText(n: Node, mark: 'inlineCode' | 'link') {
  if (n?.isText) {
    if (n.marks.length === 1 && n.marks[0].type.name === mark) {
      return true;
    }
  }
  return false;
}

function getType(n: Node): 'link' | 'code' | 'conditional' | 'normal' {
  const count = n.childCount;
  if (count === 0) {
    return 'normal';
  }
  if (count === 1) {
    if (isMarkedText(n.child(0), 'link')) {
      return 'link';
    }
  }
  if (isMarkedText(n.child(0), 'inlineCode')) {
    if (count === 1) {
      return 'code';
    }
    return 'conditional';
  }
  return 'normal';
}

function getLinkHref(n: Node) {
  const href = n.firstChild?.marks[0]?.attrs?.href;
  return typeof href === 'string' ? href : '#';
}

// Using computed seems to cause undefined bugs...
const type = ref<ReturnType<typeof getType>>('normal');
const href = ref('');
watch(() => node.value, (n) => {
  type.value = getType(n);
  href.value = getLinkHref(n);
});

function updateHref(url: string) {
  const editor = useEditor();
  href.value = url;
  editor?.action((ctx) => {
    const pos = getPos();
    if (pos) {
      const { state } = view;
      const { tr } = state;
      view.dispatch(state.tr.setSelection(new TextSelection(tr.doc.resolve(pos + 1))));
      ctx.get(commandsCtx).call(updateLinkCommand.key, { url });
    }
  });
}
</script>
<style>
.ProseMirror .paragraph {
  padding-top: 0.5em;
  display: flex;
  flex-wrap: wrap;
}
.ProseMirror .paragraph div[data-node-view-content] {
  display: inline-block;
}
.ProseMirror .paragraph > div {
  margin: 0;
}
.ProseMirror .link > div > a::before {
  content: "[";
}
.ProseMirror .link > div > a::after {
  content: "]";
}
.ProseMirror .link + span::before {
  content: "(";
}
.ProseMirror .link + span::after {
  content: ")";
}
.ProseMirror .link + span > input {
    border: none;
    outline: none;
    text-decoration: underline;
}
</style>
