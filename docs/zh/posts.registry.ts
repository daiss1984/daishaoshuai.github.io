// 中文博客文章列表 — 新文章加在最上面
export interface PostEntry {
  slug: string
  title: string
  description: string
  category: string
}

export const posts: PostEntry[] = [
  {
    slug: 'python-inheritance',
    title: 'Python 继承',
    description:
      '掌握 Python 的单继承、多继承与多层继承 —— MRO、super()、ABC、组合 vs 继承，以及常见陷阱。',
    category: 'Python',
  },
  {
    slug: 'js-closure',
    title: 'JavaScript 闭包',
    description:
      '什么是闭包，它是如何工作的，为什么在 JavaScript 中无处不在？',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'useeffect-closure-trap',
    title: 'useEffect 异步闭包陷阱 —— 原因分析与解决方案',
    description:
      '为什么 useEffect 里拿到的总是旧值？深入分析 stale closure 的产生原理，以及 useRef、函数式更新、正确依赖等多种解决手段。',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'python-data-types',
    title: 'Python 数据类型全面指南',
    description:
      '从数字、字符串到列表、字典和集合，掌握 Python 的核心数据类型与常见使用场景。',
    category: 'Python',
  },
  {
    slug: 'jvm-optimization-guide',
    title: 'JVM 调优实战指南',
    description:
      '从堆内存配置到 GC 选型 —— 掌握 JVM 调优核心参数、垃圾收集器选择与生产环境实战排查场景。',
    category: 'Java & JVM',
  },
  {
    slug: 'redis-types-expiry',
    title: 'Redis 数据类型与过期策略',
    description:
      'Redis 不只是 key-value 缓存。涵盖 5 种基本类型 + 4 种特殊类型（Bitmap、HyperLogLog、Geo、Stream），配合惰性删除、定期删除与 8 种内存淘汰策略，面试必问全搞定。',
    category: 'Redis & Backend',
  },
  {
    slug: 'css-flex-guide',
    title: 'CSS Flex 常用属性与实战布局',
    description:
      'Flexbox 是现代 CSS 布局的基石。掌握 justify-content、align-items 和 flex 三大核心，解决 90% 布局难题。',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'memory-leak-vs-oom',
    title: '内存泄漏 vs 内存溢出 —— 面试常考题',
    description:
      '内存泄漏是"病"，OOM 是"死"。详解 7 种经典 Java 泄漏场景、jstat/jmap/MAT 排查步骤与 JVM 调优策略。',
    category: 'Java & JVM',
  },
  {
    slug: 'promise-vs-observable',
    title: 'Promise vs Observable —— 面试常考题深度对比',
    description:
      'Eager vs Lazy、单值 vs 流、不可取消 vs 可取消 —— 从面试角度彻底搞懂 Promise 和 Observable 的本质区别。',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'js-event-loop',
    title: '浏览器如何实现异步 —— Event Loop 深入解读',
    description:
      'JavaScript 是单线程的，但异步无处不在。深入理解调用栈、任务队列、微任务队列与 Event Loop 的协作机制。',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'js-es5-inheritance',
    title: 'ES5 JavaScript 对象继承',
    description:
      '理解原型链、构造函数借用与 Object.create —— 在掌握 ES6 class 语法糖之前，先吃透 ES5 的原型继承。',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'java-stream-guide',
    title: 'Java Stream 实战指南',
    description:
      'map、filter、sorted、collect —— 从入门到进阶，掌握 Java 8 Stream API，涵盖排序、分组、Top N 与常见踩坑。',
    category: 'Java & JVM',
  },
]
