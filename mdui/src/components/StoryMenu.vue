<template>
  <div>
    <button @click="container.reloadStory(true)">Restart</button>
    <button @click="qSave">Q.Save</button>
    <button :disabled="!qSaved" @click="qLoad">Q.Load</button>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { StoryContainer } from '../composables/useStory';

const props = defineProps<{
  container: StoryContainer,
}>();

const story = props.container.ref;

const qSaved = ref<string | null>(null);
function qSave() {
  qSaved.value = story.value.save();
}
function qLoad() {
  if (qSaved.value) {
    story.value.load(qSaved.value);
    if (!story.value.getErr()) {
      props.container.reloadStory();
      return;
    }
  }
  qSaved.value = null;
}
</script>
