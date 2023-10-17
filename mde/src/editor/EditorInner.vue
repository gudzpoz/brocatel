<template>
  <div class="brocatel-editor">
    <div
      v-if="props.menu"
      class="milkdown-menu"
    >
      <label v-if="plainTextCheckbox">
        <input
          type="checkbox"
          :checked="plainText"
          @change="(e) => {
            useCodeMirror = (e.target as HTMLInputElement).checked;
            emit('update:plainText', useCodeMirror);
            if (!useCodeMirror) {
              updateMilkdown(markdown);
            }
          }"
        >
        🗒️
      </label>
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
    <div v-show="useCodeMirror">
      <codemirror
        :extensions="[codeMirrorMarkdown(), oneDark]"
        :indent-with-tab="true"
        :tab-size="4"
        :model-value="markdown"
        @update:model-value="(v) => {
          markdown = v;
          emit('update:modelValue', v);
        }"
      />
    </div>
    <Milkdown v-show="!useCodeMirror" />
  </div>
</template>

<script setup lang="ts">
import { Codemirror } from 'vue-codemirror';
import { markdown as codeMirrorMarkdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

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

  plainText?: boolean,
  plainTextCheckbox?: boolean,

  prompt(message: string): string | null;
}>();
const useCodeMirror = ref(props.plainText ?? false);

const emit = defineEmits<{
  'update:modelValue': [value: string],
  'update:plainText': [value: boolean],
}>();

const markdown = ref(props.modelValue);

const headings = ref<string[]>([]);
provide('headings', headings);

const nodeViewFactory = useNodeViewFactory();
useEditor((root) => {
  let editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown.value);
      ctx.get(listenerCtx).markdownUpdated((_, md) => {
        if (markdown.value !== md) {
          markdown.value = md;
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

function updateMilkdown(value: string) {
  editor()?.action((ctx) => replaceAll(value)(ctx));
}
watch(() => props.modelValue, (value) => {
  if (value !== markdown.value) {
    markdown.value = value;
    updateMilkdown(value);
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
.brocatel-editor {
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
