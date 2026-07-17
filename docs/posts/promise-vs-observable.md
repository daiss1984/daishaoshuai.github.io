---
title: Promise vs Observable — Deep Dive Comparison
date: 2026-06-28
description: Eager vs Lazy, single value vs stream, uncancelable vs cancelable — understand the fundamental differences between Promise and Observable for your next interview.
---

# Promise vs Observable — Deep Dive Comparison

Both Promise and Observable handle asynchrony, but their design philosophies are fundamentally different. When interviewers ask this, they're not testing API memory — they're checking whether you understand **Push vs Pull** and **single value vs stream**.

## 1. Quick Comparison

| | Promise | Observable |
|------|------|------|
| **Execution Timing** | **Eager** — runs immediately on creation | **Lazy** — runs only on subscribe |
| **Value Count** | **Single** — resolve once and done | **Multiple** — can push many values |
| **Cancellable** | ❌ Cannot cancel | ✅ `unsubscribe()` |
| **Operators** | `.then` `.catch` `.finally` | Rich operators (`map` `filter` `debounce` `switchMap`...) |
| **Multicast** | ❌ Each `.then` shares the same result | Default unicast, multicast via `share()` |
| **Spec** | ES6 native | RxJS library (TC39 proposal) |

## 2. Eager vs Lazy — The Core Difference

### Promise: Runs on Creation

```javascript
// Promise executes immediately upon creation!
const promise = new Promise((resolve) => {
    console.log('Promise started');
    setTimeout(() => {
        resolve('done');
    }, 1000);
});

// Even without .then(), the code above has already run
// Resolves after 1 second, regardless of whether anyone listens
```

### Observable: Runs on Subscribe

```javascript
import { Observable } from 'rxjs';

const observable$ = new Observable((subscriber) => {
    console.log('Observable started');
    setTimeout(() => {
        subscriber.next('done');
    }, 1000);
});

// Nothing happens! Must subscribe
observable$.subscribe((value) => console.log(value));
// Now outputs 'Observable started', then 'done' after 1s

// Each subscribe is an independent execution
observable$.subscribe((value) => console.log('Second:', value));
```

> **Interview gold**: Promise is hot execution — runs on creation; Observable defaults to cold — nothing happens until subscribed.

## 3. Single Value vs Multi-Value Stream

```javascript
// Promise — resolve once, game over
const promise = new Promise((resolve) => {
    resolve(1);
    resolve(2); // ineffective! Promise state is immutable once settled
    resolve(3); // ineffective!
});
promise.then(console.log); // only outputs 1


// Observable — continuous push
const stream$ = new Observable((subscriber) => {
    subscriber.next(1);
    subscriber.next(2);
    subscriber.next(3);
    subscriber.complete();
});
stream$.subscribe(console.log);
// Output: 1, 2, 3
```

This difference determines use cases:

| Scenario | Use | Why |
|----------|-----|-----|
| HTTP request (single response) | Promise | One request, one response, natural fit |
| WebSocket messages | Observable | Continuous push, multi-value stream |
| User input (search box) | Observable | Each keystroke is a new event |
| Timer / polling | Observable | Repeated value generation |
| File read | Promise | One read, one result |

## 4. Cancellation — Critical Engineering Difference

```javascript
// Promise — cannot cancel
const promise = fetch('/api/data');
// Even if component unmounts, the request continues, callback still fires
// Classic React bug: setState after unmount causes memory leak


// Observable — cancel via unsubscribe
const subscription = observable$.subscribe({
    next: (data) => this.setState({ data }),
    error: (err) => console.error(err),
});

// On component unmount
subscription.unsubscribe();
// Clean! e.g., fetch gets cancelled via AbortController
```

```javascript
// RxJS switchMap auto-cancels previous requests
import { fromEvent } from 'rxjs';
import { switchMap } from 'rxjs/operators';

const input = document.querySelector('input');
fromEvent(input, 'input').pipe(
    switchMap((e) => fetch(`/api/search?q=${e.target.value}`))
).subscribe();

// User quickly types "abc"
// 'a' → starts request 1
// 'ab' → cancels request 1, starts request 2
// 'abc' → cancels request 2, starts request 3
// Only the last result arrives! Perfect race-condition handling
```

Achieving the same with Promise requires manual cancel flags and AbortController — at least twice the code.

## 5. Operators — Observable's Killer Feature

Promise has only three tools: `.then()` `.catch()` `.finally()`. Observable has 100+ operators:

```javascript
import { fromEvent } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Search box typical scenario with Promise:
input.addEventListener('input', (e) => {
    const value = e.target.value;
    // manually implement debounce...
    // manually implement dedup...
    // manually cancel previous request...
    // dozens of lines
});

// With Observable: elegant functional pipeline
fromEvent(input, 'input').pipe(
    map((e) => e.target.value),          // extract value
    debounceTime(300),                    // debounce 300ms
    distinctUntilChanged(),               // skip if unchanged
    filter((v) => v.length >= 2),         // at least 2 characters
    switchMap((q) => fetch(`/api?q=${q}`))// request + auto-cancel previous
).subscribe((res) => {
    // Only valid final results reach here
});
```

**Common operators quick reference**:

| Category | Operators | Use |
|----------|-----------|-----|
| Transform | `map` `scan` `pluck` | Transform each value |
| Filter | `filter` `take` `skip` `distinctUntilChanged` | Filter/truncate |
| Time | `debounceTime` `throttleTime` `delay` | Debounce/throttle/delay |
| Combine | `merge` `concat` `combineLatest` `zip` | Combine multiple streams |
| Higher-order | `switchMap` `mergeMap` `concatMap` `exhaustMap` | Flatten inner streams |
| Utility | `tap` `catchError` `retry` `share` | Debug/error/retry/multicast |

## 6. Error Handling

```javascript
// Promise — chained catch
fetch('/api')
    .then((res) => res.json())
    .then((data) => console.log(data))
    .catch((err) => {
        console.error('Error:', err);
        // Any error in the chain jumps here
    });


// Observable — multiple handling approaches
observable$.subscribe({
    next: (v) => console.log(v),
    error: (err) => console.error('Error:', err),
    complete: () => console.log('Stream complete'),
});

// Or use catchError operator to recover
observable$.pipe(
    catchError((err) => {
        console.error(err);
        return of('default value'); // recover with default
    }),
    retry(3), // retry 3 times on failure
).subscribe();
```

## 7. Interop

```javascript
import { from, lastValueFrom, firstValueFrom } from 'rxjs';

// Observable → Promise
const promise = lastValueFrom(observable$);    // take last value
const promise2 = firstValueFrom(observable$);   // take first value

// Promise → Observable
const stream$ = from(somePromise);
// Auto-calls .then, pushes the resolved value

// Multiple Promises → Observable
const stream$ = from([promise1, promise2, promise3]);
```

## 8. Multicast

```javascript
// Promise — natural "multicast"
const p = fetch('/api');
p.then((r) => console.log('A:', r));
p.then((r) => console.log('B:', r));
// Only one request, both .then share the result


// Observable — default unicast, each subscribe is independent
const obs$ = new Observable((s) => {
    console.log('fetching...');
    s.next(Math.random());
});
obs$.subscribe((v) => console.log('A:', v)); // fetching... A: 0.123
obs$.subscribe((v) => console.log('B:', v)); // fetching... B: 0.456 different!

// Use share() for multicast
import { share } from 'rxjs/operators';
const shared$ = obs$.pipe(share());
shared$.subscribe((v) => console.log('A:', v)); // fetching... A: 0.789
shared$.subscribe((v) => console.log('B:', v)); // B: 0.789 same!
```

## 9. Common Interview Follow-Ups

### Q1: When do you use Observable instead of Promise?

**Standard answer**:
> When you need **cancellation** (search suggestions, autocomplete), when dealing with **real-time data streams** (WebSocket, SSE), or when requiring **complex operator composition** (debounce, throttle, race handling). For a one-off HTTP request, Promise or `firstValueFrom()` is sufficient.

### Q2: `switchMap`, `mergeMap`, `concatMap`, `exhaustMap` — how to choose?

| Operator | Behavior | Scenario |
|----------|----------|----------|
| `switchMap` | Cancel previous, keep only latest | Search suggestions, autocomplete |
| `mergeMap` | All run concurrently | Batch upload, each independent |
| `concatMap` | Queue up, one at a time | Operations requiring order |
| `exhaustMap` | Ignore new until current completes | Login button, prevent duplicate submits |

```javascript
// Key anti-duplicate-submit pattern: exhaustMap
fromEvent(loginBtn, 'click').pipe(
    exhaustMap(() => loginRequest())
).subscribe();
// Click → send request → logging in... → click again → ignored!
```

### Q3: Which performs better, Observable or Promise?

> They're not directly comparable. For simple single async operations, Promise is lighter (native). Observable's strength lies in stream processing and composability. Interviewers asking this are testing your "right tool for the job" thinking.

## 10. 💡 Remember with Analogy

| Concept | Analogy |
|---------|---------|
| **Promise** | Food delivery: order → wait → delivered (once) |
| **Observable** | Water tap: turn on → continuous flow → turn off |

```javascript
// Promise = function call returns a value
// Observable = function call returns a stream

// Essence:
// Promise: Push single value, Eager, Uncancelable
// Observable: Push multiple values, Lazy, Cancelable
```

**Interview closing template**:
> Promise solves getting the result of "**one**" async operation. Observable solves handling "**a category**" of async event streams. The former is an ES standard, the latter comes from RxJS. In real projects: HTTP requests are fine with Promise; search suggestions, WebSocket, and complex async orchestration suit Observable better. The core differences are: **Eager vs Lazy**, **single value vs multi-value**, and **uncancelable vs cancelable**.
