---
title: CSS Flex 常用属性与实战布局
---

# CSS Flex 常用属性与实战布局

Flexbox 是现代 CSS 布局的基石。记住几个核心属性能解决 90% 的布局问题。

## 1. 核心概念

```
┌─────────── flex container ───────────┐
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │item1│ │item2│ │item3│ │item4│   │  ← main axis（主轴，默认水平 →）
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                       │
│  cross axis（交叉轴，默认垂直 ↓）       │
└───────────────────────────────────────┘
```

## 2. 容器属性（加在父元素上）

```css
.container {
    display: flex;
}
```

| 属性 | 取值 | 作用 |
|------|------|------|
| `justify-content` | `flex-start` `center` `flex-end` `space-between` `space-around` `space-evenly` | 主轴对齐 |
| `align-items` | `stretch` `center` `flex-start` `flex-end` `baseline` | 交叉轴对齐（单行） |
| `flex-direction` | `row` `column` `row-reverse` `column-reverse` | 主轴方向 |
| `flex-wrap` | `nowrap` `wrap` `wrap-reverse` | 是否换行 |
| `align-content` | `center` `space-between` 等 | 多行时交叉轴对齐 |
| `gap` | `10px` `20px 10px` | 子元素间距 |

## 3. 子元素属性

| 属性 | 作用 |
|------|------|
| `flex: 1` | 占满剩余空间（`flex-grow: 1; flex-shrink: 1; flex-basis: 0` 的简写） |
| `flex: none` | 不伸缩，保持原始大小 |
| `align-self` | 单独控制某个子元素的交叉轴对齐 |
| `order` | 排序（数字越小越靠前，默认 0） |

## 4. 常用布局例子

### 4.1 水平居中

```css
.container {
    display: flex;
    justify-content: center;  /* 主轴居中 */
    align-items: center;      /* 交叉轴居中 */
}
```

### 4.2 两端对齐（导航栏）

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

### 4.3 等分列（经典三栏）

```css
.row {
    display: flex;
}
.col {
    flex: 1; /* 每列等分剩余空间 */
}
```

```html
<div class="row">
    <div class="col">列 1</div>
    <div class="col">列 2</div>
    <div class="col">列 3</div>
</div>
```

### 4.4 左侧固定 + 右侧自适应

```css
.layout {
    display: flex;
}
.sidebar {
    width: 250px;
    flex-shrink: 0;  /* 不被压缩 */
}
.content {
    flex: 1;  /* 占满剩余 */
}
```

### 4.5 垂直居中 + 粘性页脚

```css
.page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}
.page .content {
    flex: 1;  /* 内容区撑满，把 footer 推到底部 */
}
```

```html
<div class="page">
    <header>Header</header>
    <div class="content">主体内容</div>
    <footer>Footer（永远在底部）</footer>
</div>
```

### 4.6 自动换行卡片网格

```css
.grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}
.card {
    width: calc(33.33% - 20px);  /* 三列 */
    min-width: 280px;             /* 太小就换行 */
    flex: 1;                      /* 均匀拉伸 */
}
```

### 4.7 表单行（label + input 对齐）

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

### 4.8 居中的一个卡片

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

### 4.9 响应式：小屏变竖向

```css
.row {
    display: flex;
    gap: 16px;
}
@media (max-width: 768px) {
    .row {
        flex-direction: column;  /* 小屏幕变竖排 */
    }
}
```

## 5. 💡 快速记忆

```css
/* 容器三板斧 */
display: flex;
justify-content: center;        /* 水平 */
align-items: center;            /* 垂直 */
flex-wrap: wrap;                /* 换行 */
gap: 16px;                      /* 间距 */

/* 子元素三句话 */
flex: 1;        /* 占满剩余空间 */
flex-shrink: 0; /* 不被压缩 */
align-self: center; /* 单独对齐 */
```

**一句话总结**：Flex 就是**一个方向上的排列**——主轴排开，交叉轴对齐。记牢 `justify-content`（主轴）和 `align-items`（交叉轴）就够了。
