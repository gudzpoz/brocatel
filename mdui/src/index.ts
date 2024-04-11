import StoryTellerVue from './components/StoryTeller.vue';
import StoryMenuVue from './components/StoryMenu.vue';

export const StoryMenu = StoryMenuVue;
export const StoryTeller = StoryTellerVue;

export {
  useContainer, BrocatelStory, StoryContainer,
} from './composables/useStory';
