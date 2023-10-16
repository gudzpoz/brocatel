<template>
  <div
    class="resizable-input not-prose"
    contenteditable="false"
    :style="{ display: block ? 'block' : 'inline' }"
    @blur="update"
  >
    <div
      class="not-prose"
      :class="{ placeholding: innerValue === '' }"
      contenteditable="true"
      @input="update"
      v-text="inner"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  block?: boolean,
  value?: string,
  placeholder?: string;
}>();

// eslint-disable-next-line no-spaced-func
const emit = defineEmits<{
  (event: 'update:value', value: string): void,
}>();

const inner = props.value ?? '';
const innerValue = ref(inner);

function update(e: Event) {
  const target = e.target as (HTMLElement | null);
  if (target) {
    let text = target?.innerText;
    if (text.includes('\n')) {
      text = text.replace(/\n/g, '');
      target.innerText = text;
    }
    innerValue.value = text;
    emit('update:value', text);
  }
}

const placeholderString = computed(() => JSON.stringify(props.placeholder ?? ''));
</script>
<style scoped>
.resizable-input > div {
  display: inline-block;
}
.resizable-input > div.placeholding::after {
  content: v-bind(placeholderString);
  display: inline;
  color: gray;
}
</style>
