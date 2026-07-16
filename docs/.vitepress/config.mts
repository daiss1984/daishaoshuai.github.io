import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Daily Byte",
  description: "Daily Byte - 代码随笔",
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
        .VPContent.has-sidebar {
          padding-left: calc(var(--vp-sidebar-width) + 32px) !important;
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
          { text: 'Promise vs Observable', link: '/posts/promise-vs-observable' },
          { text: '浏览器如何实现异步', link: '/posts/js-event-loop' },
          { text: 'ES5 JS 对象继承', link: '/posts/js-es5-inheritance' },
          { text: 'Java Stream 实战指南', link: '/posts/java-stream-guide' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
