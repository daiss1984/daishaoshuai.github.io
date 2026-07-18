---
title: Python Iterators & Generators
date: 2026-07-18
description: Understand the iterator protocol, build custom iterators, master yield and generator expressions, and learn when to use generators for memory-efficient data processing.
---

# Python Iterators & Generators

If you've ever written `for x in something`, you've used iterators. Generators take this further — they're the Pythonic way to handle large datasets, infinite sequences, and data pipelines without blowing up memory. This article covers both, from protocol internals to real-world patterns.

## 1. Iterable vs Iterator

This distinction is the foundation:

- **Iterable**: an object you can loop over. It has `__iter__()` that returns an iterator.
- **Iterator**: the object that does the actual iteration. It has `__next__()` that returns the next item, and `__iter__()` that returns itself.

```python
nums = [1, 2, 3]          # list is iterable, NOT an iterator

it = iter(nums)           # iter() calls nums.__iter__(), returns an iterator
print(type(it))           # <class 'list_iterator'>

print(next(it))           # 1 — calls it.__next__()
print(next(it))           # 2
print(next(it))           # 3
print(next(it))           # StopIteration!
```

`for` loops do exactly this under the hood:

```python
# What for x in nums: actually does
it = iter(nums)
while True:
    try:
        x = next(it)
        # ... your loop body ...
    except StopIteration:
        break
```

| | Iterable | Iterator |
|---|---|---|
| Protocol | `__iter__()` | `__iter__()` + `__next__()` |
| Reusable? | Yes (creates new iterator each time) | No (once exhausted, done) |
| Examples | `list`, `tuple`, `dict`, `str`, `set` | `list_iterator`, `generator` |
| `iter()` on it | Returns a fresh iterator | Returns itself |

## 2. Building a Custom Iterator

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self          # an iterator returns itself

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value

for n in Countdown(3):
    print(n)  # 3, 2, 1
```

This works, but it's verbose. For most cases, generators are the better choice.

## 3. Generators — `yield` Makes It Simple

A generator is a function that uses `yield` instead of `return`. Calling it returns a generator iterator — no manual `__next__` / `StopIteration` needed:

```python
def countdown(start):
    while start > 0:
        yield start
        start -= 1

for n in countdown(3):
    print(n)  # 3, 2, 1
```

### How `yield` Works

When Python hits `yield`, it **pauses** the function and returns the value. On the next `next()` call, it **resumes** right after the `yield` line, with all local variables intact:

```python
def demo():
    print("A")
    yield 1
    print("B")
    yield 2
    print("C")

gen = demo()
print(next(gen))  # prints "A", returns 1
print(next(gen))  # prints "B", returns 2
print(next(gen))  # prints "C", raises StopIteration
```

This pause-resume behavior is what makes generators memory-efficient: only one value exists in memory at a time.

## 4. Generator Expressions

Like list comprehensions, but lazy — using `()` instead of `[]`:

```python
# List comprehension — creates the entire list in memory immediately
squares_list = [x**2 for x in range(10_000_000)]  # ~80 MB!

# Generator expression — produces values one at a time
squares_gen = (x**2 for x in range(10_000_000))   # negligible memory

print(sum(squares_gen))  # computes sum without storing 10M values
```

| | List Comprehension | Generator Expression |
|---|---|---|
| Syntax | `[x for x in seq]` | `(x for x in seq)` |
| Evaluation | Eager (creates full list) | Lazy (produces on demand) |
| Memory | Entire result in memory | One item at a time |
| Reusable | Yes | No (exhausted after one pass) |
| Best for | Small results, need indexing | Large/infinite sequences, pipelines |

> **Rule of thumb**: use generator expressions when piping into another function (`sum()`, `max()`, `any()`, `','.join()`). Use list comprehensions when you need the actual list.

## 5. `yield from` — Delegating to Sub-Generators

```python
def flat(nested):
    for sublist in nested:
        for item in sublist:
            yield item

# Equivalent, cleaner with yield from:
def flat(nested):
    for sublist in nested:
        yield from sublist

print(list(flat([[1, 2], [3, 4], [5]])))  # [1, 2, 3, 4, 5]
```

`yield from` delegates to another iterable/generator, passing through all values — and also handles `send()`, `throw()`, `close()` correctly.

## 6. Advanced Generator Methods

Generators aren't just output-only. You can send values in and throw exceptions in:

```python
def accumulator():
    total = 0
    while True:
        value = yield total       # yield returns total, receives value
        if value is None:
            break
        total += value

acc = accumulator()
print(next(acc))        # 0 (prime the generator, runs to first yield)
print(acc.send(10))     # 10 (sends 10, adds to total, yields new total)
print(acc.send(20))     # 30
print(acc.send(5))      # 35
acc.close()             # stops the generator
```

| Method | What it does |
|--------|-------------|
| `next(gen)` / `gen.__next__()` | Resume, get next yielded value |
| `gen.send(value)` | Resume AND send a value into the generator (becomes the result of `yield`) |
| `gen.throw(exc)` | Raise an exception inside the generator at the yield point |
| `gen.close()` | Raise `GeneratorExit` inside the generator to clean up |

## 7. Real-World Use Cases

### 7.1 Reading Large Files Line by Line

```python
def read_large_file(path):
    with open(path) as f:
        for line in f:          # file objects are iterators!
            yield line.strip()

# Process a 10GB log file without loading it all into memory
for line in read_large_file('huge.log'):
    if 'ERROR' in line:
        print(line)
```

### 7.2 Infinite Sequences

```python
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

from itertools import islice
first_10 = list(islice(fibonacci(), 10))
print(first_10)  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

### 7.3 Data Pipelines

```python
def read_logs(path):
    with open(path) as f:
        for line in f:
            yield line

def filter_errors(lines):
    for line in lines:
        if 'ERROR' in line:
            yield line

def parse_timestamps(lines):
    for line in lines:
        yield line[:19]  # first 19 chars = timestamp

# Chain them — each step processes one item at a time
pipeline = parse_timestamps(filter_errors(read_logs('app.log')))
for ts in pipeline:
    print(ts)
```

The beauty: each step runs interleaved — `read_logs` reads one line, `filter_errors` checks it, `parse_timestamps` extracts the timestamp, then back to `read_logs` for the next line. Only one line is in memory at any time.

### 7.4 Batch Processing

```python
def batch(iterable, n):
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) == n:
            yield chunk
            chunk = []
    if chunk:
        yield chunk

for batch_data in batch(range(100), 10):
    process(batch_data)  # process 10 items at a time
```

## 8. `itertools` — Your Generator Toolkit

The `itertools` module provides common generator building blocks:

```python
import itertools

# Infinite iterators
itertools.count(10, 2)        # 10, 12, 14, 16, ...
itertools.cycle('ABC')        # A, B, C, A, B, C, ...
itertools.repeat('x', 3)      # x, x, x

# Combinatoric
itertools.product('AB', '12')  # (A,1), (A,2), (B,1), (B,2)
itertools.permutations('ABC', 2)  # (A,B), (A,C), (B,A), ...
itertools.combinations('ABC', 2)  # (A,B), (A,C), (B,C)

# Chaining and merging
itertools.chain([1, 2], [3, 4])         # 1, 2, 3, 4
itertools.groupby('AAABBBCC')           # group consecutive identical elements

# The workhorses
itertools.islice(iterable, start, stop) # slice any iterable
itertools.takewhile(lambda x: x < 5, [1,3,7,2])  # 1, 3 (stops at 7)
itertools.dropwhile(lambda x: x < 5, [1,3,7,2])  # 7, 2 (starts at 7)
```

## 9. Generator vs Iterator — Quick Comparison

| | Iterator (class-based) | Generator (function-based) |
|---|---|---|
| Creation | Write `__iter__` + `__next__` class | Write a function with `yield` |
| Boilerplate | Manual state, `StopIteration` | Python handles everything |
| Readability | Verbose | Concise, intention-revealing |
| Use when | Complex state, need `send()`/`throw()` logic | Most cases — simple iteration |

> When in doubt, use a generator. Only write a custom iterator class if a generator can't express the logic cleanly.

## 10. Summary

- **Iterable** = has `__iter__()`. **Iterator** = has `__next__()` + `__iter__()` returning self.
- `for` loops call `iter()` then `next()` until `StopIteration` — this is the iterator protocol.
- **Generator** = function with `yield`. Pauses and resumes, state preserved between calls.
- **Generator expression** = lazy list comprehension. Use `()` instead of `[]`.
- `yield from` delegates iteration to a sub-generator cleanly.
- **Memory advantage**: only one value exists at a time — process gigabytes of data with constant memory.
- **`itertools`** is the standard library Swiss Army knife for generator composition.
