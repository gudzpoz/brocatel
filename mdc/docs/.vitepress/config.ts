import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Brocatel',
  description: 'Write your game plots in Markdown and Lua.',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'The Tutorial', link: '/tutorial' },
          { text: 'Cloak of Darkness', link: '/cloak' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gudzpoz/brocatel' },
    ],
  },
});
