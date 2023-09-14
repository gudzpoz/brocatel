import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Brocatel',
  base: '/brocatel/',
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
      {
        text: 'Advanced Usages',
        items: [
          { text: 'Story Subroutines', link: '/subroutine' },
          { text: 'Caveats', link: '/caveat' },
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
      {
        text: 'Archives',
        items: [
          { text: 'The Old Tutorial', link: '/tutorial_old' },
        ],
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
