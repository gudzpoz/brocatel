<template>
  <div class="story">
    <StoryMenu :container="container" class="menu" />
    <StoryTeller :story="story" class="story-teller" />
  </div>
</template>
<script setup lang="ts">
import StoryMenu from './components/StoryMenu.vue';
import StoryTeller from './components/StoryTeller.vue';
import { useContainer } from './composables/useStory';

const container = useContainer();
const story = container.ref;
</script>
<style scoped>
.story {
  height: 100%;
}
.story > .menu {
  position: sticky;
  height: 2em;
}
.story > .story-teller {
  height: calc(100% - 2em);
}
</style>
