---
title: "CSS Flexbox: Properties & Practical Layouts"
date: 2026-07-10
description: Flexbox is the cornerstone of modern CSS layout. Master justify-content, align-items, and flex to solve 90% of layout challenges.
---

# CSS Flexbox: Properties & Practical Layouts

Flexbox is the cornerstone of modern CSS layout. Mastering a few core properties solves 90% of layout challenges.

## 1. Core Concepts

```
┌─────────── flex container ───────────┐
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │item1│ │item2│ │item3│ │item4│   │  ← main axis (default: horizontal →)
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                       │
│  cross axis (default: vertical ↓)     │
└───────────────────────────────────────┘
```

## 2. Container Properties (Applied to Parent)

```css
.container {
    display: flex;
}
```

| Property | Values | Effect |
|----------|--------|--------|
| `justify-content` | `flex-start` `center` `flex-end` `space-between` `space-around` `space-evenly` | Main axis alignment |
| `align-items` | `stretch` `center` `flex-start` `flex-end` `baseline` | Cross axis alignment (single line) |
| `flex-direction` | `row` `column` `row-reverse` `column-reverse` | Main axis direction |
| `flex-wrap` | `nowrap` `wrap` `wrap-reverse` | Whether to wrap |
| `align-content` | `center` `space-between` etc. | Cross axis alignment for multi-line |
| `gap` | `10px` `20px 10px` | Spacing between items |

## 3. Item Properties

| Property | Effect |
|----------|--------|
| `flex: 1` | Fill remaining space (shorthand for `flex-grow: 1; flex-shrink: 1; flex-basis: 0`) |
| `flex: none` | Don't grow or shrink, keep original size |
| `align-self` | Override cross-axis alignment for a single item |
| `order` | Sort order (smaller first, default 0) |

## 4. Common Layout Patterns

### 4.1 Horizontal & Vertical Centering

```css
.container {
    display: flex;
    justify-content: center;  /* main axis center */
    align-items: center;      /* cross axis center */
}
```

### 4.2 Space-Between (Navbar)

```css
.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

```html
<div class="navbar">
    <div class="logo">Logo</div>
    <div class="links">
        <a>Home</a>
        <a>About</a>
        <a>Contact</a>
    </div>
</div>
```

### 4.3 Equal-Width Columns (Classic 3-Column)

```css
.row {
    display: flex;
}
.col {
    flex: 1; /* each column gets equal share */
}
```

```html
<div class="row">
    <div class="col">Column 1</div>
    <div class="col">Column 2</div>
    <div class="col">Column 3</div>
</div>
```

### 4.4 Fixed Sidebar + Fluid Content

```css
.layout {
    display: flex;
}
.sidebar {
    width: 250px;
    flex-shrink: 0;  /* prevent shrinking */
}
.content {
    flex: 1;  /* fill remaining space */
}
```

### 4.5 Sticky Footer

```css
.page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}
.page .content {
    flex: 1;  /* content expands to push footer down */
}
```

```html
<div class="page">
    <header>Header</header>
    <div class="content">Main Content</div>
    <footer>Footer (always at bottom)</footer>
</div>
```

### 4.6 Auto-Wrapping Card Grid

```css
.grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}
.card {
    width: calc(33.33% - 20px);  /* 3 columns */
    min-width: 280px;             /* wrap if too narrow */
    flex: 1;                      /* stretch evenly */
}
```

### 4.7 Form Row (Label + Input Alignment)

```css
.form-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}
.form-row label {
    width: 100px;
    flex-shrink: 0;
    text-align: right;
}
.form-row input {
    flex: 1;
}
```

### 4.8 Centered Card

```css
body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
}
.card {
    width: 400px;
    padding: 24px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,.1);
}
```

### 4.9 Responsive: Stack Vertically on Small Screens

```css
.row {
    display: flex;
    gap: 16px;
}
@media (max-width: 768px) {
    .row {
        flex-direction: column;  /* stack vertically */
    }
}
```

## 5. 💡 Quick Memory Aid

```css
/* Container trio */
display: flex;
justify-content: center;        /* horizontal */
align-items: center;            /* vertical */
flex-wrap: wrap;                /* wrap */
gap: 16px;                      /* spacing */

/* Item trio */
flex: 1;        /* fill remaining space */
flex-shrink: 0; /* prevent shrinking */
align-self: center; /* individual alignment */
```

**One-line summary**: Flex is about arranging in **one direction** — distribute along the main axis, align along the cross axis. Remember `justify-content` (main axis) and `align-items` (cross axis) and you're set.
