<template>
  <div class="directive">
    <resizable-input
      :value="name"
      class="not-prose"
      placeholder="macro name"
      @update:value="updateName"
    />
    <div
      :ref="contentRef"
      :class="{ selected, container: true }"
    />
  </div>
</template>
<script setup lang="ts">
import { useNodeViewContext } from '@prosemirror-adapter/vue';
import { computed } from 'vue';

import ResizableInput from './ResizableInput.vue';

const {
  contentRef, node, selected, setAttrs,
} = useNodeViewContext();

const name = computed(() => node.value.attrs.name ?? '');
function updateName(v: string) {
  setAttrs({ name: v });
}
</script>
<style>
.ProseMirror div.directive,
.ProseMirror div.directive > .container,
.ProseMirror div.directive > .container > div[data-node-view-content],
.ProseMirror div.directive > .container > div[data-node-view-content]
> div[data-type="containerDirectiveLabel"] {
  display: inline;
}
.ProseMirror div.directive {
  margin-top: 1em;
}
.ProseMirror div.directive::before {
  content: "::: ";
  font-size: xx-small;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] > code::before,
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] > code::after {
  content: "`";
  display: inline;
}
</style>
