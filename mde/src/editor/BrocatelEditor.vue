<template>
  <MilkdownProvider>
    <ProsemirrorAdapterProvider>
      <EditorInner
        :model-value="props.modelValue"
        :menu="props.menu"
        :nord="props.nord"
        :plugins="props.plugins"
        :configs="props.configs"
        :prompt="props.prompt"
        @update:model-value="updateValue"
      />
    </ProsemirrorAdapterProvider>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Config } from '@milkdown/core';
import { MilkdownProvider } from '@milkdown/vue';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/vue';

import EditorInner from './EditorInner.vue';

import './style.css';

const props = withDefaults(defineProps<{
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
  plugins: () => [],
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
