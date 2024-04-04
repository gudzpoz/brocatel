<template>
  <div class="lines">
    <AutoScrollable>
      <template #default>
        <ClientOnly>
          <TransitionGroup name="line">
            <div v-for="line in lines" :key="line.html" class="line">
              <div v-if="line.speakerHtml" v-html="line.speakerHtml"></div>
              <div v-if="line.html" v-html="line.html"></div>
            </div>
          </TransitionGroup>
        </ClientOnly>
      </template>
      <template #footer>
        <Transition name="footer">
          <ul v-show="currentOptions.length !== 0">
            <li
              v-for="option in currentOptions"
              :key="option.key"
            >
              <a @click.prevent="selectOption(option.key)" href="#" v-html="option.html"></a>
            </li>
          </ul>
        </Transition>
      </template>
    </AutoScrollable>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AutoScrollable from './AutoScrollable.vue';
import autoRef from '../utils/autoRef';

export interface TextLine {
  html: string;
  speakerHtml: string;
}
export interface Option {
  html: string;
  key: number;
}

const props = withDefaults(
  defineProps<{
    lines: TextLine[];
    options?: Option[];
    enterAnimationDuration?: number;
    itemEnterDelay?: number;
    maxItemEnterDelay?: number;
  }>(),
  {
    options: () => [],
    enterAnimationDuration: 1.5,
  }
);
const currentOptions = autoRef(() => props.options);
const animationDuration = computed(() => `${props.enterAnimationDuration}s`);

const emit = defineEmits<{
  'select-option': [key: number];
}>();

function selectOption(key: number) {
  currentOptions.value = [];
  emit('select-option', key);
}
</script>
<style scoped>
.lines {
  height: 100%;
}
.line > div {
  display: inline;
}
.footer-enter-active,
.line-enter-active,
.footer-leave-active,
.line-leave-active {
  transition: all v-bind(animationDuration) ease;
}
.footer-enter-from,
.line-enter-from {
  opacity: 0;
}
.footer-leave-to,
.line-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.footer-leave-active {
  position: absolute;
}
</style>
