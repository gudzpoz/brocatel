<template>
  <div class="story-teller">
    <TextLines :lines="lines" :options="options"
     @select-option="nextLine" class="lines" />
  </div>
</template>
<script setup lang="ts">
import {
  SelectLine, StoryRunner, TextLine as BrocatelTextLine,
} from '@brocatel/mdc';
import { onMounted, ref, watch } from 'vue';
import TextLines, { Option, TextLine } from './TextLines.vue';
import useMarkdownToHtml from '../composables/useMarkdownToHtml';
import { tryCatchLua } from '../composables/useStory';

const props = withDefaults(defineProps<{
  story: Omit<StoryRunner, 'L'>;
  autoNextLineDelay?: number;
}>(), {
  autoNextLineDelay: 0.1,
});
watch(() => props.story, () => {
  initStory();
});

const lines = ref<TextLine[]>([]);
const options = ref<Option[]>([]);
let hasError = false;

const markdownToHtml = useMarkdownToHtml();

function handleErr(msg: { message: string }) {
  hasError = true;
  options.value = [];
  lines.value.push({
    html: `<pre><code style="color: red">${msg.message}</code></pre>`,
    speakerHtml: '',
  });
}

function nextLine(option?: number) {
  if (hasError) {
    return;
  }
  const line = tryCatchLua(() => props.story.next(option), handleErr);
  if (!line) {
    return;
  }
  if ((line as SelectLine | null)?.select) {
    const select = line as SelectLine;
    options.value = select.select.map((o) => ({
      html: markdownToHtml(o.option.text),
      key: o.key,
    }));
    return;
  }
  const text = line as BrocatelTextLine;
  lines.value.push({
    html: markdownToHtml(text.text),
    speakerHtml: '',
  });
  setTimeout(nextLine, props.autoNextLineDelay * 1000);
}

function initStory() {
  hasError = false;
  lines.value = [];
  if (!props.story.isLoaded()) {
    return;
  }
  tryCatchLua(() => props.story.reload(), handleErr);
  nextLine();
}

onMounted(() => {
  initStory();
});
</script>
<style scoped>
.story-teller {
  height: 100%;
}
</style>

