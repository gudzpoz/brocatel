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
      class="container"
      :class="{ selected }"
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
.ProseMirror div.directive > .container > div[data-node-view-content] {
  display: inline;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"],
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] > span {
  font-family: monospace;
  white-space: normal;
  display: inline-block;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] {
  margin-left: 1em;
}
.ProseMirror div.directive {
  margin-top: 1em;
}
.ProseMirror div.directive::before {
  content: "::: ";
  font-size: xx-small;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"]::before,
.ProseMirror div.directive div[data-type="containerDirectiveLabel"]::after {
  content: "`";
  display: inline;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] > span > br {
  display: none;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] > span > br:only-child {
  display: inline;
}
</style>
