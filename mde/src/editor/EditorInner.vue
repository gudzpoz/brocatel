<template>
  <Milkdown />
</template>

<script setup lang="ts">
import { Editor, defaultValueCtx, rootCtx, type Config } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { listenerCtx, listener } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { replaceAll } from '@milkdown/utils';
import { Milkdown, useEditor } from '@milkdown/vue';
import { useNodeViewFactory } from '@prosemirror-adapter/vue';
import { watch } from 'vue';

import plugins from '../plugins/index';
import { useBetterViewPlugins } from '../views/index';

import '@milkdown/theme-nord/style.css';

const props = defineProps<{
  modelValue: string;
  nord: boolean;
  plugins: MilkdownPlugin[];
  configs: Config[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string],
}>();

let markdown = props.modelValue;
let setMarkdown: (s: string) => void | undefined;

const nodeViewFactory = useNodeViewFactory();
useEditor((root) => {
  let editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown);
      ctx.get(listenerCtx).markdownUpdated((_, md) => {
        if (markdown !== md) {
          markdown = md;
          emit('update:modelValue', md);
        }
      });
      setMarkdown = (markdown) => replaceAll(markdown)(ctx);
    });
  if (props.nord) {
    editor = editor.config(nord)
  }
  props.configs.forEach((config) => editor = editor.config(config));
  editor = editor
    .use(commonmark)
    .use(listener)
    .use(useBetterViewPlugins(nodeViewFactory))
    .use(plugins);
  editor = editor.use(props.plugins);
  return editor;
});

watch(() => props.modelValue, (value) => {
  if (value !== markdown) {
    markdown = value;
    if (setMarkdown) {
      setMarkdown(value);
    }
  }
});
</script>
