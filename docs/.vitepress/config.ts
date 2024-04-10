import markdownItTodo from 'markdown-it-task-lists';
import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Brocatel',
  base: '/brocatel/',
  head: [
    ['link', { rel: 'icon', href: '/brocatel/favicon.png' }],
  ],
  description: 'Write your game plots in Markdown and Lua.',
  markdown: {
    config: (md) => {
      md.use(markdownItTodo);
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/favicon.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Lua API', link: '/api/index.html' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'The Tutorial', link: '/tutorial' },
          { text: 'Cloak of Darkness', link: '/cloak' },
        ],
      },
      {
        text: 'Advanced Usages',
        items: [
          { text: 'Advanced Choices', link: '/choices' },
          { text: 'Story Subroutines', link: '/subroutine' },
          { text: 'Caveats', link: '/caveat' },
          { text: 'Complete Grammar', link: '/grammar' },
        ],
      },
      {
        text: 'Internals',
        items: [
          { text: 'Architecture', link: '/arch' },
          { text: 'Road Map', link: '/roadmap' },
        ],
      },
      {
        text: 'Playground',
        link: '/playground',
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gudzpoz/brocatel' },
    ],
  },

  vite: {
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
});
