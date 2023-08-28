<template>
  <Editor v-model="markdown" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Editor from './editor/Editor.vue';

const markdown = ref(`Mdx: { a + b } \\{ a + b \\}

# Heading 1

### Heading 3

[Link 1](#heading-1)

:::loop
- One
- Two

:::if \`true\`
- True
- False
`);

watch(markdown, (v) => console.log(v));
</script>
