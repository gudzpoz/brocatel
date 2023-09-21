<template>
  <div class="brocatel-editor">
    <div
      v-if="props.menu"
      class="milkdown-menu"
    >
      <button @click="call(toggleEmphasisCommand)">
        <i>Italics</i>
      </button>
      <button @click="call(toggleStrongCommand)">
        <b>Bold</b>
      </button>
      <button @click="call(wrapInHeadingCommand)">
        <b>#</b>Heading
      </button>
      <button @click="toggleLink">
        <u>Link</u>
      </button>
      <button @click="call(wrapInBulletListCommand)">
        <b>-</b>Choices
      </button>
      <button @click="call(toggleInlineCodeCommand)">
        <code>`Code`</code>
      </button>
      <button @click="call(toggleMdxInlineCommand)">
        <code>{Expr}</code>
      </button>
      <button @click="call(insertDirectiveCommand)">
        <b>:::</b>Directive
      </button>
    </div>
    <Milkdown />
  </div>
</template>

<script setup lang="ts">
import {
  Editor, defaultValueCtx, rootCtx, type Config,
} from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { listenerCtx, listener } from '@milkdown/plugin-listener';
import {
  commonmark, toggleEmphasisCommand,
  toggleInlineCodeCommand, toggleLinkCommand,
  toggleStrongCommand, wrapInHeadingCommand, wrapInBulletListCommand,
} from '@milkdown/preset-commonmark';
import { nord as nordConfig } from '@milkdown/theme-nord';
import { callCommand, replaceAll, type $Command } from '@milkdown/utils';
import { Milkdown, useEditor, useInstance } from '@milkdown/vue';
import { useNodeViewFactory } from '@prosemirror-adapter/vue';
import { provide, ref, watch } from 'vue';

import brocatelPlugins from '../plugins/index';
import { insertDirectiveCommand } from '../nodes/directive';
import { toggleMdxInlineCommand } from '../nodes/mdx';
import { useBetterViewPlugins } from '../views/index';

import '@milkdown/theme-nord/style.css';

const props = defineProps<{
  modelValue: string;
  menu: boolean;
  nord: boolean;
  linkAutoComplete: boolean;
  plugins: MilkdownPlugin[];
  configs: Config[];

  prompt(message: string): string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string],
}>();

let markdown = props.modelValue;

const headings = ref<string[]>([]);
provide('headings', headings);

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
          headings.value = Array.from(root.getElementsByClassName('heading')).filter((e) => e.id).map((e) => e.id);
        }
      });
    });
  if (props.nord) {
    editor = editor.config(nordConfig);
  }
  props.configs.forEach((config: Config) => {
    editor = editor.config(config);
  });
  editor = editor
    .use(commonmark)
    .use(listener)
    .use(useBetterViewPlugins(nodeViewFactory))
    .use(brocatelPlugins);
  editor = editor.use(props.plugins);
  return editor;
});

const [, editor] = useInstance();

watch(() => props.modelValue, (value) => {
  if (value !== markdown) {
    markdown = value;
    editor()?.action((ctx) => replaceAll(value)(ctx));
  }
});

function call<T>(command: $Command<T>, payload?: T) {
  return editor()?.action(callCommand(command.key, payload));
}
function toggleLink() {
  try {
    call(toggleLinkCommand);
  } catch (_) {
    const href = props.prompt('Link Url');
    if (href && href !== '') {
      call(toggleLinkCommand, { href });
    }
  }
}
</script>
<style>
.brocatel-editor{
  height: 100%;
  overflow: scroll;
}
.brocatel-editor > .milkdown-menu {
  position: sticky;
  top: 0;
  margin: 0.2em;
  z-index: 1;
}
</style>
