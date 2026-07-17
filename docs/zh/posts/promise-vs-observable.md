---
title: Promise vs Observable —— 面试常考题深度对比
date: 2026-06-28
description: Eager vs Lazy、单值 vs 流、不可取消 vs 可取消 —— 从面试角度彻底搞懂 Promise 和 Observable 的本质区别。
---

# Promise vs Observable —— 面试常考题深度对比

Promise 和 Observable 都是处理异步的利器，但设计哲学截然不同。面试官问这个问题，不是在考 API 记忆力，而是想看你是否理解**"推"（Push）与"拉"（Pull）**、**"单值"与"流"**的本质区别。

## 1. 一句话对比

| | Promise | Observable |
|------|------|------|
| **执行时机** | **Eager（立即）**——创建就执行 | **Lazy（惰性）**——subscribe 才执行 |
| **值的数量** | **单值**——resolve 一次就结束 | **多值**——可以持续推送多个值 |
| **可取消** | ❌ 无法取消 | ✅ `unsubscribe()` 取消订阅 |
| **操作符** | `.then` `.catch` `.finally` | 丰富的 operators（`map` `filter` `debounce` `switchMap`...） |
| **多播** | ❌ 每个 `.then` 共享同一个结果 | 默认单播，可通过 `share()` 多播 |
| **规范** | ES6 原生 | RxJS 库（TC39 提案中） |

## 2. Eager vs Lazy —— 最核心的差异

### Promise：创建即执行

```javascript
// Promise 一旦创建，里面的代码立刻执行！
const promise = new Promise((resolve) => {
    console.log('Promise 开始执行');
    setTimeout(() => {
        resolve('done');
    }, 1000);
});

// 即使没有 .then()，上面的代码也已经跑了
// 1 秒后 resolve，不管有没有人监听
```

### Observable：subscribe 才执行

```javascript
import { Observable } from 'rxjs';

const observable$ = new Observable((subscriber) => {
    console.log('Observable 开始执行');
    setTimeout(() => {
        subscriber.next('done');
    }, 1000);
});

// 什么都不发生！必须 subscribe
observable$.subscribe((value) => console.log(value));
// 现在才输出 'Observable 开始执行'，1秒后输出 'done'

// 每次 subscribe 都是独立执行
observable$.subscribe((value) => console.log('第二次:', value));
```

> **面试金句**：Promise 是热执行（hot），创建就跑；Observable 默认是冷执行（cold），没人订阅就不动。

## 3. 单值 vs 多值流

```javascript
// Promise —— 一次 resolve，game over
const promise = new Promise((resolve) => {
    resolve(1);
    resolve(2); // 无效！Promise 状态一旦 settled 就不可变
    resolve(3); // 无效！
});
promise.then(console.log); // 只输出 1


// Observable —— 持续推送
const stream$ = new Observable((subscriber) => {
    subscriber.next(1);
    subscriber.next(2);
    subscriber.next(3);
    subscriber.complete();
});
stream$.subscribe(console.log);
// 输出: 1, 2, 3
```

这种差异决定了使用场景：

| 场景 | 用哪个 | 原因 |
|------|------|------|
| HTTP 请求（一次响应） | Promise | 一个请求一个响应，天然匹配 |
| WebSocket 消息 | Observable | 持续推送，多值流 |
| 用户输入（搜索框） | Observable | 每次输入都是新事件 |
| 定时器 / 轮询 | Observable | 重复产生值 |
| 文件读取 | Promise | 一次读取一次结果 |

## 4. 取消 —— 关键的工程差异

```javascript
// Promise —— 无法取消
const promise = fetch('/api/data');
// 即使组件卸载了，请求还在进行，回调还会执行
// React 经典 bug：组件 unmount 后 setState 导致内存泄漏


// Observable —— 取消就是 unsubscribe
const subscription = observable$.subscribe({
    next: (data) => this.setState({ data }),
    error: (err) => console.error(err),
});

// 组件卸载时
subscription.unsubscribe();
// 干净利落！比如 fetch 会被 AbortController 取消
```

```javascript
// RxJS 的 switchMap 更是自动取消前一个请求
import { fromEvent } from 'rxjs';
import { switchMap } from 'rxjs/operators';

const input = document.querySelector('input');
fromEvent(input, 'input').pipe(
    switchMap((e) => fetch(`/api/search?q=${e.target.value}`))
).subscribe();

// 用户快速输入 "abc"
// 'a' → 发起请求1
// 'ab' → 取消请求1，发起请求2
// 'abc' → 取消请求2，发起请求3
// 只收到最后一个结果！完美解决竞态问题
```

如果用 Promise 实现同样效果，需要手动维护取消标志和 AbortController，代码量至少翻倍。

## 5. 操作符 —— Observable 的杀手锏

Promise 只有三板斧：`.then()` `.catch()` `.finally()`。Observable 有 100+ operators：

```javascript
import { fromEvent } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// 搜索框典型场景：用 Promise 写
input.addEventListener('input', (e) => {
    const value = e.target.value;
    // 手动写防抖...
    // 手动写去重...
    // 手动写取消上一次请求...
    // 十几行代码
});

// 用 Observable：优雅的函数式管道
fromEvent(input, 'input').pipe(
    map((e) => e.target.value),          // 提取值
    debounceTime(300),                    // 防抖 300ms
    distinctUntilChanged(),               // 值不变就不发
    filter((v) => v.length >= 2),         // 至少 2 个字符
    switchMap((q) => fetch(`/api?q=${q}`))// 请求 + 自动取消上一次
).subscribe((res) => {
    // 只有最终有效的结果才会走到这里
});
```

**常用操作符速查**：

| 类别 | 操作符 | 用途 |
|------|------|------|
| 转换 | `map` `scan` `pluck` | 变换每个值 |
| 过滤 | `filter` `take` `skip` `distinctUntilChanged` | 筛选/截取 |
| 时间 | `debounceTime` `throttleTime` `delay` | 防抖/节流/延迟 |
| 合并 | `merge` `concat` `combineLatest` `zip` | 组合多个流 |
| 高阶 | `switchMap` `mergeMap` `concatMap` `exhaustMap` | 流中流扁平化 |
| 工具 | `tap` `catchError` `retry` `share` | 调试/错误/重试/多播 |

## 6. 错误处理

```javascript
// Promise —— 链式 catch
fetch('/api')
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => {
        console.error('出错了:', err);
        // 前面的任意一步出错都会跳到这里
    });


// Observable —— 多种处理方式
observable$.subscribe({
    next: (v) => console.log(v),
    error: (err) => console.error('出了错:', err),
    complete: () => console.log('流结束'),
});

// 也可以用 catchError 操作符进行恢复
observable$.pipe(
    catchError((err) => {
        console.error(err);
        return of('默认值'); // 用默认值恢复流
    }),
    retry(3), // 失败后重试 3 次
).subscribe();
```

## 7. 互相转换

```javascript
import { from, lastValueFrom, firstValueFrom } from 'rxjs';

// Observable → Promise
const promise = lastValueFrom(observable$);    // 取最后一个值
const promise2 = firstValueFrom(observable$);   // 取第一个值

// Promise → Observable
const stream$ = from(somePromise);
// 自动调用 .then，把 resolve 值推出来

// 多个 Promise → Observable
const stream$ = from([promise1, promise2, promise3]);
```

## 8. 多播（Multicast）

```javascript
// Promise —— 天然的"多播"
const p = fetch('/api');
p.then((r) => console.log('A:', r));
p.then((r) => console.log('B:', r));
// 只发一次请求，两个 then 共享结果


// Observable —— 默认单播，每次 subscribe 独立执行
const obs$ = new Observable((s) => {
    console.log('fetching...');
    s.next(Math.random());
});
obs$.subscribe((v) => console.log('A:', v)); // fetching... A: 0.123
obs$.subscribe((v) => console.log('B:', v)); // fetching... B: 0.456 不同！

// 用 share() 实现多播
import { share } from 'rxjs/operators';
const shared$ = obs$.pipe(share());
shared$.subscribe((v) => console.log('A:', v)); // fetching... A: 0.789
shared$.subscribe((v) => console.log('B:', v)); // B: 0.789 相同！
```

## 9. 面试高频追问

### Q1：你在项目里什么时候用 Observable 而不是 Promise？

**标准回答**：
> 需要**取消**时（搜索建议、自动补全）、处理**实时数据流**时（WebSocket、SSE）、需要**复杂操作符组合**时（防抖、节流、竞态处理）。如果只是一次性的 HTTP 请求，用 Promise 或 `firstValueFrom()` 就够了。

### Q2：`switchMap`、`mergeMap`、`concatMap`、`exhaustMap` 怎么选？

| 操作符 | 行为 | 场景 |
|------|------|------|
| `switchMap` | 取消前一个，只保留最新 | 搜索建议、自动补全 |
| `mergeMap` | 全部并发执行 | 批量上传，每个独立 |
| `concatMap` | 排队，一个接一个 | 需保证顺序的操作 |
| `exhaustMap` | 忽略新来的，等当前完成 | 登录按钮防重复提交 |

```javascript
// 防止重复登录的关键：exhaustMap
fromEvent(loginBtn, 'click').pipe(
    exhaustMap(() => loginRequest())
).subscribe();
// 点击 → 发请求 → 正在登录中... → 再点 → 忽略！
```

### Q3：Observable 和 Promise 哪个性能更好？

> 不是同类事物。对于简单的单次异步操作，Promise 更轻量（原生）。Observable 的强大在于流式处理和可组合性。拿到这个问题的面试官在考察"合适的技术选型"思维。

## 10. 💡 一句话记住

| 概念 | 类比 |
|------|------|
| **Promise** | 外卖订单：下单 → 等待 → 送达（一次） |
| **Observable** | 自来水龙头：拧开 → 持续出水 → 关掉 |

```javascript
// Promise = 函数调用返回一个值
// Observable = 函数调用返回一个流

// 本质：
// Promise：Push 单值，Eager，不可取消
// Observable：Push 多值，Lazy，可取消
```

**面试最后一问的回答模板**：
> Promise 解决"**某一次**"异步操作的结果获取，Observable 解决"**某一类**"异步事件流的处理。前者是 ES 标准，后者来自 RxJS。在实际项目中，HTTP 请求用 Promise 就够；搜索建议、WebSocket、复杂异步编排用 Observable 更合适。核心差异是：**Eager vs Lazy**、**单值 vs 多值**、**不可取消 vs 可取消**。
