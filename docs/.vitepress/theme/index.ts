// https://vitepress.dev/guide/custom-theme
import { defineAsyncComponent } from 'vue';
import Theme from 'vitepress/theme';

import './style.css';

const enhanced: typeof Theme = {
  ...Theme,
  async enhanceApp({ app, router }) {
    if (!(import.meta as any as { env: Record<string, any> }).env.SSR) {
      app.component('BrocatelEditor', defineAsyncComponent(async () => (await import('@brocatel/mde')).BrocatelEditor));
      app.component('MdExample', defineAsyncComponent(() => import('../components/MdExample.vue')));
      router.onBeforeRouteChange = (route) => {
        console.log(route);
        if (!route.startsWith('/brocatel/api/')) {
          return true;
        }
        const url = new URL(`${location.protocol}//${location.host}${route}`);
        if (url.pathname.endsWith('/')) {
          url.pathname += 'index.html';
        }
        window.open(url, '_blank');
        return false;
      };
    }
  },
};
export default enhanced;
