// https://vitepress.dev/guide/custom-theme
import { defineAsyncComponent } from 'vue';
import Theme from 'vitepress/theme';

import './style.css';

const enhanced: typeof Theme = {
  ...Theme,
  async enhanceApp({ app }) {
    if (!(import.meta as any as { env: Record<string, any> }).env.SSR) {
      app.component('BrocatelEditor', defineAsyncComponent(async () => (await import('@brocatel/mde')).BrocatelEditor));
      app.component('MdExample', defineAsyncComponent(() => import('../components/MdExample.vue')));
    }
  },
};
export default enhanced;
