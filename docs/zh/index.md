---
sidebar: false
aside: false
---

<script setup lang="ts">
import { posts, type PostEntry } from './posts.registry.ts'

const latest: PostEntry = posts[0]
const rest: PostEntry[] = posts.slice(1)
</script>

# Repetition unlocks deeper understanding

## 📝 最新文章

### <a :href="'/zh/posts/' + latest.slug">{{ latest.title }}</a>

{{ latest.description }}

---

## 更多文章

<ul>
  <li v-for="post of rest" :key="post.slug">
    <a :href="'/zh/posts/' + post.slug">{{ post.title }}</a>
  </li>
</ul>

