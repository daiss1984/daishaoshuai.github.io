---
title: useEffect 异步闭包陷阱 —— 原因分析与解决方案
date: 2026-07-17
description: 为什么 useEffect 里拿到的总是旧值？深入分析 stale closure 的产生原理，以及 useRef、函数式更新、正确依赖等多种解决手段。
---

# useEffect 异步闭包陷阱 —— 原因分析与解决方案

useEffect 里拿到的 state 总是旧的，这是 React 新手最常踩的坑之一。根本原因是 **JavaScript 闭包 + React 的渲染机制** 共同作用的结果。本文彻底讲清楚原理并给出解决方案。

## 1. 问题现场

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);       // 永远打印 0
      setCount(count + 1);      // 永远是 0 + 1 = 1
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖数组

  return <div>{count}</div>;
}
```

**现象**：页面上 count 从 0 变成 1 后就不再变化，控制台永远打印 `0`。

## 2. 为什么会这样？

理解这个问题需要三步：

### 2.1 每次渲染都是独立的

```jsx
// 第 1 次渲染
function Counter() {
  const count = 0;  // ← 这个 count 被闭包抓住了
  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // 永远引用的是 0
    }, 1000);
  }, []);
}

// 第 2 次渲染 —— 重新执行整个函数
function Counter() {
  const count = 1;  // ← 这是一个全新的变量
  // useEffect 因为依赖是 [] 不会重新执行，
  // 所以定时器里的闭包仍然引用第 1 次的 count = 0
}
```

### 2.2 闭包捕获的是变量引用

JavaScript 闭包在创建时捕获外层作用域的变量。如果依赖数组是 `[]`，effect 只在首次渲染执行，里面的闭包就永远绑定了首次渲染时的值。

### 2.3 用图理解

```
渲染 #1: count=0 → effect 执行 → 闭包捕获 count=0
渲染 #2: count=1 → effect 不执行 → 闭包仍是 count=0
渲染 #3: count=1 → effect 不执行 → 闭包仍是 count=0
   ↓
永远输出 0
```

> **核心认知**：React 中每个渲染都有自己的 props、state、函数、effect。它们不会跨渲染共享。

## 3. 解决方案

### 方案 1：函数式更新（最推荐）

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(prev => prev + 1);  // prev 始终是最新值
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

`setState` 接受回调函数时，React 会传入当前最新状态，**不依赖闭包**，彻底避开旧值问题。

### 方案 2：正确填写依赖数组

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);
    setCount(count + 1);
  }, 1000);
  return () => clearInterval(timer);
}, [count]); // 每次 count 变化，重新创建定时器
```

**缺点**：定时器频繁创建和销毁，且如果 count 变化很快会造成不必要的开销。

### 方案 3：useRef 保存最新值

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;  // 每次渲染更新 ref

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current);  // ← 始终拿到最新值
      setCount(countRef.current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

`useRef` 返回一个可变对象，`current` 属性可以在渲染之间保持同一个引用，不受闭包限制。

**适用场景**：需要稳定的 effect（只执行一次），但又需要读取最新值。

### 方案 4：useReducer（复杂状态）

当状态逻辑复杂时，`useReducer` 天然避免了闭包陷阱：

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: 'increment' });  // dispatch 稳定不变
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <div>{state.count}</div>;
}
```

`dispatch` 引用是稳定的（React 保证不变），所以不需要放进依赖数组，也不会有闭包陷阱。

### 方案 5：异步请求场景

闭包陷阱在异步请求中也很常见：

```jsx
// ❌ 错误：请求返回时也许已经不是当前页了
useEffect(() => {
  fetch(`/api/user/${userId}`)
    .then(res => res.json())
    .then(data => {
      setName(data.name);  // 如果 userId 已变化，这是错误的
    });
}, [userId]);
```

解决方式：使用 cleanup 或 AbortController：

```jsx
useEffect(() => {
  let cancelled = false;

  fetch(`/api/user/${userId}`)
    .then(res => res.json())
    .then(data => {
      if (!cancelled) setName(data.name);
    });

  return () => { cancelled = true; };
}, [userId]);
```

## 4. 方案对比总结

| 方案 | 适用场景 | 优缺点 |
|------|---------|--------|
| **函数式更新** `setCount(prev => prev+1)` | setInterval / 需要最新 state | ✅ 最简单 ✅ 不重建 effect |
| **正确依赖数组** `[count]` | state 变化不频繁时 | ✅ 直观 ❌ effect 频繁重建 |
| **useRef** | 不需要触发重渲染的值 | ✅ effect 稳定 ❌ 多写一行代码 |
| **useReducer** | 复杂状态逻辑 | ✅ dispatch 稳定 ✅ 逻辑集中 |
| **cleanup / flag** | 异步请求 | ✅ 避免竞态请求 ❌ 需手动处理 |

## 5. 总结

useEffect 闭包陷阱的本质是：**effect 捕获了某次渲染的快照，而不是始终持有最新值**。

解决思路很简单：
1. 如果只需要最新的 state 来计算新值 → 用**函数式更新**
2. 如果只需要读最新值但不想重建 effect → 用 **useRef**
3. 如果状态逻辑复杂 → 用 **useReducer**
4. 如果是异步请求 → 加 **cleanup** 防止竞态

掌握这四种手段，useEffect 闭包陷阱就不再是问题。
