<template>
  <div class="brocatel-editor">
    <div
      v-if="props.menu"
      class="milkdown-menu"
    >
      <label
        v-if="plainTextCheckbox"
        :class="{ error: diagnostics.length !== 0 }"
      >
        <input
          type="checkbox"
          :checked="useCodeMirror"
          @change="(e) => {
            useCodeMirror = (e.target as HTMLInputElement).checked;
            emit('update:plainText', useCodeMirror);
            if (!useCodeMirror) {
              updateMilkdown(markdown);
            }
          }"
        >
        {{ diagnostics.length === 0 ? '🗒️' : '❗' }}
      </label>
      <div
        v-show="!useCodeMirror"
        class="milkdown-buttons"
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
    </div>
    <div v-show="useCodeMirror">
      <codemirror
        :extensions="[
          codeMirrorMarkdown({ defaultCodeLanguage: StreamLanguage.define(lua) }),
          linter(() => diagnostics.map((err) => ({
            message: err.message,
            severity: 'error',
            from: computeOffset(err.start),
            to: computeOffset(err.end ?? err.start),
          }))),
          lintGutter(),
          EditorView.lineWrapping,
          darkMode ? oneDark : { extension: [] },
        ]"
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
import { EditorView } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { markdown as codeMirrorMarkdown } from '@codemirror/lang-markdown';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
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
import { Milkdown, useEditor } from '@milkdown/vue';
import { useNodeViewFactory } from '@prosemirror-adapter/vue';
import {
  nextTick, provide, ref, watch,
} from 'vue';

import type { MarkdownPoint, MarkdownSourceError } from '@brocatel/md';

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

  plainText: boolean,
  plainTextCheckbox: boolean,
  darkMode: boolean,
  diagnostics: MarkdownSourceError[],

  prompt(message: string): string | null;
}>();
const useCodeMirror = ref(props.plainText ?? false);
watch(() => props.plainText, (newValue) => {
  if (newValue !== undefined) {
    useCodeMirror.value = newValue;
  }
});

const emit = defineEmits<{
  'update:modelValue': [value: string],
  'update:plainText': [value: boolean],
}>();

const markdown = ref(props.modelValue);

function computeOffset(point: MarkdownSourceError["start"]) {
  let i = 0;
  let count = point.line - 1;
  while (count > 0) {
    i = markdown.value.indexOf('\n', i + 1);
    count -= 1;
  }
  return i + 1 + point.column - 1;
}

const headings = ref<string[]>([]);
provide('headings', headings);

const nodeViewFactory = useNodeViewFactory();
const { get: getEditor } = useEditor((root) => {
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

function updateMilkdown(value: string) {
  getEditor()?.action(replaceAll(value, true));
}
watch(() => props.modelValue, (value) => {
  if (value !== markdown.value) {
    // Weird bugs happening when Vue is updating the tree,
    // so we need to remove Milkdown from tree and wait for the next tick.
    // TODO: Report this bug to Vue or prosemirror-adapter.
    emit('update:plainText', true);
    useCodeMirror.value = true;
    nextTick(() => {
      markdown.value = value;
      updateMilkdown(value);
    });
  }
});

function call<T>(command: $Command<T>, payload?: T) {
  return getEditor()?.action(callCommand(command.key, payload));
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

function point2Coords(point: MarkdownPoint) {
  return { x: point.column, y: point.line };
}
</script>
<style>
.brocatel-editor {
  height: 100%;
  overflow: auto;
}
.brocatel-editor > .milkdown-menu {
  position: sticky;
  top: 0;
  margin: 0.2em;
  z-index: 1;
}
.milkdown-menu > .milkdown-buttons {
  display: inline;
}
</style>
