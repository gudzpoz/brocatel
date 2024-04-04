<template>
  <div class="story">
    <StoryTeller :story="story" />
  </div>
</template>
<script setup lang="ts">
import StoryTeller from './components/StoryTeller.vue';
import { useStory } from './composables/useStory';

const story = useStory();
</script>
<style scoped>
.story {
  height: 100%;
}
</style>
