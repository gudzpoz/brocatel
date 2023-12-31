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
      <div><b>Story Output:</b></div>
      <div class="output-container">
        <div class="lines">
          <TransitionGroup>
            <p v-for="line, i in lines" :key="i" v-html="parse(line.text)" :style="line.tags === true ? {} : line.tags"></p>
          </TransitionGroup>
        </div>
        <Transition>
          <div v-show="options.length > 0">
            <button v-for="option in options" :key="option.option.text"
              @click="multiNext(10, option.key)" v-html="parse(option.option.text, true)"
              :style="option.option.tags === true ? {} : option.option.tags"
            >
            </button>
          </div>
        </Transition>
        <button v-show="options.length === 0 && story && completed && !ended" @click="multiNext(10)">
          Next Few Lines
        </button>
        <Transition>
          <div v-show="ended">
            <div>~~ ended ~~</div>
            <button @click="handleChangeNow(markdown)">Restart</button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
  <button v-else ref="hindsight" @click="refetch(true)">Load Example</button>
</template>

<script setup lang="ts">
import { StoryRunner, type SelectLine, type TextLine } from '@brocatel/mdc';
import type { Diagnostic } from '@brocatel/mde';
import { debounce } from '@github/mini-throttle';
import { VFile } from 'vfile';
import { useData } from 'vitepress';
import { onMounted, onUnmounted, ref } from 'vue';

import { useCompiler } from './compiler';
import { parse } from './markdown';

import '@brocatel/mde/dist/style.css';

const props = defineProps<{
  height?: string,
  autoScroll?: boolean,
}>();
const { isDark } = useData();

const markdown = ref('');
// Automatically compile new script.
const story = new StoryRunner();

const diagnostics = ref<Diagnostic[]>([]);
function annotateErrors(vfile: VFile) {
  diagnostics.value = vfile.messages.map((msg) => ({
    from: msg.position?.start.offset ?? 0,
    to: msg.position?.end.offset ?? 0,
    severity: 'error',
    message: msg.message,
  }));
}
async function handleChangeNow(code: string) {
  if (code.trim() === '') {
    return;
  }
  markdown.value = code;
  clear();
  try {
    const compiled = await useCompiler().compileAll('main', async () => code);
    annotateErrors(compiled);
    await story.loadStory(compiled.toString().trim());
    multiNext(10);
  } catch (e) {
    console.log(code);
    console.log(e);
  }
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
    handleChangeNow(pre ? pre.innerText : '');
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

// User interaction.
const completed = ref(true);
const ended = ref(false);
const lines = ref<TextLine[]>([]);
const options = ref<SelectLine['select']>([]);
function clear() {
  completed.value = true;
  ended.value = false;
  lines.value = [];
  options.value = [];
}
function multiNext(count: number, option?: number) {
  if (!completed.value) {
    return;
  }
  function runNext(i: number, option?: number) {
    const v = next(option);
    if (i < count && v) {
      setTimeout(() => runNext(i + 1), 1);
    } else {
      completed.value = true;
    }
  }
  completed.value = false;
  runNext(0, option);
}
function next(option?: number): boolean {
  if (!story.isLoaded()) {
    return false;
  }
  if (option) {
    options.value = [];
  }
  const line = story.next(option);
  if (!line) {
    ended.value = true;
    return false;
  }
  if ((line as TextLine).text) {
    const l = line as TextLine;
    l.tags = typeof l.tags === 'boolean' ? {} : l.tags;
    lines.value.push(l);
    return true;
  } else if ((line as SelectLine).select) {
    options.value = (line as SelectLine).select;
    return false;
  }
  return false;
}
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
.md-example>div {
  width: 50%;
}
.md-output {
  border-left: 1px solid var(--vp-c-brand-dimm);
  margin: 0;
  display: flex;
  flex-direction: column;
}
.md-output .output-container {
  overflow: auto;
  background-color: var(--vp-c-bg-alt);
  padding: 0;
}
.md-output .output-container p {
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

.v-enter-active,
.v-leave-active {
  transition: opacity 1s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
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
