---
sidebar: false
aside: false
---

<script setup lang="ts">
import { posts, type PostEntry } from './posts.registry.ts'

const latest: PostEntry = posts[0]
const rest: PostEntry[] = posts.slice(1)

// Group posts by category (preserve insertion order)
const categories: { name: string; posts: PostEntry[] }[] = []
const seen = new Set<string>()
for (const p of posts) {
  if (!seen.has(p.category)) {
    seen.add(p.category)
    categories.push({ name: p.category, posts: [] })
  }
}
for (const cat of categories) {
  cat.posts = posts.filter(p => p.category === cat.name)
}
</script>

# Repetition unlocks deeper understanding

## 📝 Latest Article

### <a :href="'/posts/' + latest.slug">{{ latest.title }}</a>

{{ latest.description }}

---

## More Articles

<div v-for="cat of categories" :key="cat.name">
  <h3>{{ cat.name }}</h3>
  <ul>
    <li v-for="post of cat.posts" :key="post.slug">
      <a :href="'/posts/' + post.slug">{{ post.title }}</a>
    </li>
  </ul>
</div>

