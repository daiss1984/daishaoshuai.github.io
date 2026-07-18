---
title: JavaScript Closures
date: 2026-07-18
description: What is a closure, how does it work, and why is it everywhere in JavaScript?.
---

# JavaScript Closures

Closures are one of JavaScript's most important and frequently misunderstood concepts. They power everything from module patterns to React hooks.

## 1. What Is a Closure?

> A **closure** is a function that "remembers" the variables from its outer lexical scope, even after that outer function has finished executing.

That's it. No magic — just a function plus the environment it was created in.

```javascript
function outer() {
    const message = 'Hello, Closure!';

    function inner() {
        console.log(message);
    }

    return inner;
}

const fn = outer();
fn(); // "Hello, Closure!"
```

`outer()` has already returned. Its local variable `message` should be gone. Yet `fn()` still prints it. Why? Because `inner` closed over `message` — forming a **closure**.

## 2. Lexical Scope & The Scope Chain

To understand closures, you must first understand how JavaScript resolves variables.

```javascript
const global = 'global';

function outer() {
    const outerVar = 'outer';

    function inner() {
        const innerVar = 'inner';
        console.log(global);   // found in global scope
        console.log(outerVar); // found in outer's scope
        console.log(innerVar); // found in inner's scope
    }

    inner();
}

outer();
```

When `inner` accesses `outerVar`, JS doesn't find it in `inner`'s local scope. It looks **one level up** — in `outer`'s scope. This is the **scope chain**.

Key insight: the scope chain is determined at **definition time**, not at call time. This is called **lexical (static) scoping**.

```javascript
const x = 10;

function foo() {
    console.log(x);
}

function bar() {
    const x = 20;
    foo(); // prints 10, not 20
}

bar();
```

`foo` was defined in the global scope, so its scope chain points to the global `x`, not `bar`'s local `x`. This is lexical scoping in action.

## 3. How Closures Actually Work (Under the Hood)

Every time a function is invoked, JS creates an **Execution Context** with a **Lexical Environment**. The Lexical Environment has two parts:

1. **Environment Record** — the actual variables in the current scope
2. **Outer Reference** — a pointer to the outer Lexical Environment (the scope chain link)

```
┌────────────────────────────────────┐
│        Global Execution Context    │
│  ┌──────────────────────────────┐  │
│  │   Lexical Environment        │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ Environment Record     │  │  │
│  │  │  outer: <function>     │  │  │
│  │  │  fn: <function>        │  │  │
│  │  └────────────────────────┘  │  │
│  │  outer → null                │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
         ▲
         │  [[Environment]] reference (created at definition time)
         │
┌────────────────────────────────────┐
│    fn() Execution Context          │
│  ┌──────────────────────────────┐  │
│  │   Lexical Environment        │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ Environment Record     │  │  │
│  │  │  (empty)               │  │  │
│  │  └────────────────────────┘  │  │
│  │  outer → outer()'s Env       │──┼──►  outer's Lexical Environment
│  └──────────────────────────────┘  │     ┌──────────────────────────┐
└────────────────────────────────────┘     │ Environment Record      │
                                           │  message: "Hello!"      │
                                           │ outer → Global Env      │
                                           └──────────────────────────┘
```

When `outer()` returns, its Execution Context is popped off the call stack. But its Lexical Environment is **not garbage-collected** because `inner` still holds a reference to it via the `[[Environment]]` internal slot. This is the closure mechanism.

## 4. The Classic Loop Problem

The most famous closure example — and interview staple:

```javascript
for (var i = 1; i <= 3; i++) {
    setTimeout(() => {
        console.log(i);
    }, i * 1000);
}
// Output: 4, 4, 4 (after 1s, 2s, 3s)
```

Why? `var` is function-scoped, not block-scoped. All three callbacks close over the **same** `i` variable. By the time they run, the loop is done and `i === 4`.

**Solutions**:

```javascript
// Solution 1: Use let (block-scoped)
for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
        console.log(i); // 1, 2, 3
    }, i * 1000);
}
// Each iteration gets its own i binding. The callback closes over its iteration's i.

// Solution 2: IIFE (the pre-ES6 approach)
for (var i = 1; i <= 3; i++) {
    (function (j) {
        setTimeout(() => {
            console.log(j); // 1, 2, 3
        }, j * 1000);
    })(i);
}
// The IIFE captures i's value in parameter j. Each callback closes over its own j.

// Solution 3: Pass as setTimeout argument
for (var i = 1; i <= 3; i++) {
    setTimeout(console.log, i * 1000, i); // 1, 2, 3
}
```

| Approach | Mechanism | Era |
|----------|-----------|-----|
| `let` | Block-scoped binding per iteration | ES6+ |
| IIFE | Creates a new scope capturing the value | ES5 |
| `setTimeout` args | Passes value directly, no closure needed | All |

## 5. Practical Use Cases

### 5.1 Data Privacy / Encapsulation

Before ES6 classes and `#private` fields, closures were the primary way to create private variables:

```javascript
function createCounter() {
    let count = 0; // truly private — no external access

    return {
        increment() { count++; },
        decrement() { count--; },
        get value() { return count; },
    };
}

const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.value); // 2
console.log(counter.count); // undefined — can't access
```

### 5.2 Function Factories

```javascript
function multiplyBy(factor) {
    return function (n) {
        return n * factor;
    };
}

const double = multiplyBy(2);
const triple = multiplyBy(3);

console.log(double(5)); // 10
console.log(triple(5)); // 15
```

Each returned function "remembers" its own `factor` via closure.

### 5.3 Partial Application / Currying

```javascript
function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) {
            return fn(...args);
        }
        return (...next) => curried(...args, ...next);
    };
}

const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

console.log(curriedAdd(1)(2)(3)); // 6
console.log(curriedAdd(1, 2)(3)); // 6
```

Each intermediate call closes over the accumulated arguments.

### 5.4 Event Handlers

```javascript
function setupButton(buttonId, message) {
    const button = document.getElementById(buttonId);

    button.addEventListener('click', function () {
        alert(message); // closure over message
    });
}

setupButton('btn1', 'Button 1 clicked');
setupButton('btn2', 'Button 2 clicked');
```

### 5.5 Once (Run a Function Only Once)

```javascript
function once(fn) {
    let called = false;
    let result;

    return function (...args) {
        if (!called) {
            called = true;
            result = fn.apply(this, args);
        }
        return result;
    };
}

const init = once(() => {
    console.log('Initializing...');
    return { ready: true };
});

init(); // "Initializing..."
init(); // silent, returns same result
```

### 5.6 Memoization

```javascript
function memoize(fn) {
    const cache = new Map();

    return function (arg) {
        if (cache.has(arg)) {
            return cache.get(arg);
        }
        const result = fn(arg);
        cache.set(arg, result);
        return result;
    };
}

const expensiveFib = n => (n <= 1 ? n : expensiveFib(n - 1) + expensiveFib(n - 2));
const memoFib = memoize(n => (n <= 1 ? n : memoFib(n - 1) + memoFib(n - 2)));

console.time('first');
console.log(memoFib(40)); // ~1-2ms
console.timeEnd('first');

console.time('second');
console.log(memoFib(40)); // near-instant (cached)
console.timeEnd('second');
```

## 6. Memory & Performance

Closures keep their outer Lexical Environments alive, which means **memory is not freed** until the closure itself is garbage-collected.

### 6.1 When Closures Cause Memory Leaks

```javascript
function createLargeClosure() {
    const bigData = new Array(1_000_000).fill('🐘');

    return function handler(event) {
        console.log(event.type); // doesn't use bigData
    };
}

// Even though handler() doesn't use bigData,
// bigData is still held in memory because the
// closure keeps the entire outer Lexical Environment alive!
```

**Fix**: Set unused references to `null` before creating the closure:

```javascript
function createLargeClosure() {
    const bigData = new Array(1_000_000).fill('🐘');
    // ... use bigData for computation ...
    const result = compute(bigData);

    // Now create closure — bigData won't be in the closure
    return function handler(event) {
        console.log(event.type, result);
    };
}
```

> Modern JS engines (V8, SpiderMonkey) are smart enough to only retain variables that are actually referenced inside the closure. But don't rely on it — be explicit.

### 6.2 Cleaning Up Event Listeners

```javascript
function setupResize() {
    const element = document.getElementById('sidebar');

    function handleResize() {
        console.log(element.offsetWidth);
    }

    window.addEventListener('resize', handleResize);

    // Without cleanup, both handleResize and the Lexical Environment
    // (including element reference) stay alive forever.
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}

const cleanup = setupResize();
// ... later ...
cleanup(); // Now both the handler and its closure can be GC'd
```

## 7. Closures vs Other Concepts

| Concept | Relationship to Closures |
|---------|-------------------------|
| **Scope** | Closures are a consequence of lexical scoping. Scope is the "what"; closure is the "what survives." |
| **`this`** | `this` is NOT captured by closures. It depends on call-site, not definition-site. Use arrow functions or `.bind()` to fix `this`. |
| **`var` vs `let`** | `var` shares bindings across loop iterations (causing the classic closure bug); `let` creates per-iteration bindings. |
| **Modules** | ES modules and CommonJS modules use closures internally to encapsulate private state. |
| **React Hooks** | `useState`, `useCallback`, `useMemo`, `useEffect` all rely on closures to capture state at render time. |

### `this` Is NOT Captured (Important Nuance)

```javascript
const obj = {
    name: 'Alice',
    greetLater() {
        setTimeout(function () {
            console.log(`Hello, ${this.name}`); // undefined (or window.name)
        }, 1000);
    },
};

obj.greetLater(); // Hello, undefined

// Fix 1: Arrow function (no own this, inherits from lexical scope)
const obj2 = {
    name: 'Alice',
    greetLater() {
        setTimeout(() => {
            console.log(`Hello, ${this.name}`); // Hello, Alice
        }, 1000);
    },
};

// Fix 2: Save this in a variable (the classic pattern)
const obj3 = {
    name: 'Alice',
    greetLater() {
        const self = this;
        setTimeout(function () {
            console.log(`Hello, ${self.name}`); // Hello, Alice
        }, 1000);
    },
};
```

Arrow functions resolve this neatly: they don't have their own `this`, so they close over the enclosing function's `this` lexically.

## 8. Common Interview Questions

### Q1: What's the output?

```javascript
function createFunctions() {
    const result = [];
    for (var i = 0; i < 3; i++) {
        result.push(() => console.log(i));
    }
    return result;
}

const fns = createFunctions();
fns[0](); // ?
fns[1](); // ?
fns[2](); // ?
```

<details>
<summary>Answer</summary>

All print `3`. With `var`, all closures share the same `i`. Change `var` to `let` to get `0, 1, 2`.
</details>

### Q2: Write a `makeAdder`

```javascript
function makeAdder(x) {
    return function (y) {
        return x + y;
    };
}

const add5 = makeAdder(5);
const add10 = makeAdder(10);

console.log(add5(2));  // 7
console.log(add10(2)); // 12
```

**Follow-up**: Do `add5` and `add10` share the same closure? **No.** Each call to `makeAdder` creates a separate Lexical Environment with its own `x`.

### Q3: Implement a module pattern with private state

```javascript
const Bank = (function () {
    const accounts = new Map();

    return {
        deposit(accountId, amount) {
            const balance = accounts.get(accountId) || 0;
            accounts.set(accountId, balance + amount);
            return accounts.get(accountId);
        },
        getBalance(accountId) {
            return accounts.get(accountId) || 0;
        },
    };
})();

Bank.deposit('a1', 100);
console.log(Bank.getBalance('a1')); // 100
console.log(Bank.accounts);         // undefined
```

The IIFE creates a single Lexical Environment. All public methods close over the same `accounts` Map. No external code can reach it directly.

## 9. Summary

- **Closure = function + its lexical environment**, preserved even after the outer function returns.
- The scope chain is **lexical (static)** — determined by where functions are defined, not where they're called.
- Closures enable: data privacy, function factories, currying, memoization, and the module pattern.
- Watch out for: the `var` loop trap, `this` not being captured by closures, and memory leaks from lingering references.
- Arrow functions form closures too — they just don't have their own `this` or `arguments`.

> "Closures are not a feature you explicitly use; they are a consequence of how JavaScript works." — anonymous
