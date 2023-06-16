<template>
  <div class="md-example" :style="{ height: props.height }">
    <pre ref="defaultText" style="display: none"><slot></slot></pre>
    <vue-monaco-editor
      v-model:value="code"
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
</template>

<script setup lang="ts">
import { debounce } from '@github/mini-throttle';
import { type BrocatelCompiler } from 'brocatel-mdc';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import { useData } from 'vitepress';
import { nextTick, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
  height?: string,
}>();
// @ts-ignore
import bundle from '../cache/vm-bundle.lua?raw';

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
const compiler = ref<BrocatelCompiler>();
const fengari = ref<any>();
const output = ref<HTMLDivElement>();
const story = ref<Story>();
const handleChange = debounce(async (code: string) => {
  if (!code || !output.value) {
    return;
  }
  clear();
  try {
    if (!compiler.value) {
      // It seems that fengari uses `document` somewhere, messing up the whole SSR.
      const mdc = await import('brocatel-mdc');
      compiler.value = new mdc.BrocatelCompiler({ noAutoNewLine: false });
      fengari.value = mdc.fengari;
    }
    const compiled = await compiler.value.compileAll('main', async () => code);
    try {
      const s = compiled.toString().trim()
      story.value = new Story(s, fengari.value);
      multiNext(10);
    } catch (e) {
      console.log(compiled.toString());
    }
  } catch (e) {
    console.log(code);
  }
}, 1000);

// Automatic compilation on mount and update.
const code = ref('');
const defaultText = ref<HTMLPreElement>();
const observer = ref<MutationObserver>();
onMounted(function refetch() {
  const pre = defaultText.value?.querySelector('pre');
  if (pre) {
    code.value = pre.innerText;
    handleChange(code.value);
    observer.value?.disconnect();
    observer.value = new MutationObserver(refetch);
    observer.value.observe(pre, { subtree: true, childList: true, characterData: true });
  }
});
onUnmounted(() => observer.value?.disconnect());

// VM wrapper.
class Story {
  fengari: any;
  L: any;

  constructor(story: string, fengari: any) {
    this.fengari = fengari;
    const { lauxlib, lualib, lua, to_luastring } = fengari;
    const L = lauxlib.luaL_newstate();
    this.L = L;
    lualib.luaL_openlibs(L);
    lauxlib.luaL_requiref(L, 'js', fengari.js.luaopen_js, false);
    this.doString(bundle);
    lua.lua_setglobal(L, 'vm');
    lua.lua_pushstring(L, to_luastring(story));
    lua.lua_setglobal(L, 's');
    this.doString('story=vm.load_vm(s)');
  }

  doString(s: string) {
    const { lauxlib, lua, to_luastring } = this.fengari;
    if (lauxlib.luaL_dostring(this.L, to_luastring(s)) !== lua.LUA_OK) {
      throw new Error(`${lua.lua_tojsstring(this.L, -1)}:\n${s}`);
    }
  }

  next(option?: number) {
    const { lua, tojs } = this.fengari;
    if (option) {
      lua.lua_pushnumber(this.L, option);
    } else {
      lua.lua_pushnil(this.L);
    }
    lua.lua_setglobal(this.L, 'option');
    this.doString('return story:next(option)');
    const content = tojs(this.L, -1);
    lua.lua_pop(this.L, 1);
    return content;
  }
}

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
    nextTick(() => {
      if (output.value) {
        output.value.scrollTop = output.value.scrollHeight;
      }
    });
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

// Markdown to HTML.
const parser = remark().use(remarkHtml);
function parse(markdown: string, strip?: boolean): string {
  const s = parser.processSync(markdown).toString().replace(/\n\n/g, '\n');
  if (strip) {
    return s.trim().replace(/^<p>/, '').replace(/<\/p>$/, '');
  }
  return s;
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
</style>
