<template>
  <div>
    <button @click="restart">Restart</button>
    <button @click="qSave">Q.Save</button>
    <button :disabled="!qSaved" @click="qLoad">Q.Load</button>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { BrocatelStory, useStory } from '../composables/useStory';

const story = useStory();

function restart() {
  const s = story.value;
  story.value = new BrocatelStory();
  s.reload();
  nextTick(() => {
    story.value = s;
  });
}

const qSaved = ref<{ save: string, story: BrocatelStory } | null>(null);
function qSave() {
  const save = story.value.save();
  qSaved.value = save ? { save, story: story.value } : null;
}
function qLoad() {
  if (qSaved.value && qSaved.value.story === story.value) {
    const s = story.value;
    story.value = new BrocatelStory();
    s.load(qSaved.value.save);
    nextTick(() => {
      story.value = s;
    });
  } else {
    qSaved.value = null;
  }
}
</script>
