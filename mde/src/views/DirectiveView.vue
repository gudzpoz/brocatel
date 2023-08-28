<template>
  <div class="directive">
    <input :value="name" @change="updateName" type="text" size="8" class="not-prose" placeholder="macro name">
    <div :ref="contentRef" :class="{ selected, container: true }"></div>
  </div>
</template>
<script setup lang="ts">
import { useNodeViewContext } from '@prosemirror-adapter/vue';
import { computed } from 'vue';

const { contentRef, node, selected, setAttrs } = useNodeViewContext();

const name = computed(() => node.value.attrs.name ?? '');
function updateName(e: Event) {
  setAttrs({ name: (e.target as HTMLInputElement).value });
}
</script>
<style>
.ProseMirror div.directive,
.ProseMirror div.directive > .container,
.ProseMirror div.directive > .container > div[data-node-view-content],
.ProseMirror div.directive > .container > div[data-node-view-content] > div[data-type="containerDirectiveLabel"] {
  display: inline;
}
.ProseMirror div.directive {
  margin-top: 1em;
}
.ProseMirror div.directive::before {
  content: "::: ";
  font-size: xx-small;
}
.ProseMirror div.directive div[data-type="containerDirectiveLabel"] {
  margin-left: 2em;
}
</style>
