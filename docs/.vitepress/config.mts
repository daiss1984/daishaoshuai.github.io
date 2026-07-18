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
              {
                text: 'Python',
                collapsed: false,
                items: [
                  { text: 'Python Inheritance', link: '/posts/python-inheritance' },
                  { text: 'Python Data Types Guide', link: '/posts/python-data-types' },
                ]
              },
              {
                text: 'Java & JVM',
                collapsed: false,
                items: [
                  { text: 'Java Multithreading & Thread Pool', link: '/posts/java-threadpool' },
                  { text: 'Spring Boot Design Patterns', link: '/posts/spring-design-patterns' },
                  { text: 'JVM Optimization Guide', link: '/posts/jvm-optimization-guide' },
                  { text: 'Memory Leak vs OOM', link: '/posts/memory-leak-vs-oom' },
                  { text: 'Java Stream Practical Guide', link: '/posts/java-stream-guide' },
                ]
              },
              {
                text: 'JavaScript & Frontend',
                collapsed: false,
                items: [
                  { text: 'JavaScript Closures', link: '/posts/js-closure' },
                  { text: 'useEffect Closure Trap', link: '/posts/useeffect-closure-trap' },
                  { text: 'CSS Flexbox: Properties & Layouts', link: '/posts/css-flex-guide' },
                  { text: 'Promise vs Observable', link: '/posts/promise-vs-observable' },
                  { text: 'Browser Event Loop Explained', link: '/posts/js-event-loop' },
                  { text: 'ES5 JS Object Inheritance', link: '/posts/js-es5-inheritance' },
                ]
              },
              {
                text: 'Redis & Backend',
                collapsed: false,
                items: [
                  { text: 'DB Index Design & Optimization', link: '/posts/db-index-optimization' },
                  { text: 'Redis Data Types & Expiry', link: '/posts/redis-types-expiry' },
                ]
              },
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
              {
                text: 'Python',
                collapsed: false,
                items: [
                  { text: 'Python 继承', link: '/zh/posts/python-inheritance' },
                  { text: 'Python 数据类型全面指南', link: '/zh/posts/python-data-types' },
                ]
              },
              {
                text: 'Java & JVM',
                collapsed: false,
                items: [
                  { text: 'Java 多线程与线程池配置', link: '/zh/posts/java-threadpool' },
                  { text: 'Spring Boot 设计模式', link: '/zh/posts/spring-design-patterns' },
                  { text: 'JVM 调优实战指南', link: '/zh/posts/jvm-optimization-guide' },
                  { text: '内存泄漏 vs 内存溢出', link: '/zh/posts/memory-leak-vs-oom' },
                  { text: 'Java Stream 实战指南', link: '/zh/posts/java-stream-guide' },
                ]
              },
              {
                text: 'JavaScript & Frontend',
                collapsed: false,
                items: [
                  { text: 'JavaScript 闭包', link: '/zh/posts/js-closure' },
                  { text: 'useEffect 异步闭包陷阱', link: '/zh/posts/useeffect-closure-trap' },
                  { text: 'CSS Flex 常用属性与布局', link: '/zh/posts/css-flex-guide' },
                  { text: 'Promise vs Observable', link: '/zh/posts/promise-vs-observable' },
                  { text: '浏览器如何实现异步', link: '/zh/posts/js-event-loop' },
                  { text: 'ES5 JS 对象继承', link: '/zh/posts/js-es5-inheritance' },
                ]
              },
              {
                text: 'Redis & Backend',
                collapsed: false,
                items: [
                  { text: '数据库索引设计与优化', link: '/zh/posts/db-index-optimization' },
                  { text: 'Redis 数据类型与过期策略', link: '/zh/posts/redis-types-expiry' },
                ]
              },
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
