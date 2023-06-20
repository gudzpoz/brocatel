<template>
  <pre ref="defaultText" style="display: none"><slot></slot></pre>
  <div v-if="inSight" class="md-example" :style="{ height: props.height }">
    <vue-monaco-editor
      v-model:value="defaultCode"
      @mount="monacoMount"
      @change="handleChange"
      :options="monacoOptions"
      :theme="isDark ? 'vs-dark' : 'light'"
      language="markdown"
      width=""
      height=""
    />
    <div ref="output" class="md-output">
      <div class="lines">
        <TransitionGroup>
          <p v-for="line, i in lines" :key="i" v-html="parse(line.text)" :style="line.tags"></p>
        </TransitionGroup>
      </div>
      <Transition>
        <div v-show="options.length > 0">
          <button v-for="option in options" :key="option.option"
            @click="multiNext(10, option.key)" v-html="parse(option.option, true)">
          </button>
        </div>
      </Transition>
      <button v-show="options.length === 0 && story && completed && !ended" @click="multiNext(10)">
        Next Few Lines
      </button>
      <Transition><div v-show="ended">~~ ended ~~</div></Transition>
    </div>
  </div>
  <button v-else ref="hindsight" @click="refetch(true)">Load Example</button>
</template>

<script setup lang="ts">
import { debounce } from '@github/mini-throttle';
import { VFile } from 'vfile';
import { useData } from 'vitepress';
import { onMounted, onUnmounted, ref } from 'vue';

import { useCompiler, useFengari } from './compiler';
import { parse } from './markdown';
import Story from './story';

const props = defineProps<{
  height?: string,
  autoScroll?: boolean,
}>();

const { isDark } = useData();
const monacoOptions: any = {
  folding: false,
  fontSize: 10.5,
  glyphMargin: false,
  lineNumbers: 'on',
  lineDecorationsWidth: 1,
  minimap: { enabled: false },
  scrollBeyondLastLine: true,
  wordWrap: 'bounded',
};

// Automatically compile new script.
const story = ref<Story>();
let editor: any = null;
let decorations: any = null;
function monacoMount(monacoEditor: any) {
  editor = monacoEditor;
}
function annotateErrors(vfile: VFile) {
  if (!editor) {
    return;
  }
  let annotations = vfile.messages.map((m) => {
    if (!m.position) {
      return null;
    }
    const range = {
      endColumn: m.position.end.column,
      endLineNumber: m.position.end.line,
      startColumn: m.position.start.column,
      startLineNumber: m.position.start.line,
    };
    return {
      range,
      options: {
        hoverMessage: { value: m.message },
        inlineClassName: 'md-warning',
      },
    };
  }).filter((e) => e);

  if (decorations) {
    decorations.clear();
  }
  decorations = editor.createDecorationsCollection(annotations);
}
const handleChange = debounce(async (code: string) => {
  if (!code) {
    return;
  }
  clear();
  try {
    const compiled = await (await useCompiler()).compileAll('main', async () => code);
    defaultCode.value = code;
    annotateErrors(compiled);
    const s = compiled.toString().trim()
    story.value = new Story(s, await useFengari());
    multiNext(10);
  } catch (e) {
    console.log(e);
  }
}, 1000);

// Automatic compilation on mount and update.
const defaultCode = ref('');
const defaultText = ref<HTMLPreElement>();
const hindsight = ref<HTMLButtonElement>();
let preObserver: MutationObserver | null = null;
let sightObserver: IntersectionObserver | null = null;
const inSight = ref(false);
function refetch(intoView?: boolean) {
  const pre = defaultText.value?.querySelector('pre');
  if (pre && (inSight || intoView)) {
    defaultCode.value = pre.innerText;
    handleChange(defaultCode.value);
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
const lines = ref<{ text: string, tags: { [key: string]: string } }[]>([]);
const options = ref<{ option: string, key: number }[]>([]);
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
  if (!story.value) {
    return false;
  }
  if (option) {
    options.value = [];
  }
  const line = story.value.next(option);
  if (!line) {
    ended.value = true;
    return false;
  }
  if (line.text) {
    line.tags = typeof line.tags === 'boolean' ? {} : line.tags;
    lines.value.push(line);
    return true;
  } else if (line.select) {
    options.value = line.select;
    return false;
  }
  return false;
}
</script>

<style>
.md-example {
  margin: 1em 0 1em 0;
  box-shadow: 0 0 2px var(--vp-c-brand);
  height: 50vh;
  display: flex;
  flex-direction: row;
}
.md-example>div {
  width: 50%;
}
.md-example .monaco-editor .margin .line-numbers {
  text-align: left;
  padding-left: 1em;
}
.md-output {
  padding: 1em;
  overflow-y: scroll;
}
@media only screen and (max-width: 640px) {
  .md-example {
    flex-direction: column-reverse;
    height: 80vh;
  }
  .md-example>div {
    width: 100%;
    height: 40vh;
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

/* Monaco styles */
.md-warning {
  text-decoration: red wavy underline;
}
.hover-contents p {
  line-height: 1em;
}
</style>
