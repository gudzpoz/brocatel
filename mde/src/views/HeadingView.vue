<template>
  <component
    :is="`h${headingLevel}`"
    :id="anchorId"
    class="heading"
  >
    <span
      :ref="contentRef"
      :class="{ selected }"
    />
    <a
      class="show-anchor not-prose"
      :href="anchorHash"
    >{{ anchorId }}</a>
  </component>
  <button
    title="Copy the anchor"
    @click="copy"
  >
    {{ copied > 0 ? '✅' : '📋' }}
  </button>
</template>
<script setup lang="ts">
import { useNodeViewContext } from '@prosemirror-adapter/vue';
import { spec } from 'brocatel-mdc';
import { computed, ref } from 'vue';

const { contentRef, node, selected } = useNodeViewContext();

const headingLevel = computed(() => Math.max(1, Math.min(6, node.value.attrs.level ?? 1)));
const anchorId = computed(() => spec.anchorer(node.value.textContent.trim()));
const anchorHash = computed(() => `#${anchorId.value}`);

const copied = ref(0);
function copy() {
  navigator.clipboard.writeText(anchorHash.value);
  copied.value += 1;
  setTimeout(() => {
    copied.value -= 1;
  }, 1000);
}
</script>
<style>
.ProseMirror .heading {
  line-height: 1.2rem;
  font-size: 1.2rem;
}
.ProseMirror .heading div[data-node-view-content] {
  display: inline-block;
}
.ProseMirror h1.heading::before {
  content: "# ";
}
.ProseMirror h2.heading::before {
  content: "## ";
}
.ProseMirror h3.heading::before {
  content: "### ";
}
.ProseMirror h4.heading::before {
  content: "#### ";
}
.ProseMirror h5.heading::before {
  content: "##### ";
}
.ProseMirror h6.heading::before {
  content: "###### ";
}
.ProseMirror .heading > span {
  margin-right: 1em;
}
.ProseMirror .show-anchor.not-prose:not(:empty):before {
  content: "#";
}
.ProseMirror .show-anchor.not-prose {
  font-weight: normal;
  opacity: 0.8;
}
.ProseMirror .heading + button {
  background: none;
  border: none;
  cursor: pointer;
}
</style>
