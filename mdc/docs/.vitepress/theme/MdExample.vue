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
    </div>
  </div>
</template>

<script setup lang="ts">
import { BrocatelCompiler } from 'brocatel-mdc';
import { debounce } from '@github/mini-throttle';
import { useData } from 'vitepress';
import { ref, watch } from 'vue';

const { isDark } = useData();

const code = ref('');
const defaultText = ref<HTMLPreElement | null>(null);
watch(defaultText, (pre) => {
  if (pre) {
    code.value = pre.innerText;
  }
});
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
const compiler = new BrocatelCompiler({
  noAutoNewLine: false,
});

const output = ref<HTMLDivElement | null>(null);
const handleChange = debounce(async (code: string) => {
    const compiled = await compiler.compileAll('main', async () => code);
    if (output.value) {
      output.value.innerText = compiled.toString().trim();
    }
}, 2000);
handleChange(code.value);
</script>

<style>
.md-example {
  margin: 1em 0 1em 0;
  box-shadow: -1px -1px 1px black;
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
  box-shadow: 0px 0px 4px inset var(--vp-c-brand);
}
@media only screen and (max-width: 640px) {
  .md-example {
    flex-direction: column;
    height: 80vh;
  }
  .md-example>div {
    width: 100%;
    height: 40vh;
  }
}
</style>
