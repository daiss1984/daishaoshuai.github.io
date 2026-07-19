---
title: Python 双下划线方法 —— __init__、__str__、__repr__、__new__ 全解
date: 2026-07-19
description: 掌握 Python 的双下划线（dunder）方法 —— 从 __init__、__new__ 到 __str__、__repr__、__call__、运算符重载、上下文管理器，理解每个方法的作用与使用场景。
---

# Python 双下划线方法全解

Python 的"dunder"（双下划线，double underscore）方法——如 `__init__`、`__str__`、`__repr__`、`__new__`——是让你的对象像原生类型一样工作的秘密武器。它们让你控制对象被创建、打印、比较、调用、迭代时的行为。本文覆盖最常用的 dunder 方法，配合实战示例。

> **术语说明**：Python 中用 `_single` 表示"受保护"约定，`__double`（无尾下划线）触发名称改写实现私有。而前后都有双下划线的 `__dunder__` 方法被称为**魔法方法**、**特殊方法**——它们是 Python 在特定时刻自动调用的钩子。它们**不是**私有方法，而是 Python 数据模型的一部分。

## 1. 对象生命周期：`__new__`、`__init__`、`__del__`

### `__new__` —— 真正的构造器

`__new__` 在 `__init__` **之前**被调用。它负责**创建**实例并返回。大多数时候不需要重写，但在实现单例模式和子类化不可变类型时必不可少。

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

a = Singleton()
b = Singleton()
print(a is b)  # True
```

子类化不可变类型（如 `str`）：

```python
class UpperStr(str):
    def __new__(cls, value):
        return super().__new__(cls, value.upper())

print(UpperStr("hello"))  # "HELLO"
```

### `__new__` vs `__init__` —— 核心区别

理解二者区别的最佳方式是并排对比：

```python
class Demo:
    def __new__(cls, *args, **kwargs):
        print(f"1. __new__ 被调用 — cls={cls.__name__}, args={args}")
        instance = super().__new__(cls)   # 真正创建对象
        print(f"   创建了实例: {instance}")
        return instance                   # 必须返回实例！

    def __init__(self, name):
        print(f"2. __init__ 被调用 — self={self}, name={name}")
        self.name = name                  # 初始化已创建的对象

d = Demo("Alice")
# 输出：
# 1. __new__ 被调用 — cls=Demo, args=('Alice',)
#    创建了实例: <__main__.Demo object at 0x...>
# 2. __init__ 被调用 — self=<__main__.Demo object at 0x...>, name=Alice
```

从这段输出可以总结出核心区别：

| `__new__` | `__init__` |
|---|---|
| 第一个参数是 `cls`（类本身） | 第一个参数是 `self`（实例） |
| 必须**返回**一个实例 | 必须返回 `None` |
| 从零创建对象 | 给已有对象添加属性 |
| 隐式静态方法 | 实例方法 |
| 先执行 | 后执行（仅当 `__new__` 返回 `cls` 的实例时） |

**关键细节**：如果 `__new__` 返回了**别的类**的实例，`__init__` **不会被调用**：

```python
class A:
    def __new__(cls):
        print("A.__new__")
        return super().__new__(cls)

    def __init__(self):
        print("A.__init__")

class B:
    def __new__(cls):
        print("B.__new__ — 返回一个 A 的实例！")
        return A.__new__(A)   # 返回 A 的实例，不是 B

    def __init__(self):
        print("B.__init__ — 这一行永远不会执行")

b = B()
print(type(b))  # <class '__main__.A'> —— 不是 B！
# 输出：
# B.__new__ — 返回一个 A 的实例！
# A.__new__
# 注意：B.__init__ 被跳过了，A.__init__ 也被跳过了（因为手动调了 A.__new__）
```

> **核心认知**：Python 只在 `__new__` 返回**同类**实例时才调用 `__init__`。这就是为什么说 `__new__` 才是 Python 真正的构造器。

### `__init__` —— 初始化器

`__init__` **初始化**已经创建好的对象。在这里设置属性。

```python
class User:
    def __init__(self, name, age):
        self.name = name
        self.age = age

u = User("Alice", 25)  # 先执行 __new__，再执行 __init__
```

> **关键规则**：`__init__` 必须返回 `None`。返回其他任何值都会导致 `TypeError`。

### `__del__` —— 析构器

在对象即将被垃圾回收时调用。慎用——无法保证它**何时**执行。

```python
class Resource:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"正在清理 {self.name}")

r = Resource("temp")
del r  # "正在清理 temp"
```

> 建议用上下文管理器（`with` 语句）代替 `__del__` 来做确定性清理。

## 2. 字符串表示：`__str__` vs `__repr__`

这是面试必考题：

| | `__str__` | `__repr__` |
|---|---|---|
| 调用方 | `print()`、`str()`、f-string | `repr()`、Python Shell、调试器 |
| 受众 | 终端用户 | 开发者 |
| 目标 | 可读性好 | 无歧义（最好能被 `eval()` 还原） |

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point({self.x}, {self.y})"

    def __str__(self):
        return f"({self.x}, {self.y})"

p = Point(3, 4)
print(p)       # (3, 4)       —— 使用 __str__
print(repr(p)) # Point(3, 4)  —— 使用 __repr__
```

> **最佳实践**：总是实现 `__repr__`。如果跳过 `__str__`，Python 会回退到 `__repr__`。

## 3. 让对象可调用：`__call__`

定义 `__call__` 让实例像函数一样被调用：

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, x):
        return x * self.factor

double = Multiplier(2)
print(double(10))  # 20
print(double(7))   # 14
```

这一模式在框架中广泛使用（装饰器、中间件、PyTorch 的 `nn.Module.forward` 等），用于创建在调用之间保持状态的对象。

## 4. 容器式行为

### `__len__` —— `len(obj)`

```python
class Playlist:
    def __init__(self, songs):
        self.songs = songs

    def __len__(self):
        return len(self.songs)

p = Playlist(["A", "B", "C"])
print(len(p))  # 3
```

### `__getitem__` / `__setitem__` / `__delitem__` —— 索引访问

```python
class MyList:
    def __init__(self):
        self._data = []

    def __getitem__(self, index):
        return self._data[index]

    def __setitem__(self, index, value):
        self._data[index] = value

    def __delitem__(self, index):
        del self._data[index]

    def append(self, val):
        self._data.append(val)

ml = MyList()
ml.append(10)
ml.append(20)
print(ml[0])   # 10 —— __getitem__
ml[0] = 99     # __setitem__
del ml[1]      # __delitem__
```

### `__contains__` —— `in` 运算符

```python
class Team:
    def __init__(self, members):
        self.members = set(members)

    def __contains__(self, item):
        return item in self.members

t = Team(["Alice", "Bob", "Charlie"])
print("Alice" in t)  # True
print("Dave" in t)   # False
```

### `__iter__` 与 `__next__` —— 迭代

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current < 0:
            raise StopIteration
        val = self.current
        self.current -= 1
        return val

for n in Countdown(3):
    print(n)  # 3, 2, 1, 0
```

## 5. 比较运算符

重写这些方法让对象可以比较和排序：

```python
class Book:
    def __init__(self, title, pages):
        self.title = title
        self.pages = pages

    def __eq__(self, other):
        return self.pages == other.pages

    def __lt__(self, other):
        return self.pages < other.pages

    def __le__(self, other):
        return self.pages <= other.pages

b1 = Book("A", 200)
b2 = Book("B", 300)
print(b1 < b2)   # True
print(b1 == b2)  # False
```

用 `@functools.total_ordering` 减少样板代码：

```python
from functools import total_ordering

@total_ordering
class Book:
    def __init__(self, pages):
        self.pages = pages

    def __eq__(self, other):
        return self.pages == other.pages

    def __lt__(self, other):
        return self.pages < other.pages
    # __le__、__gt__、__ge__ 自动生成
```

### `__hash__` —— 让对象可哈希

如果你重写了 `__eq__`，Python 会将 `__hash__` 设为 `None`（对象不可哈希）。要让对象能放入 set 或作为 dict 的 key，需要实现 `__hash__`：

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        return hash((self.x, self.y))

points = {Point(1, 2), Point(1, 2)}
print(len(points))  # 1 —— 自动去重
```

> **规则**：如果 `a == b`，则 `hash(a) == hash(b)` 必须成立。在 `__hash__` 中使用不可变字段。

## 6. 算术运算符重载

| 运算符 | 方法 |
|---|---|
| `+` | `__add__` |
| `-` | `__sub__` |
| `*` | `__mul__` |
| `/` | `__truediv__` |
| `//` | `__floordiv__` |
| `%` | `__mod__` |
| `**` | `__pow__` |
| `@` | `__matmul__` |

每个还有**反射**版本（`__radd__`、`__rsub__` 等），当左操作数不知道如何处理运算时使用：

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        if isinstance(other, Vector):
            return Vector(self.x + other.x, self.y + other.y)
        return NotImplemented

    def __radd__(self, other):
        return self.__add__(other)

    def __mul__(self, scalar):
        return Vector(self.x * scalar, self.y * scalar)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

v1 = Vector(1, 2)
v2 = Vector(3, 4)
print(v1 + v2)    # Vector(4, 6)
print(v1 * 3)     # Vector(3, 6)
```

原地运算符使用 `__iadd__`、`__isub__` 等：

```python
class Counter:
    def __init__(self, val):
        self.val = val

    def __iadd__(self, other):
        self.val += other
        return self  # 必须返回 self！

c = Counter(5)
c += 3
print(c.val)  # 8
```

## 7. 上下文管理器：`__enter__` 与 `__exit__`

实现这两个方法即可使用 `with` 语句：

```python
class DatabaseConnection:
    def __init__(self, db_url):
        self.db_url = db_url

    def __enter__(self):
        print(f"正在连接 {self.db_url}...")
        self.conn = f"connection-{self.db_url}"
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("正在关闭连接...")
        return False  # 返回 True 可抑制异常

with DatabaseConnection("postgresql://...") as conn:
    print(f"正在使用 {conn}")
# 输出：
# 正在连接 postgresql://...
# 正在使用 connection-postgresql://...
# 正在关闭连接...
```

## 8. 属性访问：`__getattr__`、`__setattr__`、`__delattr__`

### `__getattr__` —— 仅在常规查找失败时调用

```python
class Config:
    def __init__(self):
        self._data = {"host": "localhost", "port": 8080}

    def __getattr__(self, name):
        if name in self._data:
            return self._data[name]
        raise AttributeError(f"配置项不存在: {name}")

c = Config()
print(c.host)  # "localhost" —— __getattr__ 提供
print(c.port)  # 8080
```

### `__setattr__` —— 每次属性赋值都会调用

```python
class Validated:
    def __setattr__(self, name, value):
        if name == "age" and value < 0:
            raise ValueError("年龄不能为负数")
        super().__setattr__(name, value)

v = Validated()
v.age = 25    # OK
v.age = -1    # ValueError！
```

> **关键**：在 `__setattr__` 内部，务必使用 `super().__setattr__()`——不能用 `self.name = value`（会导致无限递归！）。

## 9. `__slots__` —— 内存优化

不是严格意义上的方法，但常与 dunder 机制放在一起讨论。`__slots__` 告诉 Python 不要为每个实例创建 `__dict__`：

```python
class Point:
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(1, 2)
# p.z = 3  # AttributeError —— 没有 __dict__！
```

好处：节省约 50% 内存，属性访问更快。代价：没有 `__dict__`，不能动态添加属性。

## 10. 速查表

| 分类 | 方法 | 触发时机 |
|---|---|---|
| 生命周期 | `__new__`、`__init__`、`__del__` | 创建、初始化、销毁 |
| 字符串表示 | `__str__`、`__repr__`、`__format__`、`__bytes__` | `print()`、`repr()`、`format()`、`bytes()` |
| 可调用 | `__call__` | `obj()` |
| 容器 | `__len__`、`__getitem__`、`__setitem__`、`__delitem__`、`__contains__`、`__iter__`、`__next__`、`__reversed__` | `len()`、`obj[key]`、`in`、`for ... in`、`reversed()` |
| 比较 | `__eq__`、`__ne__`、`__lt__`、`__le__`、`__gt__`、`__ge__`、`__hash__` | `==`、`!=`、`<`、`<=`、`>`、`>=`、`hash()` |
| 算术 | `__add__`、`__sub__`、`__mul__`、`__truediv__`、`__floordiv__`、`__mod__`、`__pow__`、`__matmul__` | `+`、`-`、`*`、`/`、`//`、`%`、`**`、`@` |
| 反射运算 | `__radd__`、`__rsub__`…… | 左操作数无法处理时 |
| 原地运算 | `__iadd__`、`__isub__`…… | `+=`、`-=`…… |
| 一元运算 | `__neg__`、`__pos__`、`__abs__`、`__invert__` | `-obj`、`+obj`、`abs(obj)`、`~obj` |
| 上下文管理器 | `__enter__`、`__exit__` | `with` 语句 |
| 属性访问 | `__getattr__`、`__getattribute__`、`__setattr__`、`__delattr__`、`__dir__` | `obj.attr`、`del obj.attr`、`dir(obj)` |

## 总结

Dunder 方法是 Python 让自定义类与语言无缝集成的机制。核心要点：

1. **`__new__` 负责创建，`__init__` 负责初始化**——分清两者的职责。
2. **总是实现 `__repr__`**——调试时你会感谢自己。
3. **`__call__`** 让实例变成有状态的函数对象。
4. 用 `@total_ordering` 减少比较运算符的样板代码。
5. 用 `__enter__`/`__exit__` 做确定性资源清理。
6. 小心 `__setattr__`——始终委托给 `super()`。

这些方法不是"私有"的——它们是 Python 自身使用的公共 API。一旦掌握，你就能设计出使用体验如同内置类型的类。
