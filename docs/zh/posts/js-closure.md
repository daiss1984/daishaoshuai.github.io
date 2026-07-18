---
title: JavaScript 闭包
date: 2026-07-18
description: 什么是闭包，它是如何工作的，为什么在 JavaScript 中无处不在？
---

# JavaScript 闭包

闭包是 JavaScript 中最重要、也最容易被误解的概念之一。从模块模式到 React Hooks，闭包无处不在。

## 1. 什么是闭包？

> **闭包**就是一个函数"记住"了它在定义时所在的外部词法作用域中的变量，即使外部函数已经执行完毕。

就这么简单——不是魔法，就是函数 + 它被创建时所在的环境。

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

`outer()` 已经执行完毕并返回了。局部变量 `message` 按理说应该被销毁。但 `fn()` 依然能打印出它的值。为什么？因为 `inner` "关住"了 `message` —— 形成了**闭包**。

## 2. 词法作用域与作用域链

想理解闭包，先要理解 JavaScript 如何解析变量。

```javascript
const global = 'global';

function outer() {
    const outerVar = 'outer';

    function inner() {
        const innerVar = 'inner';
        console.log(global);   // 在全局作用域找到
        console.log(outerVar); // 在 outer 的作用域找到
        console.log(innerVar); // 在 inner 自己的作用域找到
    }

    inner();
}

outer();
```

当 `inner` 访问 `outerVar` 时，JS 在 `inner` 自己的作用域里找不到，就**向外层**查找——在 `outer` 的作用域中找到了。这就是**作用域链**。

关键认知：作用域链是在**函数定义时**就确定好的，而不是在调用时。这叫**词法（静态）作用域**。

```javascript
const x = 10;

function foo() {
    console.log(x);
}

function bar() {
    const x = 20;
    foo(); // 打印 10，不是 20
}

bar();
```

`foo` 定义在全局作用域中，所以它的作用域链指向全局的 `x`，而不是 `bar` 里那个 `x`。这就是词法作用域。

## 3. 闭包的底层原理

每次调用函数时，JS 引擎会创建一个**执行上下文**（Execution Context），其中包含一个**词法环境**（Lexical Environment）。词法环境由两部分组成：

1. **环境记录**（Environment Record）——当前作用域中的变量
2. **外部引用**（Outer Reference）——指向外层词法环境的指针（即作用域链的链接）

```
┌────────────────────────────────────┐
│         全局执行上下文              │
│  ┌──────────────────────────────┐  │
│  │   词法环境 (Lexical Env)     │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ 环境记录               │  │  │
│  │  │  outer: <function>     │  │  │
│  │  │  fn: <function>        │  │  │
│  │  └────────────────────────┘  │  │
│  │  outer → null                │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
         ▲
         │  [[Environment]] 引用（函数定义时创建）
         │
┌────────────────────────────────────┐
│    fn() 执行上下文                 │
│  ┌──────────────────────────────┐  │
│  │   词法环境 (Lexical Env)     │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ 环境记录               │  │  │
│  │  │  (空)                  │  │  │
│  │  └────────────────────────┘  │  │
│  │  outer → outer() 的词法环境  │──┼──►  outer 的词法环境
│  └──────────────────────────────┘  │     ┌──────────────────────────┐
└────────────────────────────────────┘     │ 环境记录                 │
                                           │  message: "Hello!"       │
                                           │ outer → 全局词法环境     │
                                           └──────────────────────────┘
```

当 `outer()` 返回时，它的执行上下文从调用栈中弹出。但它的词法环境**不会被垃圾回收**，因为 `inner` 通过 `[[Environment]]` 内部槽仍然持有对它的引用。这就是闭包的机制。

## 4. 经典循环问题

闭包最著名的例子——面试必考：

```javascript
for (var i = 1; i <= 3; i++) {
    setTimeout(() => {
        console.log(i);
    }, i * 1000);
}
// 输出: 4, 4, 4（分别在 1s, 2s, 3s 后）
```

为什么？`var` 是函数作用域，不是块级作用域。三个回调都闭包引用了**同一个** `i` 变量。等回调执行时，循环早已结束，`i === 4`。

**解决方案**：

```javascript
// 方案 1：用 let（块级作用域）
for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
        console.log(i); // 1, 2, 3
    }, i * 1000);
}
// 每次迭代都创建了一个独立的 i 绑定，回调各自闭包住自己那次的 i

// 方案 2：IIFE（ES6 之前的做法）
for (var i = 1; i <= 3; i++) {
    (function (j) {
        setTimeout(() => {
            console.log(j); // 1, 2, 3
        }, j * 1000);
    })(i);
}
// IIFE 把 i 的值捕获到参数 j，每个回调闭包住各自的 j

// 方案 3：setTimeout 直接传参
for (var i = 1; i <= 3; i++) {
    setTimeout(console.log, i * 1000, i); // 1, 2, 3
}
```

| 方案 | 机制 | 时代 |
|------|------|------|
| `let` | 每次迭代独立绑定 | ES6+ |
| IIFE | 创建新作用域捕获值 | ES5 |
| `setTimeout` 参数 | 直接传值，不依赖闭包 | 通吃 |

## 5. 实战场景

### 5.1 数据私有化 / 封装

在 ES6 class 和 `#private` 之前，闭包是创建私有变量的主要手段：

```javascript
function createCounter() {
    let count = 0; // 真正私有——外部无法访问

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
console.log(counter.count); // undefined —— 访问不了
```

### 5.2 函数工厂

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

每个返回的函数都通过闭包"记住"了自己的 `factor`。

### 5.3 偏函数 / 柯里化

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

每次中间调用都通过闭包保留了已累积的参数。

### 5.4 事件处理

```javascript
function setupButton(buttonId, message) {
    const button = document.getElementById(buttonId);

    button.addEventListener('click', function () {
        alert(message); // 闭包引用了 message
    });
}

setupButton('btn1', '按钮 1 被点击');
setupButton('btn2', '按钮 2 被点击');
```

### 5.5 只执行一次（Once）

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
    console.log('初始化中...');
    return { ready: true };
});

init(); // "初始化中..."
init(); // 静默，返回相同结果
```

### 5.6 记忆化（Memoization）

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

const memoFib = memoize(n => (n <= 1 ? n : memoFib(n - 1) + memoFib(n - 2)));

console.time('第一次');
console.log(memoFib(40));
console.timeEnd('第一次');

console.time('第二次');
console.log(memoFib(40)); // 几乎瞬间（命中缓存）
console.timeEnd('第二次');
```

## 6. 内存与性能

闭包会使外部词法环境保持存活，意味着**在闭包本身被垃圾回收之前，相关的内存不会释放**。

### 6.1 闭包导致内存泄漏的情况

```javascript
function createLargeClosure() {
    const bigData = new Array(1_000_000).fill('🐘');

    return function handler(event) {
        console.log(event.type); // 根本没用到 bigData
    };
}

// 虽然 handler() 没有使用 bigData，
// 但 bigData 仍被保留在内存中，因为
// 闭包保持了整个外部词法环境的引用！
```

**修复方法**：在创建闭包之前将不需要的引用设为 `null`：

```javascript
function createLargeClosure() {
    const bigData = new Array(1_000_000).fill('🐘');
    // ... 用 bigData 做了计算 ...
    const result = compute(bigData);

    // 现在创建闭包 —— bigData 不会出现在闭包中
    return function handler(event) {
        console.log(event.type, result);
    };
}
```

> 现代 JS 引擎（V8、SpiderMonkey）已经足够智能，只会保留闭包内部实际引用了的变量。但不要依赖引擎优化——保持代码意图清晰。

### 6.2 清理事件监听

```javascript
function setupResize() {
    const element = document.getElementById('sidebar');

    function handleResize() {
        console.log(element.offsetWidth);
    }

    window.addEventListener('resize', handleResize);

    // 不清理的话，handleResize 和它闭包住的词法环境
    //（包括 element 引用）会永远留在内存中
    return () => {
        window.removeEventListener('resize', handleResize);
    };
}

const cleanup = setupResize();
// ... 之后 ...
cleanup(); // handler 和它的闭包现在都可以被 GC 回收了
```

## 7. 闭包与其他概念的关系

| 概念 | 与闭包的关系 |
|------|-------------|
| **作用域** | 闭包是词法作用域的必然结果。作用域是"规则"，闭包是"规则生效的现象"。 |
| **`this`** | `this` **不会**被闭包捕获。`this` 由调用点决定，不由定义点决定。用箭头函数或 `.bind()` 解决。 |
| **`var` vs `let`** | `var` 在循环迭代中共享绑定（导致经典闭包 bug）；`let` 为每次迭代创建独立绑定。 |
| **模块** | ES 模块和 CommonJS 模块内部都用闭包来封装私有状态。 |
| **React Hooks** | `useState`、`useCallback`、`useMemo`、`useEffect` 都依赖闭包来捕获渲染时的状态。 |

### `this` 不会被闭包捕获（重要细节）

```javascript
const obj = {
    name: 'Alice',
    greetLater() {
        setTimeout(function () {
            console.log(`Hello, ${this.name}`); // undefined（或 window.name）
        }, 1000);
    },
};

obj.greetLater(); // Hello, undefined

// 修复 1：箭头函数（没有自己的 this，从词法作用域继承）
const obj2 = {
    name: 'Alice',
    greetLater() {
        setTimeout(() => {
            console.log(`Hello, ${this.name}`); // Hello, Alice
        }, 1000);
    },
};

// 修复 2：保存 this 到变量（经典模式）
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

箭头函数优雅地解决了这个问题：它们没有自己的 `this`，所以通过词法作用域闭包住外层函数的 `this`。

## 8. 常见面试题

### Q1：下面输出什么？

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
<summary>答案</summary>

全部打印 `3`。`var` 声明的变量，所有闭包共享同一个 `i`。把 `var` 改成 `let` 即可得到 `0, 1, 2`。
</details>

### Q2：实现一个 `makeAdder`

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

**追问**：`add5` 和 `add10` 共享同一个闭包吗？**不共享。**每次调用 `makeAdder` 都会创建独立的词法环境，各自有自己的 `x`。

### Q3：用模块模式实现私有状态

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

IIFE 创建了唯一的词法环境。所有公开方法都闭包住了同一个 `accounts` Map，外部代码完全无法直接访问它。

## 9. 总结

- **闭包 = 函数 + 它的词法环境**，即使外部函数已返回，这个环境依然存活。
- 作用域链是**词法（静态）的**——由函数定义在哪里决定，不由调用位置决定。
- 闭包赋能：数据私有化、函数工厂、柯里化、记忆化、模块模式。
- 需要注意：`var` 循环陷阱、`this` 不被闭包捕获、引用残留导致的内存泄漏。
- 箭头函数同样形成闭包——只是它们没有自己的 `this` 和 `arguments`。

> "闭包不是你主动使用的特性，它是 JavaScript 运行机制的必然结果。" —— 佚名
