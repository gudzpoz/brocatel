<template>
  <div>
    <button @click="container.reloadStory()">Restart</button>
    <button @click="qSave">Q.Save</button>
    <button :disabled="!qSaved" @click="qLoad">Q.Load</button>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { BrocatelStory, StoryContainer } from '../composables/useStory';

const props = defineProps<{
  container: StoryContainer,
}>();

const story = props.container.ref;

const qSaved = ref<{ save: string, story: BrocatelStory } | null>(null);
function qSave() {
  const save = story.value.save();
  qSaved.value = save ? { save, story: story.value } : null;
}
function qLoad() {
  if (qSaved.value && qSaved.value.story === story.value) {
    story.value.load(qSaved.value.save);
    props.container.reloadStory()
  } else {
    qSaved.value = null;
  }
}
</script>
