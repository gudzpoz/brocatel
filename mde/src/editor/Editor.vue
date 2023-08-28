<template>
  <MilkdownProvider>
    <ProsemirrorAdapterProvider>
      <EditorInner
        :model-value="props.modelValue"
        :nord="props.nord"
        :plugins="props.plugins"
        :configs="props.configs"
        v-on:update:model-value="updateValue"
      />
    </ProsemirrorAdapterProvider>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/vue';

import EditorInner from './EditorInner.vue';

import './style.css';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Config } from '@milkdown/core';

const props = withDefaults(defineProps<{
  modelValue?: string;
  nord?: boolean;
  plugins?: MilkdownPlugin[];
  configs?: Config[];
}>(), {
  modelValue: '',
  nord: true,
  plugins: () => [],
  configs: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: string],
}>();

function updateValue(value: string) {
  emit('update:modelValue', value);
}
</script>
