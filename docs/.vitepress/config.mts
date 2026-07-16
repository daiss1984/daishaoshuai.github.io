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
        --vp-sidebar-width: 300px;
        --vp-layout-max-width: 100%;
      }
      @media (min-width: 1440px) {
        .VPSidebar {
          padding-left: 32px !important;
          width: var(--vp-sidebar-width) !important;
        }
        .VPContent.has-sidebar {
          padding-left: calc(var(--vp-sidebar-width) + 32px) !important;
          padding-right: 32px !important;
        }
      }
      .VPDoc .vp-doc,
      .VPDoc.has-aside .content-container,
      .main {
        max-width: none !important;
        width: 100% !important;
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
          { text: 'Redis 数据类型与过期策略', link: '/posts/redis-types-expiry' },
          { text: 'CSS Flex 常用属性与布局', link: '/posts/css-flex-guide' },
          { text: '内存泄漏 vs 内存溢出', link: '/posts/memory-leak-vs-oom' },
          { text: 'Promise vs Observable', link: '/posts/promise-vs-observable' },
          { text: '浏览器如何实现异步', link: '/posts/js-event-loop' },
          { text: 'ES5 JS 对象继承', link: '/posts/js-es5-inheritance' },
          { text: 'Java Stream 实战指南', link: '/posts/java-stream-guide' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/daiss1984/daiss1984.github.io' }
    ]
  }
})
