---
title: How Browsers Achieve Asynchrony — Event Loop Explained
date: 2026-06-20
description: JavaScript is single-threaded, but async is everywhere. Deep dive into Call Stack, Task Queue, Microtask Queue, and the Event Loop that ties them together.
---

# How Browsers Achieve Asynchrony — Event Loop Explained

JavaScript is single-threaded, yet browsers simultaneously handle network requests, timers, and user interactions. This is all powered by the **Event Loop**. This article covers the browser async model from fundamentals to interview questions.

## 1. Why Does JS Need Async?

JS was designed for browsers: manipulating the DOM, responding to user clicks. If JS were multi-threaded and two threads modified the same DOM simultaneously, who wins? So JS was designed as **single-threaded** — only one thing at a time.

But single-threading has a fatal flaw:

```javascript
// If network requests were synchronous...
const data = fetchSync('https://api.example.com/big-data'); // blocks for 3 seconds
console.log('This line waits 3 seconds'); // page completely frozen
```

So the browser offloads time-consuming operations (network, timers, I/O) to **other threads in the browser kernel**, while the JS main thread continues. When async operations complete, they notify JS via **callbacks**.

## 2. Four Core Components

The browser async model is a collaboration of four parts:

```
┌─────────────────────────────────────────────────┐
│              JS Engine (Single Thread)           │
│  ┌───────────────────────────────────────────┐  │
│  │           Call Stack                       │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐              │  │
│  │  │ fn3 │  │     │  │     │              │  │
│  │  │ fn2 │  │ fn2 │  │     │              │  │
│  │  │ fn1 │  │ fn1 │  │ fn1 │  ...pop...   │  │
│  │  └─────┘  └─────┘  └─────┘              │  │
│  └───────────────────────────────────────────┘  │
│                    ▲  │                         │
│                    │  │ invoke                  │
│                    │  ▼                         │
│              ┌─────────────┐                    │
│              │  Event Loop │ ◄── constant check │
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
│setTimeout│  │.then/catch│  │setTimeout│
│  fetch  │   │  queue-  │   │  I/O     │
│   DOM   │   │Microtask │   │  events  │
│ events  │   └──────────┘   └──────────┘
└─────────┘
```

| Component | Responsibility |
|-----------|---------------|
| **Call Stack** | Where synchronous code executes, LIFO |
| **Web APIs** | Browser-provided async capabilities (`setTimeout`, `fetch`, DOM events, etc.), run in browser kernel threads |
| **Task Queue** | Macrotask queue: holds `setTimeout` callbacks, I/O callbacks, UI event callbacks |
| **Microtask Queue** | Microtask queue: holds `Promise.then`, `MutationObserver`, `queueMicrotask` |
| **Event Loop** | Scheduler: constantly checks if Call Stack is empty; if so, pushes queued callbacks onto the stack |

## 3. Event Loop Execution Flow

```javascript
console.log('1');

setTimeout(() => {
    console.log('2');
}, 0);

Promise.resolve().then(() => {
    console.log('3');
});

console.log('4');

// Output: 1 4 3 2
```

Execution process:

```
1. console.log('1') → push to stack → execute → pop
2. setTimeout → handed to Web APIs (0ms later callback enters Task Queue)
3. Promise.resolve().then → then callback enters Microtask Queue
4. console.log('4') → push to stack → execute → pop
5. Stack empty → Event Loop first drains Microtask Queue → executes .then → outputs 3
6. Microtask queue empty → Event Loop takes setTimeout callback from Task Queue → outputs 2
```

**Core rule**:

> **One Task → Drain all Microtasks → Possibly render → Next Task**

Specific steps (based on HTML spec):

1. Take one Task (macrotask) from Task Queue and execute
2. After that Task completes, **drain the Microtask Queue** (new microtasks spawned during execution are also drained)
3. When rendering is needed: `requestAnimationFrame` → style calculation → layout → paint
4. Back to step 1

## 4. Macrotasks vs Microtasks

| | Macrotask (Task) | Microtask |
|------|------|------|
| **Sources** | `setTimeout`, `setInterval`, I/O, UI events, `setImmediate`(Node) | `Promise.then/catch/finally`, `MutationObserver`, `queueMicrotask`, `process.nextTick`(Node) |
| **Execution timing** | One per Event Loop iteration | All drained immediately after each macrotask |
| **Priority** | Low | High |
| **Render timing** | May render between macrotasks | No rendering during microtask execution |

```javascript
setTimeout(() => {
    console.log('Macrotask 1');
    Promise.resolve().then(() => console.log('Microtask 1'));
}, 0);

setTimeout(() => {
    console.log('Macrotask 2');
}, 0);

// Output: Macrotask 1 → Microtask 1 → Macrotask 2
// After each macrotask, microtask queue is drained immediately
```

### The Microtask Infinite Loop Trap

```javascript
function loop() {
    Promise.resolve().then(() => {
        console.log('Microtask');
        loop(); // adds another microtask inside a microtask
    });
}
loop();

// Page freezes! Microtask queue never empties, Event Loop never reaches next iteration
// Browser can never render, user can't interact
```

## 5. requestAnimationFrame and Render Timing

`requestAnimationFrame` (rAF) is neither a macrotask nor a microtask — it executes **before rendering**:

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

// Typical output: Promise → rAF → setTimeout → rAF → setTimeout...
// rAF executes before rendering, synced to screen refresh rate (~60fps ≈ 16.7ms)
```

The full window event loop:

```
Task → Microtasks → rAF → Style → Layout → Paint → Task → ...
```

## 6. Browser vs Node.js Async Comparison

Many interviewers follow up on this. The core difference is **who implements the async**:

| | Browser | Node.js |
|------|------|------|
| **Async I/O impl** | Browser kernel (Web APIs) | libuv thread pool |
| **Timer impl** | Browser kernel threads | libuv timer phase |
| **Event loop phases** | Simple: Task → Microtask → Render | Complex: timers → pending → idle/prepare → poll → check → close |
| **Microtask sub-types** | All equal priority | `process.nextTick` higher priority than `Promise.then` |
| **Rendering** | Yes (rAF, styles, layout, paint) | No (server doesn't render) |
| **Macrotasks** | `setTimeout`, I/O, events | `setTimeout`, `setImmediate`, I/O |
| **Multi-threading** | Web Worker (separate agent) | Worker Threads or `child_process` |

### Node.js Event Loop Diagram

```
   ┌───────────────────────┐
┌─>│        timers         │  setTimeout, setInterval
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │   pending callbacks   │  system operation callbacks (e.g., TCP errors)
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │     idle, prepare     │  internal use
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │         poll          │  I/O callbacks (main停留阶段)
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │         check         │  setImmediate callbacks
│  └──────────┬────────────┘
│  ┌──────────┴────────────┐
│  │     close callbacks   │  socket.on('close', ...)
│  └──────────┬────────────┘
│             │
└─────────────┘
```

Node.js key points:

```javascript
// process.nextTick priority higher than Promise.then
Promise.resolve().then(() => console.log('Promise'));
process.nextTick(() => console.log('nextTick'));

// Output: nextTick → Promise

// setTimeout vs setImmediate
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// Output order is non-deterministic (depends on event loop phase at registration)
// If registered in poll phase, setImmediate fires in next check phase immediately
// setTimeout waits at least 1ms, may fall to next iteration
```

## 7. Classic Interview Questions

### Question 1

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

// Output: 1 5 8 6 2 3 4 7
```

**Analysis**:
1. `1` — sync
2. `setTimeout-2` — enters Task Queue
3. `5` — `new Promise` executor runs immediately
4. `.then-6` — enters Microtask Queue
5. `setTimeout-7` — enters Task Queue
6. `8` — sync
7. Drain microtasks → `6`
8. First macrotask → `2`, `3` (`new Promise` executor sync), `.then-4` (microtask)
9. Drain microtasks → `4`
10. Next macrotask → `7`

### Question 2: async/await

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

// Output: script start → async1 start → async2 → promise1 → script end
//       → async1 end → promise2 → setTimeout
```

**Key insight**: Code after `await` is equivalent to `.then()` — it's a microtask.

### Question 3

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

// Output: start → end → then1 → then1-1 → then2 → timeout
```

**Key**: `then2` only enters the microtask queue after `then1` completes and its returned Promise resolves. Meanwhile, `then1-1` was added during `then1`'s execution, so it runs before `then2`.

> `.then` callbacks are added to the microtask queue only after the previous `.then`'s returned Promise resolves.
> If the previous `.then` has no `return`, it's equivalent to `return undefined`, which is still a resolution.

## 8. 💡 Core Summary

**Three queues, one loop**:

```
┌──────────────────────────────────────────┐
│  1. Execute one Task (macrotask)          │
│  2. Drain all Microtasks                  │
│  3. requestAnimationFrame (pre-render)     │
│  4. Style → Layout → Paint                │
│  5. Back to step 1                        │
└──────────────────────────────────────────┘
```
