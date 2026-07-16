import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Daily Byte",
  description: "Daily codex",
  head: [
    [
      'style',
      {},
      `
      :root {
        --vp-sidebar-width: 200px;
      }
      @media (min-width: 1440px) {
        .VPSidebar {
          padding-left: 32px !important;
          width: var(--vp-sidebar-width) !important;
        }
      }
      `
    ]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '文章', link: '/posts/first' }
    ],

    sidebar: [
      {
        text: '文章列表',
        items: [
          { text: '我的第一篇博客', link: '/posts/first' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
