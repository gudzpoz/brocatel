<template>
  <div class="md-example">
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
        <TransitionGroup><p v-for="line, i in lines" :key="i">{{ line }}</p></TransitionGroup>
      </div>
      <Transition>
        <div v-show="options.length > 0">
          <button v-for="option in options" :key="option.option" @click="next(option.key)">
            {{ option.option }}
          </button>
        </div>
      </Transition>
      <button v-show="options.length === 0 && story && completed" @click="multiNext(10)">Next</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BrocatelCompiler, fengari } from 'brocatel-mdc';
import { debounce } from '@github/mini-throttle';
import { useData } from 'vitepress';
import { computed, nextTick, ref, watch } from 'vue';

import bundle from '../cache/vm-bundle.lua?raw';

const { isDark } = useData();
const monacoOptions: any = {
  folding: false,
  fontFamily: 'sans-serif',
  glyphMargin: false,
  lineNumbers: 'on',
  lineDecorationsWidth: 1,
  minimap: { enabled: false },
  scrollBeyondLastLine: true,
  wordWrap: 'bounded',
};

// Automatically compile new script.
const compiler = new BrocatelCompiler({
  noAutoNewLine: false,
});
const output = ref<HTMLDivElement | null>(null);
let story = ref<Story | null>(null);
const handleChange = debounce(async (code: string) => {
  if (!code || !output.value) {
    return;
  }
  clear();
  const compiled = await compiler.compileAll('main', async () => code);
  try {
    story.value = new Story(compiled.toString().trim());
  } catch (e) {
    console.log(compiled.toString());
  }
}, 2000);

// Automatic compilation on mount.
const code = ref('');
const defaultText = ref<HTMLPreElement | null>(null);
watch(computed(() => output.value && defaultText.value), (pre) => {
  if (pre) {
    code.value = pre.innerText;
    handleChange(code.value);
  }
});

// VM wrapper.
const { lauxlib, lualib, lua, to_luastring, tojs } = fengari;
class Story {
  L: any;

  constructor(story: string) {
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
    if (lauxlib.luaL_dostring(this.L, to_luastring(s)) !== lua.LUA_OK) {
      throw new Error(`${lua.lua_tojsstring(this.L, -1)}:\n${s}`);
    }
  }

  next(option?: number) {
    if (option) {
      lua.lua_pushnumber(this.L, option);
    } else {
      lua.lua_pushnil(this.L);
    }
    lua.lua_setglobal(this.L, 'option');
    this.doString('return story:next(option)');
    const content = tojs(this.L, -1);
    lua.lua_pop(this.L, 1);
    console.log(content);
    return content;
  }
}

const completed = ref(true);
const lines = ref<string[]>([]);
const options = ref<{ option: string, key: number }[]>([]);
function clear() {
  lines.value = [];
  options.value = [];
}
function multiNext(count: number) {
  if (!completed.value) {
    return;
  }
  function runNext(i: number) {
    if (i < count && next()) {
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
  runNext(0);
}
function next(option?: number): boolean {
  if (!story.value) {
    return false;
  }
  if (option) {
    options.value = [];
  }
  const line = story.value.next(option);
  if (line.text) {
    lines.value.push(line.text);
    return true;
  } else if (line.select) {
    options.value = line.select;
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
</style>
