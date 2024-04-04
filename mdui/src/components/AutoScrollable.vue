<template>
  <div ref="container" class="auto-scrollable">
    <div ref="main">
      <slot></slot>
    </div>
    <div class="footer" ref="footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Bezier } from 'bezier-js';
import { ref, onMounted, onUnmounted } from 'vue';

const container = ref<HTMLElement>();
const main = ref<HTMLElement>();
const footer = ref<HTMLElement>();

const props = withDefaults(
  defineProps<{
    autoScrollRatio?: number;
    autoScrollRatioRandom?: number;
    duration?: number;
    minSpeed?: number;
    minSpeedRandom?: number;
    overScrollRatio?: number;
  }>(),
  {
    autoScrollRatio: 0.3,
    autoScrollRatioRandom: 0.5,
    duration: 1000,
    minSpeed: 360,
    minSpeedRandom: 60,
    overScrollRatio: 0.8,
  },
);

let nextFrameHandle: number | null = null;
let dest = 0;

function discoScroll(destination: number, duration: number) {
  if (!container.value) {
    return;
  }
  dest = destination;
  if (nextFrameHandle) {
    return;
  }
  const start = window.performance.now();
  const startH = container.value.scrollTop;
  const bezier = new Bezier(0, 0, 0.5, -0.36, 0.5, 1.24, 1, 1);
  const dt = Math.min(
    duration,
    (Math.abs(dest - startH) /
      (props.minSpeed + Math.random() * props.minSpeedRandom)) *
      1000,
  );
  const nextScrollFrame = () => {
    const progress = (window.performance.now() - start) / dt;
    if (!container.value || progress >= 1) {
      nextFrameHandle = null;
      return;
    }
    const { y } = bezier.get(progress);
    container.value.scrollTo({
      top: y * (dest - startH) + startH,
      behavior: 'instant',
    });
    nextFrameHandle = requestAnimationFrame(nextScrollFrame);
  };
  nextFrameHandle = requestAnimationFrame(nextScrollFrame);
}

const overScrollHeight = ref('50%');
function updateOverScrollHeight() {
  if (!container.value) {
    return;
  }
  overScrollHeight.value = `${
    container.value.getBoundingClientRect().height * props.overScrollRatio
  }px`;
}

function scrollToBottom() {
  if (!main.value || !container.value || !footer.value) {
    return;
  }
  const children = [...main.value.children, footer.value];
  if (children.length === 0) {
    return;
  }
  const lastChild = children[children.length - 1] as HTMLElement;
  if (
    lastChild.offsetTop + lastChild.clientHeight >
    container.value.scrollTop + container.value.clientHeight
  ) {
    discoScroll(
      lastChild.offsetTop -
        container.value.clientHeight *
          (1 -
            (props.autoScrollRatio +
              Math.random() * props.autoScrollRatioRandom)),
      props.duration,
    );
  }
}

let mutationObserver: MutationObserver | null = null;

onMounted(() => {
  if (!container.value) {
    return;
  }
  updateOverScrollHeight();
  mutationObserver = new MutationObserver(scrollToBottom);
  mutationObserver.observe(container.value, { childList: true, subtree: true });
});
onUnmounted(() => {
  if (!container.value) {
    return;
  }
  container.value.removeEventListener('scroll', scrollToBottom);
  mutationObserver?.disconnect();
});
</script>
<style scoped>
.auto-scrollable {
  position: relative;
  height: 100%;
  overflow-y: scroll;
}
.footer {
  margin-bottom: v-bind(overScrollHeight);
}
</style>
