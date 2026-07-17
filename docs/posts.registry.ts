// Blog post registry — add new posts at the top.
// Each entry needs: slug (filename without .md), title, description.
export interface PostEntry {
  slug: string
  title: string
  description: string
}

export const posts: PostEntry[] = [
  {
    slug: 'jvm-optimization-guide',
    title: 'JVM Optimization Practical Guide',
    description:
      'From heap sizing to GC tuning — master JVM optimization with practical parameters, GC selection, and real-world troubleshooting scenarios.',
  },
  {
    slug: 'redis-types-expiry',
    title: 'Redis Data Types & Expiry Strategies',
    description:
      'Redis is more than a key-value cache. Covers 5 basic types + 4 special types (Bitmap, HyperLogLog, Geo, Stream), along with lazy deletion, periodic deletion, and 8 memory eviction policies.',
  },
  {
    slug: 'css-flex-guide',
    title: 'CSS Flexbox: Properties & Practical Layouts',
    description:
      'Flexbox is the cornerstone of modern CSS layout. Master justify-content, align-items, and flex to solve 90% of layout challenges.',
  },
  {
    slug: 'memory-leak-vs-oom',
    title: 'Memory Leak vs OOM — Common Interview Question',
    description:
      'Memory leak is the disease, OOM is death. Learn 7 classic Java leak scenarios, investigation steps with jstat/jmap/MAT, and JVM tuning strategies.',
  },
  {
    slug: 'promise-vs-observable',
    title: 'Promise vs Observable — Deep Dive Comparison',
    description:
      'Eager vs Lazy, single value vs stream, uncancelable vs cancelable — understand the fundamental differences between Promise and Observable.',
  },
  {
    slug: 'js-event-loop',
    title: 'How Browsers Achieve Asynchrony — Event Loop Explained',
    description:
      'JavaScript is single-threaded, but async is everywhere. Deep dive into Call Stack, Task Queue, Microtask Queue, and the Event Loop.',
  },
  {
    slug: 'js-es5-inheritance',
    title: 'ES5 JavaScript Object Inheritance',
    description:
      'Understand prototype chains, constructor borrowing, and Object.create — master ES5 inheritance before reaching for ES6 class sugar.',
  },
  {
    slug: 'java-stream-guide',
    title: 'Java Stream Practical Guide',
    description:
      'map, filter, sorted, collect — master Java 8 Stream API with practical examples covering sorting, grouping, Top N, and common pitfalls.',
  },
]
