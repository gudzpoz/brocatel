<template>
  <BrocatelEditor
    v-model="markdown"
    :plain-text="false"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BrocatelEditor from './editor/BrocatelEditor.vue';

const markdown = ref(`Mdx: { a + b } \\{ a + b \\}

:tag[content] Tagged text

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
