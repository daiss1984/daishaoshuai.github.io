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

  // ===== 多语言配置 =====
  locales: {
    // 英文（默认语言，路径不带前缀）
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Daily Byte',
      description: 'Daily Byte - Code Notes',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
        ],
        sidebar: [
          {
            text: 'Articles',
            items: [
              { text: 'JVM Optimization Guide', link: '/posts/jvm-optimization-guide' },
              { text: 'Redis Data Types & Expiry', link: '/posts/redis-types-expiry' },
              { text: 'CSS Flexbox: Properties & Layouts', link: '/posts/css-flex-guide' },
              { text: 'Memory Leak vs OOM', link: '/posts/memory-leak-vs-oom' },
              { text: 'Promise vs Observable', link: '/posts/promise-vs-observable' },
              { text: 'Browser Event Loop Explained', link: '/posts/js-event-loop' },
              { text: 'ES5 JS Object Inheritance', link: '/posts/js-es5-inheritance' },
              { text: 'Java Stream Practical Guide', link: '/posts/java-stream-guide' },
            ]
          }
        ],
      }
    },

    // 简体中文
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Daily Byte',
      description: 'Daily Byte - 代码随笔',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
        ],
        sidebar: [
          {
            text: '文章列表',
            items: [
              { text: 'JVM 调优实战指南', link: '/zh/posts/jvm-optimization-guide' },
              { text: 'Redis 数据类型与过期策略', link: '/zh/posts/redis-types-expiry' },
              { text: 'CSS Flex 常用属性与布局', link: '/zh/posts/css-flex-guide' },
              { text: '内存泄漏 vs 内存溢出', link: '/zh/posts/memory-leak-vs-oom' },
              { text: 'Promise vs Observable', link: '/zh/posts/promise-vs-observable' },
              { text: '浏览器如何实现异步', link: '/zh/posts/js-event-loop' },
              { text: 'ES5 JS 对象继承', link: '/zh/posts/js-es5-inheritance' },
              { text: 'Java Stream 实战指南', link: '/zh/posts/java-stream-guide' },
            ]
          }
        ],
      }
    }
  },

  // 社交链接（所有语言共享）
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/daiss1984/daiss1984.github.io' }
    ]
  }
})
