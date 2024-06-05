<template>
  <MilkdownProvider>
    <ProsemirrorAdapterProvider>
      <EditorInner
        :model-value="modelValue"
        :menu="menu"
        :nord="nord"
        :link-auto-complete="linkAutoComplete"
        :plugins="plugins"
        :configs="configs"
        :prompt="prompt"
        :dark-mode="darkMode"
        :plain-text-checkbox="plainText !== undefined"
        :plain-text="plainText ?? false"
        :diagnostics="diagnostics ?? false"
        @update:model-value="(v) => emit('update:modelValue', v)"
        @update:plain-text="(v) => emit('update:plainText', v)"
      />
    </ProsemirrorAdapterProvider>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import type { Diagnostic } from '@codemirror/lint';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Config } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { cursor } from '@milkdown/plugin-cursor';
import { history } from '@milkdown/plugin-history';
import { MilkdownProvider } from '@milkdown/vue';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/vue';

import EditorInner from './EditorInner.vue';
import type { MarkdownSourceError } from '@brocatel/md';

withDefaults(defineProps<{
  modelValue?: string;
  menu?: boolean;
  nord?: boolean;
  plugins?: MilkdownPlugin[];
  configs?: Config[];
  linkAutoComplete?: boolean;
  plainText?: boolean,
  diagnostics?: MarkdownSourceError[],
  darkMode?: boolean,

  prompt?:(message: string) => string | null;
}>(), {
  modelValue: '',
  menu: true,
  nord: true,
  linkAutoComplete: true,
  plugins: () => [clipboard, cursor, history].flat(),
  configs: () => [],
  diagnostics: () => [],
  darkMode: false,
  // eslint-disable-next-line no-alert
  prompt: (s: string) => window.prompt(s),
});

const emit = defineEmits<{
  'update:modelValue': [value: string],
  'update:plainText': [value: boolean],
}>();
</script>
<style>
/* Removes browser default editor border. */
 .ProseMirror.outline-none {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

/* Fix bullet list markers. */
li[data-list-type="bullet"] > div[data-node-view-root] {
  display: inline-flex;
  vertical-align: top;
}
li[data-list-type="bullet"] > div[data-node-view-root] > div.paragraph {
  position: relative;
  top: -0.4em;
}
/**
 * @prosemirror-adapter/vue: minimize inconvenience from node views.
 */
.ProseMirror div[data-node-view-root] {
  display: flex;
}

/**
 * mdx.ts: inline mdx expression styles.
 */
.ProseMirror.milkdown-theme-nord div.paragraph code[data-type="mdxTextExpression"]::before,
.ProseMirror.milkdown-theme-nord .heading code[data-type="mdxTextExpression"]::before {
  content: "{";
  font-size: xx-small;
}
.ProseMirror.milkdown-theme-nord div.paragraph code[data-type="mdxTextExpression"]::after,
.ProseMirror.milkdown-theme-nord .heading code[data-type="mdxTextExpression"]::after {
  content: "}";
  font-size: xx-small;
}

/**
 * tag.ts: text directive styles.
 */
.ProseMirror span[data-type="textDirective"]::before {
  content: ":";
}
.ProseMirror span[data-type="textDirective"] > span[data-type="textDirectiveName"]::after {
  content: "[";
}
.ProseMirror span[data-type="textDirective"]::after {
  content: "]";
}
.ProseMirror span[data-type="textDirective"] > span[data-type="textDirectiveName"],
.ProseMirror span[data-type="textDirective"]::before,
.ProseMirror span[data-type="textDirective"]::after {
  font-family: monospace;
}

/**
 * gapcursor.css: styling the gap cursor.
 */
.ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}
.ProseMirror-focused .ProseMirror-gapcursor {
  display: inline-block;
}
@keyframes ProseMirror-cursor-blink {
  to { visibility: hidden; }
}
.ProseMirror-gapcursor:after {
  content: "";
  display: inline-block;
  top: -2px;
  height: 20px;
  border-left: 1px solid black;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}
</style>
