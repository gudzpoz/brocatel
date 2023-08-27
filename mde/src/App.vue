<template>
  <MilkdownProvider>
    <ProsemirrorAdapterProvider>
      <Editor />
    </ProsemirrorAdapterProvider>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/vue';
import Editor from './Editor.vue';
</script>
