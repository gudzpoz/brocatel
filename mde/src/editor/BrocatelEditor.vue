<template>
  <MilkdownProvider>
    <ProsemirrorAdapterProvider>
      <EditorInner
        :model-value="modelValue"
        :menu="menu"
        :nord="nord"
        :plugins="plugins"
        :configs="configs"
        :prompt="prompt"
        @update:model-value="updateValue"
      />
    </ProsemirrorAdapterProvider>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Config } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { cursor } from '@milkdown/plugin-cursor';
import { history } from '@milkdown/plugin-history';
import { MilkdownProvider } from '@milkdown/vue';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/vue';

import EditorInner from './EditorInner.vue';

withDefaults(defineProps<{
  modelValue?: string;
  menu?: boolean;
  nord?: boolean;
  plugins?: MilkdownPlugin[];
  configs?: Config[];

  prompt?:(message: string) => string | null;
}>(), {
  modelValue: '',
  menu: true,
  nord: true,
  plugins: () => [clipboard, cursor, history].flat(),
  configs: () => [],
  // eslint-disable-next-line no-alert
  prompt: (s: string) => window.prompt(s),
});

const emit = defineEmits<{
  'update:modelValue': [value: string],
}>();

function updateValue(value: string) {
  emit('update:modelValue', value);
}
</script>
<style>
/*
 * Removes browser default editor border.
 */
 .ProseMirror.outline-none {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

/**
* @prosemirror-adapter/vue: minimize inconvenience from node views.
*/
.ProseMirror div[data-node-view-root] {
  display: flex;
}

/*
* mdx-plugin.ts: inline mdx expression styles.
*/
.ProseMirror.milkdown-theme-nord div.paragraph code[data-type="mdxTextExpression"]::before {
  content: "{";
  font-size: xx-small;
}
.ProseMirror.milkdown-theme-nord div.paragraph code[data-type="mdxTextExpression"]::after {
  content: "}";
  font-size: xx-small;
}
</style>
