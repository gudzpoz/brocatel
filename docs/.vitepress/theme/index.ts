// https://vitepress.dev/guide/custom-theme
import { defineAsyncComponent, h } from 'vue';
import Theme from 'vitepress/theme';

import './style.css';

export default {
  ...Theme,
  Layout: () => h(Theme.Layout, null, {
    // https://vitepress.dev/guide/extending-default-theme#layout-slots
  }),
  enhanceApp({ app }) {
    app.component('VueMonacoEditor', defineAsyncComponent(() => import('@guolao/vue-monaco-editor')));
    // @ts-ignore
    app.component('MdExample', defineAsyncComponent(() =>  import('../components/MdExample.vue')));
  },
};
