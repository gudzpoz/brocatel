<template>
  <pre ref="defaultText" style="display: none"><slot></slot></pre>
  <div v-if="inSight" class="md-example" :style="{ height: props.height }">
    <brocatel-editor
      :modelValue="markdown"
      :plainText="false"
      :diagnostics="diagnostics"
      :dark-mode="isDark"
      @update:modelValue="(s: string) => handleChange(s)"
    />
    <div ref="output" class="md-output">
      <story-menu :container="container"/>
      <div class="output-container">
        <story-teller :story="story" class="story" />
      </div>
    </div>
  </div>
  <button v-else ref="hindsight" @click="refetch(true)">Load Example</button>
</template>

<script setup lang="ts">
import { debug } from '@brocatel/mdc';
import { StoryContainer, StoryMenu, StoryTeller } from '@brocatel/mdui';
import debounce from 'debounce';
import { useData } from 'vitepress';
import { onMounted, onUnmounted, ref, watch } from 'vue';

import '@brocatel/mde/dist/style.css';
import '@brocatel/mdui/dist/style.css';

const props = defineProps<{
  height?: string,
  autoScroll?: boolean,
  markdown?: string,
}>();
const { isDark } = useData();

const markdown = ref('');
watch(() => props.markdown, (md) => {
  if (md !== undefined) {
    handleChangeNow(md);
  }
});

const container = new StoryContainer();
const story = container.ref;

const diagnostics = ref<debug.MarkdownSourceError[]>([]);
container.errorHandler = (errors: debug.MarkdownSourceError[] | null) => {
  diagnostics.value = errors ?? [];
};

async function handleChangeNow(code: string) {
  if (code.trim() === '') {
    return;
  }
  markdown.value = code;
  await container.updateStory('main', async () => code);
}
const handleChange = debounce(handleChangeNow, 1000);

// Automatic compilation on mount and update.
const defaultText = ref<HTMLPreElement>();
const hindsight = ref<HTMLButtonElement>();
let preObserver: MutationObserver | null = null;
let sightObserver: IntersectionObserver | null = null;
const inSight = ref(false);
function refetch(intoView?: boolean) {
  if (defaultText.value && (inSight.value || intoView)) {
    const pre = defaultText.value?.querySelector('pre');
    handleChangeNow(props.markdown ?? (pre ? pre.innerText : ''));
    inSight.value = true;
  }
}
onMounted(() => {
  if (defaultText.value) {
    preObserver = new MutationObserver(() => refetch());
    preObserver.observe(defaultText.value, { subtree: true, childList: true, characterData: true });
  }
  if (hindsight.value) {
    sightObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        sightObserver?.disconnect();
        sightObserver = null;
        refetch(true);
      }
    }, { threshold: 0 });
    sightObserver.observe(hindsight.value);
  }
});
onUnmounted(() => {
  preObserver?.disconnect();
  preObserver = null;
  sightObserver?.disconnect();
  sightObserver = null;
});
</script>

<style>
.md-example {
  margin: 1em 0 1em 0;
  box-shadow: 0 0 2px var(--vp-c-brand);
  background-color: var(--vp-c-bg);
  height: 50vh;
  display: flex;
  flex-direction: row;
}
.md-example > div {
  width: 50%;
}
.md-output {
  border-left: 1px solid var(--vp-c-brand-dimm);
  margin: 0;
}
.md-output > div {
  height: 1.5em;
}
.md-output > div.output-container {
  height: calc(100% - 1.5em);
  background-color: var(--vp-c-bg-alt);
  padding: 0;
}
.md-output > div.output-container > .story {
  height: 100%;
}
.md-output > div.output-container p {
  margin: 0;
  padding: 0.2em;
}
@media only screen and (max-width: 640px) {
  .md-example {
    flex-direction: column-reverse;
    min-height: 50vh;
  }
  .md-example > div {
    width: 100%;
    height: 50%;
  }
  .md-output {
    border-left: none;
  }
}

.md-output button {
  background-color: var(--vp-c-brand-lightest);
  padding: 0 1em 0 1em;
  border: 1px solid var(--vp-c-brand);
  border-radius: 0.2em;
  transition: 0.5s all;
  box-shadow: 1px 1px 1px var(--vp-c-brand);
  color: black;
}
.md-output button:hover {
  background-color: var(--vp-c-brand-lighter);
}

/* mde styles */
.brocatel-editor {
  margin: 0;
}
.brocatel-editor > .milkdown-menu {
  margin: 0;
  background-color: var(--vp-c-bg);
}
.brocatel-editor div[data-milkdown-root] {
  margin: 0.2em 0 0.2em 0;
  padding: 0.2em 0.5em 0.2em 0.5em;
  background-color: var(--vp-c-bg-alt);
}
.milkdown-menu button {
  border: 1px solid var(--vp-c-brand-darker);
  background-color: var(--vp-c-bg-alt);
  margin: 0.2em;
  padding: 0 1em 0 1em;
  transition: all 0.2s;
  box-shadow: var(--vp-shadow-1);
}
.milkdown-menu button:hover {
  background-color: var(--vp-c-bg);
}
.brocatel-editor div[data-milkdown-root] ul {
  border: 1px solid var(--vp-c-gray);
}
.brocatel-editor h1, .brocatel-editor h2, .brocatel-editor h3, .brocatel-editor h4, .brocatel-editor h5, .brocatel-editor h6 {
  margin: 0;
  padding: 0;
}
</style>
