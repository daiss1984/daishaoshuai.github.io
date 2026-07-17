---
title: useEffect Stale Closure — Why It Happens & How to Fix
date: 2026-07-17
description: Why does useEffect always see stale state? A deep dive into Stale Closure, with solutions including functional updaters, useRef, proper dependencies, and more.
---

# useEffect Stale Closure — Why It Happens & How to Fix

One of the most common React pitfalls: your `useEffect` callback keeps seeing old state. People often call it an "async closure trap," but the more precise name is **Stale Closure**.

Importantly, this isn't unique to `async/await`. **Any deferred callback** can suffer from it:

- `setTimeout`
- `setInterval`
- `Promise.then`
- `async/await`
- `requestAnimationFrame`
- `addEventListener`
- `WebSocket`

What they all share: **by the time the callback runs, the component may have already re-rendered multiple times.**

Let's break down exactly why this happens and how to fix it.

---

# 1. The Problem

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);       // Always prints 0
      setCount(count + 1);      // Always 0 + 1 = 1
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div>{count}</div>;
}
```

Console output:

```
0
0
0
0
...
```

Rendered `count`:

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

The count stops growing after the first update.

---

# 2. Why Does This Happen?

Three concepts explain it.

---

## 2.1 Each render is independent

A React component is just a function. Every time state changes, React re-executes the entire component function.

```text
1st render
count = 0

↓

2nd render
count = 1

↓

3rd render
count = 2
```

**Each render gets its own:**

- state
- props
- event handler
- effect
- callback

React doesn't mutate existing closures — it creates a brand new set of variables and functions.

---

## 2.2 Closures bind to a specific render's scope

JavaScript closures reference the **lexical environment where they were created**.

In React, each re-render re-runs the component function, producing a fresh `count`, new props, new handlers, and a new `effect`.

```text
1st render
count = 0

↓

setInterval callback created

↓

Callback references the 1st render's count
```

Then:

```text
2nd render
count = 1
```

React has produced a new `count`. But:

```text
setInterval
```

the callback inside it does **not** automatically switch to the new render.

Because:

```text
useEffect(..., [])
```

only ran once.

So the callback still points to:

```text
1st render
```

scope.

This is **Stale Closure**.

---

## 2.3 Visualizing the trap

```text
Render #1
count = 0

↓

effect created

↓

callback captures count=0

↓

Render #2
count = 1

↓

effect not re-run

↓

callback still sees count=0

↓

Render #3
count = 2

↓

callback still sees count=0

↓

Forever outputs 0
```

> **Key insight: Every React render produces a new set of state and scope. Callbacks created inside `useEffect` only reference the render they were created in, so when they execute later, the values they read may already be stale. That is Stale Closure.**

---

# 3. Solutions

---

## Solution 1: Functional Updater (Recommended)

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(prev => prev + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

Why does it work?

```jsx
setCount(prev => prev + 1);
```

React passes the **current latest state** as `prev`. It has zero dependency on the closure's captured value.

This is the officially recommended approach.

Works for:

- setInterval
- setTimeout
- Promise
- async
- Any scenario that needs to compute new state from old state

---

## Solution 2: Proper Dependency Array

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);
    setCount(count + 1);
  }, 1000);

  return () => clearInterval(timer);
}, [count]);
```

When `count` changes:

```text
old effect

↓

cleanup

↓

new effect

↓

new callback
```

The callback always references the latest count.

### Trade-off

Every update triggers:

- clearInterval
- setInterval

Effect is destroyed and recreated frequently.

---

## Solution 3: useRef for Latest Values

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

Why does it work?

```jsx
const ref = useRef();
```

React returns the **same object reference** across renders. It doesn't get recreated.

What changes:

```jsx
ref.current
```

Not:

```jsx
ref
```

So:

```text
closure

↓

always references the same ref object

↓

reads ref.current

↓

always the latest value
```

Works for:

- WebSocket
- EventListener
- Long-lived timers
- Persistent connections
- Any scenario needing a stable effect

---

## Solution 4: useReducer for Complex State

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

Why is there no closure problem?

React guarantees:

```jsx
dispatch
```

has a stable identity.

So:

```text
dispatch(action)
```

always computes against React's current latest state.

Works for:

- Multi-value state
- State machines
- Redux-style logic

---

## Solution 5: Async Requests & Race Conditions

Many assume this is also a closure problem:

```jsx
useEffect(() => {
  fetch(`/api/user/${userId}`)
    .then(res => res.json())
    .then(data => {
      setName(data.name);
    });
}, [userId]);
```

In reality, the bigger issue here is usually a **Race Condition**:

```text
Request A

↓

Request B

↓

B returns first

↓

UI updates

↓

A returns later

↓

Stale data overwrites new data
```

The fix:

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

Or use:

```jsx
AbortController
```

to cancel the old request.

> Note: cleanup primarily addresses Race Conditions, not Stale Closure directly.

---

# 4. Comparison

| Solution | Best For | Pros | Cons |
|------|----------|------|------|
| **Functional updater** | Computing new state from old | ⭐ Official, simplest | Only for state updates |
| **Dependency array** | Re-running effect on change | Intuitive | Effect rebuilds frequently |
| **useRef** | Reading latest value | Stable effect | Must manually maintain `.current` |
| **useReducer** | Complex state | Stable dispatch | Slightly higher learning curve |
| **cleanup / AbortController** | Network requests | Avoids race conditions | Solves race, not closure |

---

# 5. Summary

The so-called "async closure trap" in `useEffect` is fundamentally **Stale Closure**.

It comes down to one sentence:

> **Every React render produces a new set of state and scope. Callbacks created inside `useEffect` only reference the render they were created in, so when they execute later, the values they read may already be stale.**

Choose the right strategy for your scenario:

- **Need to compute new state from old** → **Functional updater**
- **Need the latest value without rebuilding the effect** → **useRef**
- **Need to re-run side effects on state change** → **Proper dependency array**
- **Complex state logic** → **useReducer**
- **Async requests** → **cleanup or AbortController** to avoid race conditions

Understand **React's rendering model + JavaScript closures**, and you'll truly understand Stale Closure — and write more reliable `useEffect` code with confidence.
