---
title: useEffect 异步闭包陷阱 —— 原因分析与解决方案
date: 2026-07-17
description: 为什么 useEffect 里拿到的总是旧值？深入分析 Stale Closure（陈旧闭包）的产生原理，以及函数式更新、useRef、正确依赖等多种解决方案。
---

# useEffect 异步闭包陷阱 —— 原因分析与解决方案

`useEffect` 里拿到的 state 总是旧的，这是 React 开发中最常见的问题之一。很多人把它称为"异步闭包陷阱"，但更准确的名字其实是 **Stale Closure（陈旧闭包）**。

需要注意的是，这并不是 `async/await` 独有的问题，而是**任何延迟执行的回调**都可能遇到，包括：

- `setTimeout`
- `setInterval`
- `Promise.then`
- `async/await`
- `requestAnimationFrame`
- `addEventListener`
- `WebSocket`

它们共同的特点都是：**回调执行时，组件可能已经经历了多次重新渲染。**

本文将彻底讲清楚它产生的原因以及几种常见的解决方案。

---

# 1. 问题现场

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);       // 永远打印 0
      setCount(count + 1);      // 永远是 0 + 1 = 1
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

运行结果：

```
0
0
0
0
...
```

页面上的 `count`：

```
0
↓
1
↓
1
↓
1
...
```

第一次更新以后就不会继续增长。

---

# 2. 为什么会这样？

理解这个问题需要三个知识点。

---

## 2.1 React 每次渲染都是独立的

React 组件本质上就是一个函数。

每次 state 更新，React 都会重新执行整个组件函数。

例如：

```text
第一次 render
count = 0

↓

第二次 render
count = 1

↓

第三次 render
count = 2
```

**每一次 render 都拥有自己独立的：**

- state
- props
- event handler
- effect
- callback

React 不会修改已经创建好的闭包，而是创建一套全新的变量和函数。

---

## 2.2 闭包绑定的是某一次渲染的作用域

JavaScript 闭包会引用**创建它时所在的词法作用域（Lexical Environment）**。

在 React 中，每次组件重新渲染都会重新执行组件函数，因此每次渲染都会产生一套新的 `count`、`props`、事件处理函数和 `effect`。

例如：

```text
第一次 render
count = 0

↓

创建 setInterval 回调

↓

回调引用第一次 render 的 count
```

随后：

```text
第二次 render
count = 1
```

React 已经产生了新的 `count`。

但是：

```text
setInterval
```

里面那个 callback 并不会自动切换到新的 render。

因为：

```text
useEffect(..., [])
```

只执行了一次。

所以 callback 一直引用的是：

```text
第一次 render
```

对应的作用域。

这就是 **Stale Closure（陈旧闭包）**。

---

## 2.3 用图理解

```text
Render #1
count = 0

↓

effect 创建

↓

callback 引用了 count=0

↓

Render #2
count = 1

↓

effect 没有重新执行

↓

callback 仍然引用 count=0

↓

Render #3
count = 2

↓

callback 仍然引用 count=0

↓

永远输出 0
```

> **核心认知：每一次 React 渲染都会生成一套新的状态和作用域，`useEffect` 中创建的回调只会引用创建它时对应的那次渲染，因此当回调延迟执行时，读取到的可能已经是"过期"的状态，这就是 Stale Closure。**

---

# 3. 解决方案

---

## 方案一：函数式更新（最推荐）

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(prev => prev + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

为什么有效？

因为：

```jsx
setCount(prev => prev + 1);
```

React 会把**当前最新 state** 作为 `prev` 传进来。

它完全不依赖闭包里的旧值。

这是官方最推荐的方式。

适用于：

- setInterval
- setTimeout
- Promise
- async
- 所有需要基于旧值计算新值的场景

---

## 方案二：正确填写依赖数组

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);
    setCount(count + 1);
  }, 1000);

  return () => clearInterval(timer);
}, [count]);
```

这样：

每次 `count` 改变：

```text
旧 effect

↓

cleanup

↓

新 effect

↓

新的 callback
```

因此 callback 始终引用最新的 count。

### 缺点

每次更新都会：

- clearInterval
- setInterval

频繁创建和销毁 effect。

---

## 方案三：useRef 保存最新值

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  const countRef = useRef(count);

  countRef.current = count;

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current);

      setCount(countRef.current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

为什么有效？

因为：

```jsx
const ref = useRef();
```

React 返回的是**同一个对象引用**。

不会因为重新渲染而重新创建。

变化的是：

```jsx
ref.current
```

而不是：

```jsx
ref
```

因此：

```text
闭包

↓

一直引用同一个 ref

↓

读取 ref.current

↓

永远都是最新值
```

适用于：

- WebSocket
- EventListener
- 长生命周期定时器
- 长连接
- 需要稳定 effect 的场景

---

## 方案四：useReducer（复杂状态）

```jsx
function reducer(state, action) {
  switch (action.type) {
    case "increment":
      return {
        count: state.count + 1
      };

    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, {
    count: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({
        type: "increment"
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>{state.count}</div>;
}
```

为什么没有闭包问题？

React 保证：

```jsx
dispatch
```

引用始终稳定。

因此：

```text
dispatch(action)
```

总会基于 React 当前最新 state 计算。

适用于：

- 多状态管理
- 状态机
- Redux 风格逻辑

---

## 方案五：异步请求避免竞态（Race Condition）

很多人认为下面代码也是闭包问题：

```jsx
useEffect(() => {
  fetch(`/api/user/${userId}`)
    .then(res => res.json())
    .then(data => {
      setName(data.name);
    });
}, [userId]);
```

实际上，这里更大的问题通常是**竞态（Race Condition）**：

```text
请求 A

↓

请求 B

↓

B 先回来

↓

页面更新

↓

A 后回来

↓

旧数据覆盖新数据
```

解决方式：

```jsx
useEffect(() => {
  let cancelled = false;

  fetch(`/api/user/${userId}`)
    .then(res => res.json())
    .then(data => {
      if (!cancelled) {
        setName(data.name);
      }
    });

  return () => {
    cancelled = true;
  };
}, [userId]);
```

或者使用：

```jsx
AbortController
```

取消旧请求。

> 注意：cleanup 主要解决的是请求竞态（Race Condition），并不是直接解决 Stale Closure。

---

# 4. 方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| **函数式更新** | 基于旧值计算新值 | ⭐ 官方推荐、最简单 | 只能用于 state 更新 |
| **依赖数组** | 需要重新执行 effect | 直观 | effect 会频繁重建 |
| **useRef** | 读取最新值 | effect 保持稳定 | 需要手动维护 current |
| **useReducer** | 复杂状态 | dispatch 稳定 | 学习成本稍高 |
| **cleanup / AbortController** | 网络请求 | 避免竞态 | 解决的是竞态，不是闭包 |

---

# 5. 总结

`useEffect` 所谓的"异步闭包陷阱"，本质上其实就是 **Stale Closure（陈旧闭包）**。

原因可以归纳为一句话：

> **每一次 React 渲染都会生成一套新的状态和作用域，`useEffect` 中创建的回调只会引用创建它时对应的那次渲染，因此当回调延迟执行时，读取到的可能已经是"过期"的状态。**

面对不同场景，可以采用不同策略：

- **需要基于旧值更新 state** → 使用 **函数式更新**
- **需要读取最新值但不希望重建 effect** → 使用 **useRef**
- **需要在状态变化时重新执行副作用** → 正确填写 **依赖数组**
- **状态逻辑复杂** → 使用 **useReducer**
- **异步请求** → 使用 **cleanup 或 AbortController** 避免竞态

理解了 **React 渲染机制 + JavaScript 闭包**，就真正理解了 Stale Closure，也能更加从容地编写可靠的 `useEffect` 代码。
