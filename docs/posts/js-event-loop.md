---
title: 浏览器如何实现异步 —— Event Loop 深入解读
---

# 浏览器如何实现异步 —— Event Loop 深入解读

JavaScript 是单线程语言，但浏览器可以同时处理网络请求、定时器、用户交互。这一切靠的是 **Event Loop（事件循环）**。本文从原理到面试，讲透浏览器端的异步模型。

## 1. 为什么 JS 需要异步？

JS 设计之初就是为浏览器而生：操作 DOM、响应用户点击。如果 JS 是多线程的，两个线程同时改同一个 DOM，谁说了算？所以 JS 被设计成**单线程**——同一时间只能做一件事。

但单线程有个致命问题：

```javascript
// 如果网络请求是同步的...
const data = fetchSync('https://api.example.com/big-data'); // 卡住 3 秒
console.log('这行要等 3 秒后才能执行'); // 页面完全冻结
```

所以浏览器把耗时操作（网络、定时器、I/O）交给**浏览器内核的其他线程**处理，JS 主线程继续执行。等异步操作完成，再通过**回调**通知 JS。

## 2. 四大核心组件

浏览器异步模型由四个部分协作完成：

```
┌─────────────────────────────────────────────────┐
│                   JS 引擎 (单线程)               │
│  ┌───────────────────────────────────────────┐  │
│  │         Call Stack (调用栈)                │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐              │  │
│  │  │ fn3 │  │     │  │     │              │  │
│  │  │ fn2 │  │ fn2 │  │     │              │  │
│  │  │ fn1 │  │ fn1 │  │ fn1 │  ...pop...   │  │
│  │  └─────┘  └─────┘  └─────┘              │  │
│  └───────────────────────────────────────────┘  │
│                    ▲  │                         │
│                    │  │ 调用                    │
│                    │  ▼                         │
│              ┌─────────────┐                    │
│              │  Event Loop │ ◄── 不停的检查     │
│              └─────────────┘                    │
│                    ▲                            │
└────────────────────│────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│ Web APIs│   │Microtask │   │  Task    │
│         │   │  Queue   │   │  Queue   │
│setTimeout│   │.then/catch│  │setTimeout│
│  fetch  │   │  queue-  │   │  I/O     │
│   DOM   │   │Microtask │   │  events  │
│ events  │   └──────────┘   └──────────┘
└─────────┘
```

| 组件 | 职责 |
|------|------|
| **Call Stack** | 同步代码执行的地方，LIFO |
| **Web APIs** | 浏览器提供的异步能力（`setTimeout`、`fetch`、DOM 事件等），在浏览器内核线程中执行 |
| **Task Queue** | 宏任务队列，存放 `setTimeout` 回调、I/O 回调、UI 事件回调 |
| **Microtask Queue** | 微任务队列，存放 `Promise.then`、`MutationObserver`、`queueMicrotask` |
| **Event Loop** | 调度器，不断检查 Call Stack 是否为空，为空就把队列中的回调推入栈中执行 |

## 3. Event Loop 的执行流程

```javascript
console.log('1');

setTimeout(() => {
    console.log('2');
}, 0);

Promise.resolve().then(() => {
    console.log('3');
});

console.log('4');

// 输出: 1 4 3 2
```

执行过程：

```
1. console.log('1') → 入栈执行 → 出栈
2. setTimeout → 交给 Web APIs 计时（0ms 后回调进入 Task Queue）
3. Promise.resolve().then → then 回调进入 Microtask Queue
4. console.log('4') → 入栈执行 → 出栈
5. 栈空了 → Event Loop 先清空 Microtask Queue → 执行 .then → 输出 3
6. 微任务队列空了 → Event Loop 从 Task Queue 取出 setTimeout 回调 → 输出 2
```

**核心规则**：

> **一个 Task → 清空所有 Microtask → 可能渲染 → 下一个 Task**

具体步骤（基于 HTML 规范）：

1. 从 Task Queue 取出一个 Task（宏任务）执行
2. 该 Task 执行完毕后，**清空 Microtask Queue**（微任务执行过程中新产生的微任务也会被一并清空）
3. 需要渲染时执行 `requestAnimationFrame` → 样式计算 → 布局 → 绘制
4. 回到第 1 步

## 4. 宏任务 vs 微任务

| | 宏任务 (Task) | 微任务 (Microtask) |
|------|------|------|
| **来源** | `setTimeout`、`setInterval`、I/O、UI 事件、`setImmediate`(Node) | `Promise.then/catch/finally`、`MutationObserver`、`queueMicrotask`、`process.nextTick`(Node) |
| **执行时机** | 每轮 Event Loop 取一个执行 | 每个宏任务执行后立即清空全部 |
| **优先级** | 低 | 高 |
| **渲染时机** | 宏任务之间可能渲染 | 微任务执行期间不会渲染 |

```javascript
setTimeout(() => {
    console.log('宏任务1');
    Promise.resolve().then(() => console.log('微任务1'));
}, 0);

setTimeout(() => {
    console.log('宏任务2');
}, 0);

// 输出: 宏任务1 → 微任务1 → 宏任务2
// 每个宏任务后会立即清空微任务队列
```

### 微任务的"无限循环"陷阱

```javascript
function loop() {
    Promise.resolve().then(() => {
        console.log('微任务');
        loop(); // 又在微任务里添加微任务
    });
}
loop();

// 页面卡死！因为微任务队列永远不会空，Event Loop 永远不会进入下一轮
// 浏览器永远无法渲染，用户无法交互
```

## 5. requestAnimationFrame 与渲染时机

`requestAnimationFrame`（rAF）既不是宏任务也不是微任务，它在**渲染之前**执行：

```javascript
setTimeout(() => {
    console.log('setTimeout');
}, 0);

requestAnimationFrame(() => {
    console.log('rAF');
});

Promise.resolve().then(() => {
    console.log('Promise');
});

// 典型输出: Promise → rAF → setTimeout → rAF → setTimeout...
// rAF 在渲染前执行，与屏幕刷新率同步（通常 60fps ≈ 16.7ms 一次）
```

完整的大循环（窗口事件循环）：

```
Task → Microtasks → rAF → 样式计算 → 布局 → 绘制 → Task → ...
```

## 6. 浏览器端 vs 服务端 (Node.js) 异步对比

很多面试官会追问这一点。核心区别在于**谁来实现异步**：

| | 浏览器 | Node.js |
|------|------|------|
| **异步 I/O 实现** | 浏览器内核（Web APIs） | libuv 线程池 |
| **定时器实现** | 浏览器内核线程 | libuv 的 timer 阶段 |
| **事件循环阶段** | 简单：Task → Microtask → Render | 复杂：timers → pending → idle/prepare → poll → check → close |
| **微任务细分** | 都同等优先级 | `process.nextTick` 优先级高于 `Promise.then` |
| **渲染** | 有（rAF、样式、布局、绘制） | 无（服务端不需要渲染） |
| **宏任务** | `setTimeout`、I/O、事件 | `setTimeout`、`setImmediate`、I/O |
| **多线程** | Web Worker（独立 Agent） | Worker Threads 或 `child_process` |

### Node.js Event Loop 简图

```
   ┌───────────────────────┐
┌─>│        timers         │  setTimeout、setInterval
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │   pending callbacks   │  系统操作回调（如 TCP 错误）
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │     idle, prepare     │  内部使用
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │         poll          │  I/O 回调（主要停留阶段）
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │         check         │  setImmediate 回调
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │     close callbacks   │  socket.on('close', ...)
│  └──────────┬────────────┘
│             │
└─────────────┘
```

Node.js 关键点：

```javascript
// process.nextTick 优先级高于 Promise.then
Promise.resolve().then(() => console.log('Promise'));
process.nextTick(() => console.log('nextTick'));

// 输出: nextTick → Promise

// setTimeout vs setImmediate
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// 输出顺序不确定（取决于 event loop 启动时的阶段）
// 如果在 poll 阶段注册，setImmediate 立即在下个 check 阶段执行
// setTimeout 至少等 1ms，可能落到下一轮
```

## 7. 经典面试题解析

### 题目 1

```javascript
console.log('1');

setTimeout(function () {
    console.log('2');
    new Promise(function (resolve) {
        console.log('3');
        resolve();
    }).then(function () {
        console.log('4');
    });
}, 0);

new Promise(function (resolve) {
    console.log('5');
    resolve();
}).then(function () {
    console.log('6');
});

setTimeout(function () {
    console.log('7');
}, 0);

console.log('8');

// 输出: 1 5 8 6 2 3 4 7
```

**分析**：
1. `1` — 同步
2. `setTimeout-2` — 进入 Task Queue
3. `5` — `new Promise` 的 executor 立即执行
4. `.then-6` — 进入 Microtask Queue
5. `setTimeout-7` — 进入 Task Queue
6. `8` — 同步
7. 清空微任务 → `6`
8. 第一个宏任务 → `2`、`3`（`new Promise` executor 同步）、`.then-4`（微任务）
9. 清空微任务 → `4`
10. 下一个宏任务 → `7`

### 题目 2：async/await

```javascript
async function async1() {
    console.log('async1 start');
    await async2();
    console.log('async1 end');
}

async function async2() {
    console.log('async2');
}

console.log('script start');

setTimeout(function () {
    console.log('setTimeout');
}, 0);

async1();

new Promise(function (resolve) {
    console.log('promise1');
    resolve();
}).then(function () {
    console.log('promise2');
});

console.log('script end');

// 输出: script start → async1 start → async2 → promise1 → script end
//       → async1 end → promise2 → setTimeout
```

**关键理解**：`await` 后面的代码相当于 `.then()`，是微任务。

### 题目 3

```javascript
console.log('start');

setTimeout(() => console.log('timeout'), 0);

Promise.resolve()
    .then(() => {
        console.log('then1');
        Promise.resolve().then(() => console.log('then1-1'));
    })
    .then(() => {
        console.log('then2');
    });

console.log('end');

// 输出: start → end → then1 → then1-1 → then2 → timeout
```

**关键**：`then2` 要等 `then1` 执行完且 `then1` 返回的 Promise resolve 后才进入微任务队列。而 `then1-1` 在 `then1` 执行期间就被加入了，所以先于 `then2`。

> `.then` 的回调是在前一个 `.then` 返回的 Promise resolve 后才会被加入微任务队列。
> 如果前一个 `.then` 里没有 `return`，等价于 `return undefined`，也是 resolve 了的。

## 8. 💡 核心知识点总结

**三个队列，一个循环**：

```
┌──────────────────────────────────────────┐
│  1. 执行一个 Task（宏任务）               │
│  2. 清空所有 Microtask（微任务）          │
│  3. requestAnimationFrame（渲染前回调）    │
│  4. 样式计算 → 布局 → 绘制               │
│  5. 回到第 1 步                          │
└──────────────────────────────────────────┘
```

**面试要点**：

| 问题 | 答案 |
|------|------|
| JS 为什么是单线程的？ | 避免多线程操作 DOM 的复杂性和竞争问题 |
| 单线程如何处理异步？ | Event Loop + 浏览器内核多线程处理 I/O，回调回到 JS 线程 |
| 微任务 vs 宏任务？ | 宏任务每轮取一个，微任务一次清空全部 |
| 为什么 `setTimeout(fn, 0)` 不是立即执行？ | 它只是把 fn 放入 Task Queue，要等当前 Task + 所有 Microtask 完成后才执行 |
| `requestAnimationFrame` 是什么？ | 渲染前执行的回调，与屏幕刷新率同步，适合做动画 |
| 浏览器和 Node.js 的 Event Loop 区别？ | 浏览器有渲染阶段、微任务统一；Node.js 有 6 个阶段、`nextTick` 优先级高于 Promise |
| `process.nextTick` vs `Promise.then`？ | `nextTick` 在当前阶段结束后立即执行，Promise 在 microtask 队列 |

**一句话总结**：浏览器通过 Event Loop 将单线程 JS 和浏览器多线程能力桥接起来："你只管同步执行，异步的事我帮你排队"。理解 Task 和 Microtask 的执行顺序，就等于掌握了 JS 异步的核心。
