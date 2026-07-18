---
title: Python 迭代器与生成器
date: 2026-07-18
description: 理解迭代器协议，手写自定义迭代器，掌握 yield 与生成器表达式，学会用生成器做内存友好的数据处理。
---

# Python 迭代器与生成器

如果你写过 `for x in something`，你就用过迭代器。生成器则更进一步——它是处理大数据集、无限序列和数据管道的 Pythonic 方式，不会撑爆内存。本文从协议原理到实战模式，逐一讲透。

## 1. 可迭代对象 vs 迭代器

这个区分是基础中的基础：

- **可迭代对象（Iterable）**：可以对其循环的对象。它实现了 `__iter__()`，返回一个迭代器。
- **迭代器（Iterator）**：真正执行遍历的对象。它实现了 `__next__()` 返回下一个元素，以及 `__iter__()` 返回自身。

```python
nums = [1, 2, 3]          # list 是可迭代对象，不是迭代器

it = iter(nums)           # iter() 调用 nums.__iter__()，返回迭代器
print(type(it))           # <class 'list_iterator'>

print(next(it))           # 1 — 调用 it.__next__()
print(next(it))           # 2
print(next(it))           # 3
print(next(it))           # StopIteration！
```

`for` 循环背后做的就是这些：

```python
# for x in nums: 实际上等价于
it = iter(nums)
while True:
    try:
        x = next(it)
        # ... 你的循环体 ...
    except StopIteration:
        break
```

| | 可迭代对象 | 迭代器 |
|---|---|---|
| 协议 | `__iter__()` | `__iter__()` + `__next__()` |
| 可重复遍历？ | 是（每次创建新迭代器） | 否（耗尽即结束） |
| 例子 | `list`、`tuple`、`dict`、`str`、`set` | `list_iterator`、`generator` |
| `iter()` 作用于它 | 返回新的迭代器 | 返回自身 |

## 2. 手写自定义迭代器

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self          # 迭代器的 __iter__ 返回自己

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value

for n in Countdown(3):
    print(n)  # 3, 2, 1
```

能跑，但太啰嗦了。大多数情况下，生成器是更好的选择。

## 3. 生成器 —— `yield` 让一切变简单

生成器就是用了 `yield` 而非 `return` 的函数。调用它返回一个生成器迭代器——不需要手写 `__next__` / `StopIteration`：

```python
def countdown(start):
    while start > 0:
        yield start
        start -= 1

for n in countdown(3):
    print(n)  # 3, 2, 1
```

### `yield` 的工作原理

Python 碰到 `yield` 时，**暂停**函数并返回值。下一次 `next()` 调用时，从 `yield` 的下一行**恢复**执行，所有局部变量完好无损：

```python
def demo():
    print("A")
    yield 1
    print("B")
    yield 2
    print("C")

gen = demo()
print(next(gen))  # 打印 "A"，返回 1
print(next(gen))  # 打印 "B"，返回 2
print(next(gen))  # 打印 "C"，抛出 StopIteration
```

这种暂停-恢复机制是生成器内存高效的原因：同一时刻内存里只有一个值。

## 4. 生成器表达式

和列表推导式一样，但是惰性的——用 `()` 而不是 `[]`：

```python
# 列表推导式 —— 立刻在内存中创建完整列表
squares_list = [x**2 for x in range(10_000_000)]  # ~80 MB！

# 生成器表达式 —— 逐个产生值
squares_gen = (x**2 for x in range(10_000_000))   # 内存几乎不占

print(sum(squares_gen))  # 不存 1000 万个值，直接算总和
```

| | 列表推导式 | 生成器表达式 |
|---|---|---|
| 语法 | `[x for x in seq]` | `(x for x in seq)` |
| 求值 | 立即（创建完整列表） | 惰性（按需产出） |
| 内存 | 全部结果在内存中 | 一次一个值 |
| 可重复使用 | 是 | 否（遍历一次就耗尽） |
| 适用场景 | 结果小、需要索引 | 大/无限序列、管道处理 |

> **经验法则**：把结果喂给另一个函数时（`sum()`、`max()`、`any()`、`','.join()`）用生成器表达式；需要真正的列表时用列表推导式。

## 5. `yield from` —— 委托给子生成器

```python
def flat(nested):
    for sublist in nested:
        for item in sublist:
            yield item

# 等价，但更干净：
def flat(nested):
    for sublist in nested:
        yield from sublist

print(list(flat([[1, 2], [3, 4], [5]])))  # [1, 2, 3, 4, 5]
```

`yield from` 把迭代委托给另一个可迭代对象/生成器，透传所有值——同时正确处理 `send()`、`throw()`、`close()`。

## 6. 生成器高级方法

生成器不只是单向输出。你还能往里传值和抛异常：

```python
def accumulator():
    total = 0
    while True:
        value = yield total       # yield 返回 total，同时接收 value
        if value is None:
            break
        total += value

acc = accumulator()
print(next(acc))        # 0（启动生成器，执行到第一个 yield）
print(acc.send(10))     # 10（传入 10，加到 total，yield 新 total）
print(acc.send(20))     # 30
print(acc.send(5))      # 35
acc.close()             # 停止生成器
```

| 方法 | 作用 |
|------|------|
| `next(gen)` / `gen.__next__()` | 恢复执行，获取下一个 yield 的值 |
| `gen.send(value)` | 恢复执行，**同时**向生成器内部传入一个值（成为 `yield` 表达式的结果） |
| `gen.throw(exc)` | 在生成器内部的 yield 点抛出一个异常 |
| `gen.close()` | 在生成器内部抛出 `GeneratorExit`，用于清理资源 |

## 7. 实战场景

### 7.1 逐行读取大文件

```python
def read_large_file(path):
    with open(path) as f:
        for line in f:          # 文件对象本身就是迭代器！
            yield line.strip()

# 处理 10GB 日志文件，不把整个文件加载到内存
for line in read_large_file('huge.log'):
    if 'ERROR' in line:
        print(line)
```

### 7.2 无限序列

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

### 7.3 数据管道

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
        yield line[:19]  # 前 19 个字符 = 时间戳

# 串联 —— 每一步每次只处理一个元素
pipeline = parse_timestamps(filter_errors(read_logs('app.log')))
for ts in pipeline:
    print(ts)
```

精妙之处：每一步交替执行——`read_logs` 读一行，`filter_errors` 检查它，`parse_timestamps` 提取时间戳，然后回到 `read_logs` 读下一行。任意时刻内存中只有一行数据。

### 7.4 批量处理

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
    process(batch_data)  # 每次处理 10 条
```

## 8. `itertools` —— 生成器工具箱

`itertools` 模块提供了常用的生成器构建块：

```python
import itertools

# 无限迭代器
itertools.count(10, 2)        # 10, 12, 14, 16, ...
itertools.cycle('ABC')        # A, B, C, A, B, C, ...
itertools.repeat('x', 3)      # x, x, x

# 排列组合
itertools.product('AB', '12')  # (A,1), (A,2), (B,1), (B,2)
itertools.permutations('ABC', 2)  # (A,B), (A,C), (B,A), ...
itertools.combinations('ABC', 2)  # (A,B), (A,C), (B,C)

# 链接与分组
itertools.chain([1, 2], [3, 4])         # 1, 2, 3, 4
itertools.groupby('AAABBBCC')           # 对连续相同元素分组

# 主力工具
itertools.islice(iterable, start, stop) # 切任意可迭代对象
itertools.takewhile(lambda x: x < 5, [1,3,7,2])  # 1, 3（到 7 停止）
itertools.dropwhile(lambda x: x < 5, [1,3,7,2])  # 7, 2（从 7 开始）
```

## 9. 生成器 vs 迭代器 —— 快速对比

| | 迭代器（类实现） | 生成器（函数实现） |
|---|---|---|
| 创建方式 | 写 `__iter__` + `__next__` 类 | 写带 `yield` 的函数 |
| 样板代码 | 手动管理状态、`StopIteration` | Python 全包了 |
| 可读性 | 啰嗦 | 简洁、意图清晰 |
| 使用场景 | 状态复杂、需要 `send()`/`throw()` 逻辑 | 大多数情况——简单迭代 |

> 有疑问时，用生成器。只有当生成器确实无法干净地表达逻辑时，才写自定义迭代器类。

## 10. 总结

- **可迭代对象** = 有 `__iter__()`。**迭代器** = 有 `__next__()` + `__iter__()` 返回自身。
- `for` 循环内部调用 `iter()` 然后 `next()` 直到 `StopIteration`——这就是迭代器协议。
- **生成器** = 带 `yield` 的函数。暂停与恢复，状态在调用之间保留。
- **生成器表达式** = 惰性列表推导式。用 `()` 而不是 `[]`。
- `yield from` 干净地委托迭代给子生成器。
- **内存优势**：同一时刻只有一个值存在——用恒定内存处理 GB 级数据。
- **`itertools`** 是标准库中组合生成器的瑞士军刀。
