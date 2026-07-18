// Blog post registry — add new posts at the top.
// Each entry needs: slug (filename without .md), title, description.
export interface PostEntry {
  slug: string
  title: string
  description: string
  category: string
}

export const posts: PostEntry[] = [
  {
    slug: 'db-index-optimization',
    title: 'Relational Database Index Design & Optimization',
    description:
      'Master B+Tree index internals, composite index leftmost prefix rule, covering indexes, index failure scenarios, and EXPLAIN-driven optimization.',
    category: 'Redis & Backend',
  },
  {
    slug: 'java-threadpool',
    title: 'Java Multithreading & Thread Pool Configuration',
    description:
      'Master Java multithreading fundamentals, ThreadPoolExecutor parameters, and practical guidelines for sizing thread pools in CPU-intensive vs IO-intensive scenarios.',
    category: 'Java & JVM',
  },
  {
    slug: 'spring-design-patterns',
    title: 'Spring Boot Design Patterns',
    description:
      'The design patterns that power Spring Boot — IoC, Proxy, Template, Strategy, Observer, Chain of Responsibility, and more, with real source code references.',
    category: 'Java & JVM',
  },
  {
    slug: 'python-inheritance',
    title: 'Python Inheritance',
    description:
      'Master single, multiple, and multilevel inheritance in Python — MRO, super(), ABC, composition vs inheritance, and common pitfalls.',
    category: 'Python',
  },
  {
    slug: 'js-closure',
    title: 'JavaScript Closures',
    description:
      'What is a closure, how does it work, and why is it everywhere in JavaScript?',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'useeffect-closure-trap',
    title: 'useEffect Async Closure Trap — Why It Happens & How to Fix',
    description:
      'Why does useEffect always see stale state? Deep dive into the stale closure problem and learn solutions with useRef, functional updates, proper dependencies, and more.',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'python-data-types',
    title: 'A Practical Guide to Python Data Types',
    description:
      'Learn the core Python built-in data types, mutability, type conversion, and when to use each one in real projects.',
    category: 'Python',
  },
  {
    slug: 'jvm-optimization-guide',
    title: 'JVM Optimization Practical Guide',
    description:
      'From heap sizing to GC tuning — master JVM optimization with practical parameters, GC selection, and real-world troubleshooting scenarios.',
    category: 'Java & JVM',
  },
  {
    slug: 'redis-types-expiry',
    title: 'Redis Data Types & Expiry Strategies',
    description:
      'Redis is more than a key-value cache. Covers 5 basic types + 4 special types (Bitmap, HyperLogLog, Geo, Stream), along with lazy deletion, periodic deletion, and 8 memory eviction policies.',
    category: 'Redis & Backend',
  },
  {
    slug: 'css-flex-guide',
    title: 'CSS Flexbox: Properties & Practical Layouts',
    description:
      'Flexbox is the cornerstone of modern CSS layout. Master justify-content, align-items, and flex to solve 90% of layout challenges.',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'memory-leak-vs-oom',
    title: 'Memory Leak vs OOM — Common Interview Question',
    description:
      'Memory leak is the disease, OOM is death. Learn 7 classic Java leak scenarios, investigation steps with jstat/jmap/MAT, and JVM tuning strategies.',
    category: 'Java & JVM',
  },
  {
    slug: 'promise-vs-observable',
    title: 'Promise vs Observable — Deep Dive Comparison',
    description:
      'Eager vs Lazy, single value vs stream, uncancelable vs cancelable — understand the fundamental differences between Promise and Observable.',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'js-event-loop',
    title: 'How Browsers Achieve Asynchrony — Event Loop Explained',
    description:
      'JavaScript is single-threaded, but async is everywhere. Deep dive into Call Stack, Task Queue, Microtask Queue, and the Event Loop.',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'js-es5-inheritance',
    title: 'ES5 JavaScript Object Inheritance',
    description:
      'Understand prototype chains, constructor borrowing, and Object.create — master ES5 inheritance before reaching for ES6 class sugar.',
    category: 'JavaScript & Frontend',
  },
  {
    slug: 'java-stream-guide',
    title: 'Java Stream Practical Guide',
    description:
      'map, filter, sorted, collect — master Java 8 Stream API with practical examples covering sorting, grouping, Top N, and common pitfalls.',
    category: 'Java & JVM',
  },
]
