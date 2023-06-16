// https://vitepress.dev/guide/custom-theme
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'
import { h } from 'vue';
import Theme from 'vitepress/theme';

import MdExample from './MdExample.vue';
import './style.css';

export default {
  ...Theme,
  Layout: () => h(Theme.Layout, null, {
    // https://vitepress.dev/guide/extending-default-theme#layout-slots
  }),
  enhanceApp({ app }) {
    app.use(VueMonacoEditorPlugin);
    app.component('MdExample', MdExample);
  },
};
