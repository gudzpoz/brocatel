<template>
  <div>
    <TextLines :lines="lines" :options="options"
     @select-option="nextLine" class="lines" />
  </div>
</template>
<script setup lang="ts">
import {
  SelectLine, TextLine as BrocatelTextLine,
} from '@brocatel/mdc';
import { onMounted, ref, watch } from 'vue';
import TextLines, { Option, TextLine } from './TextLines.vue';
import useMarkdownToHtml from '../composables/useMarkdownToHtml';
import { BrocatelStory } from '../composables/useStory';

const props = withDefaults(defineProps<{
  story: BrocatelStory;
  autoNextLineDelay?: number;
}>(), {
  autoNextLineDelay: 0.1,
});
watch(() => props.story, () => {
  initStory();
});

const lines = ref<TextLine[]>([]);
const options = ref<Option[]>([]);

const markdownToHtml = useMarkdownToHtml();

function handleErr(msg: { message: string }) {
  options.value = [];
  lines.value.push({
    html: `<pre><code style="color: red">${msg.message}</code></pre>`,
  });
}

function nextLine(option?: number) {
  const line = props.story.next(option);
  if (!line) {
    return;
  }
  if ((line as { message: string }).message) {
    handleErr(line as { message: string });
    return;
  }
  if ((line as SelectLine | null)?.select) {
    const select = line as SelectLine;
    options.value = select.select.map((o) => ({
      html: markdownToHtml(o.option.text),
      key: o.key,
      style: typeof o.option.tags === 'object' ? o.option.tags : undefined,
    }));
    return;
  }
  const text = line as BrocatelTextLine;
  lines.value.push({
    html: markdownToHtml(text.text),
    style: typeof text.tags === 'object' ? text.tags : undefined,
  });
  setTimeout(nextLine, props.autoNextLineDelay * 1000);
}

function initStory() {
  lines.value = [];
  options.value = [];
  props.story.reload();
  nextLine();
}

onMounted(() => {
  initStory();
});
</script>
