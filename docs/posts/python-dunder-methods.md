---
title: Python Dunder Methods — __init__, __str__, __repr__, __new__ & More
date: 2026-07-19
description: Master Python's double-underscore methods — from __init__ and __new__ to __str__, __repr__, __call__, operator overloading, context managers, and more. Understand what each does and when to override them.
---

# Python Dunder Methods — A Complete Guide

Python's "dunder" (double underscore) methods — like `__init__`, `__str__`, `__repr__`, `__new__` — are the secret sauce that makes Python objects feel native. They let you control what happens when your object is created, printed, compared, called, iterated, and more. This article covers the most important ones, with practical examples.

> **Terminology note**: In Python, "private" methods use a leading double underscore (`__private`) and trigger name mangling. Methods wrapped in double underscores on both sides (`__dunder__`) are called **dunder methods**, **magic methods**, or **special methods** — they are hooks that Python calls automatically at specific moments. They are **not** private; they are part of Python's data model.

## 1. Object Lifecycle: `__new__`, `__init__`, `__del__`

### `__new__` — The True Constructor

`__new__` is called **before** `__init__`. It is responsible for **creating** the instance and returning it. You rarely override it, but it is essential for singletons and subclassing immutable types.

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

`__new__` is also how you subclass immutable types like `str`:

```python
class UpperStr(str):
    def __new__(cls, value):
        return super().__new__(cls, value.upper())

print(UpperStr("hello"))  # "HELLO"
```

### `__new__` vs `__init__` — The Core Difference

The best way to understand the difference is to see them side by side:

```python
class Demo:
    def __new__(cls, *args, **kwargs):
        print(f"1. __new__ called — cls={cls.__name__}, args={args}")
        instance = super().__new__(cls)   # Actually creates the object
        print(f"   Created instance: {instance}")
        return instance                   # Must return the instance!

    def __init__(self, name):
        print(f"2. __init__ called — self={self}, name={name}")
        self.name = name                  # Initializes the already-created object

d = Demo("Alice")
# Output:
# 1. __new__ called — cls=Demo, args=('Alice',)
#    Created instance: <__main__.Demo object at 0x...>
# 2. __init__ called — self=<__main__.Demo object at 0x...>, name=Alice
```

Key observations from this trace:

| `__new__` | `__init__` |
|---|---|
| First argument is `cls` (the class) | First argument is `self` (the instance) |
| Must **return** an instance | Must return `None` |
| Creates the object from scratch | Decorates an existing object with attributes |
| Static method (implicitly) | Instance method |
| Runs first | Runs second (only if `__new__` returns an instance of `cls`) |

**Critical nuance**: If `__new__` returns an instance of a **different** class, `__init__` is **not** called:

```python
class A:
    def __new__(cls):
        print("A.__new__")
        return super().__new__(cls)

    def __init__(self):
        print("A.__init__")

class B:
    def __new__(cls):
        print("B.__new__ — returning an A instance instead!")
        return A.__new__(A)   # Returns an A, not a B

    def __init__(self):
        print("B.__init__ — this NEVER runs")

b = B()
print(type(b))  # <class '__main__.A'> — not B!
# Output:
# B.__new__ — returning an A instance instead!
# A.__new__
# Notice: B.__init__ is skipped, A.__init__ is skipped too (A.__new__ was called manually)
```

> **Takeaway**: Python only calls `__init__` when `__new__` returns an instance of the **same** class. This is why `__new__` is the true constructor in Python.

### `__init__` — The Initializer

`__init__` **initializes** the already-created object. This is where you set attributes.

```python
class User:
    def __init__(self, name, age):
        self.name = name
        self.age = age

u = User("Alice", 25)  # __new__ runs first, then __init__
```

> **Key rule**: `__init__` must return `None`. If you return anything else, Python raises `TypeError`.

### `__del__` — The Destructor

Called when an object is about to be garbage-collected. Use it sparingly — there is no guarantee **when** it runs.

```python
class Resource:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"Cleaning up {self.name}")

r = Resource("temp")
del r  # "Cleaning up temp"
```

> Prefer context managers (`with` statements) over `__del__` for deterministic cleanup.

## 2. String Representation: `__str__` vs `__repr__`

This is one of the most common interview questions:

| | `__str__` | `__repr__` |
|---|---|---|
| Called by | `print()`, `str()`, f-strings | `repr()`, Python shell, debugger |
| Audience | End users | Developers |
| Goal | Readable | Unambiguous (ideally eval()-able) |

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
print(p)       # (3, 4)       — uses __str__
print(repr(p)) # Point(3, 4)  — uses __repr__
```

> **Best practice**: Always implement `__repr__`. If you skip `__str__`, Python falls back to `__repr__`.

## 3. Making Objects Callable: `__call__`

Define `__call__` to make an instance behave like a function:

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

This is used heavily in frameworks (e.g., decorators, middleware, PyTorch `nn.Module.forward`) to create objects that maintain state between invocations.

## 4. Container-Like Behavior

### `__len__` — `len(obj)`

```python
class Playlist:
    def __init__(self, songs):
        self.songs = songs

    def __len__(self):
        return len(self.songs)

p = Playlist(["A", "B", "C"])
print(len(p))  # 3
```

### `__getitem__` / `__setitem__` / `__delitem__` — Indexing

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
print(ml[0])   # 10 — __getitem__
ml[0] = 99     # __setitem__
del ml[1]      # __delitem__
```

### `__contains__` — `in` Operator

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

### `__iter__` & `__next__` — Iteration

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

## 5. Comparison Operators

Override these to make your objects sortable and comparable:

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

    # __gt__, __ge__, __ne__ are inferred from __lt__ and __eq__
    # if you use @functools.total_ordering

b1 = Book("A", 200)
b2 = Book("B", 300)
print(b1 < b2)   # True
print(b1 == b2)  # False
```

To save boilerplate, use `@functools.total_ordering`:

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
    # __le__, __gt__, __ge__ are auto-generated
```

### `__hash__` — Making Objects Hashable

If you override `__eq__`, Python sets `__hash__` to `None` (making the object unhashable). To use it in sets or dict keys, implement `__hash__`:

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
print(len(points))  # 1 — deduplicated
```

> **Rule**: If `a == b`, then `hash(a) == hash(b)` must hold. Use immutable fields in `__hash__`.

## 6. Arithmetic Operator Overloading

| Operator | Method |
|---|---|
| `+` | `__add__` |
| `-` | `__sub__` |
| `*` | `__mul__` |
| `/` | `__truediv__` |
| `//` | `__floordiv__` |
| `%` | `__mod__` |
| `**` | `__pow__` |
| `@` | `__matmul__` |

Each also has a **reflected** version (`__radd__`, `__rsub__`, etc.) for when the left operand does not know how to handle the operation:

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
        # Fallback: handles scalar + Vector
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

In-place operators use `__iadd__`, `__isub__`, etc.:

```python
class Counter:
    def __init__(self, val):
        self.val = val

    def __iadd__(self, other):
        self.val += other
        return self  # must return self!

c = Counter(5)
c += 3
print(c.val)  # 8
```

## 7. Context Managers: `__enter__` & `__exit__`

Implement these to use `with` statements:

```python
class DatabaseConnection:
    def __init__(self, db_url):
        self.db_url = db_url

    def __enter__(self):
        print(f"Connecting to {self.db_url}...")
        self.conn = f"connection-{self.db_url}"
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("Closing connection...")
        # Return True to suppress exceptions
        return False

with DatabaseConnection("postgresql://...") as conn:
    print(f"Using {conn}")
# Output:
# Connecting to postgresql://...
# Using connection-postgresql://...
# Closing connection...
```

## 8. Attribute Access: `__getattr__`, `__setattr__`, `__delattr__`

### `__getattr__` — Called only when normal lookup fails

```python
class Config:
    def __init__(self):
        self._data = {"host": "localhost", "port": 8080}

    def __getattr__(self, name):
        if name in self._data:
            return self._data[name]
        raise AttributeError(f"No such config: {name}")

c = Config()
print(c.host)  # "localhost" — __getattr__ provides it
print(c.port)  # 8080
```

### `__setattr__` — Called on EVERY attribute assignment

```python
class Validated:
    def __setattr__(self, name, value):
        if name == "age" and value < 0:
            raise ValueError("Age cannot be negative")
        super().__setattr__(name, value)

v = Validated()
v.age = 25    # OK
v.age = -1    # ValueError!
```

> **Critical**: Inside `__setattr__`, use `super().__setattr__()` — not `self.name = value` (infinite recursion!).

## 9. `__slots__` — Memory Optimization

Not strictly a method, but often grouped with dunder mechanisms. `__slots__` tells Python not to create a `__dict__` for each instance:

```python
class Point:
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(1, 2)
# p.z = 3  # AttributeError — no __dict__!
```

Benefits: ~50% memory savings and faster attribute access. Trade-off: no `__dict__`, so no dynamic attributes.

## 10. Quick Reference

| Category | Methods | Trigger |
|---|---|---|
| Lifecycle | `__new__`, `__init__`, `__del__` | Creation, initialization, deletion |
| Representation | `__str__`, `__repr__`, `__format__`, `__bytes__` | `print()`, `repr()`, `format()`, `bytes()` |
| Callable | `__call__` | `obj()` |
| Container | `__len__`, `__getitem__`, `__setitem__`, `__delitem__`, `__contains__`, `__iter__`, `__next__`, `__reversed__` | `len()`, `obj[key]`, `in`, `for ... in`, `reversed()` |
| Comparison | `__eq__`, `__ne__`, `__lt__`, `__le__`, `__gt__`, `__ge__`, `__hash__` | `==`, `!=`, `<`, `<=`, `>`, `>=`, `hash()` |
| Arithmetic | `__add__`, `__sub__`, `__mul__`, `__truediv__`, `__floordiv__`, `__mod__`, `__pow__`, `__matmul__` | `+`, `-`, `*`, `/`, `//`, `%`, `**`, `@` |
| Reflected ops | `__radd__`, `__rsub__`, ... | When left operand fails |
| In-place ops | `__iadd__`, `__isub__`, ... | `+=`, `-=`, ... |
| Unary | `__neg__`, `__pos__`, `__abs__`, `__invert__` | `-obj`, `+obj`, `abs(obj)`, `~obj` |
| Context Manager | `__enter__`, `__exit__` | `with` statement |
| Attribute Access | `__getattr__`, `__getattribute__`, `__setattr__`, `__delattr__`, `__dir__` | `obj.attr`, `del obj.attr`, `dir(obj)` |

## Summary

Dunder methods are Python's way of letting your classes integrate seamlessly with the language. Key takeaways:

1. **`__new__` creates, `__init__` initializes** — know the difference.
2. **Always implement `__repr__`** — it helps debugging.
3. **`__call__`** turns instances into stateful callables.
4. Override comparison operators with `@total_ordering` to save boilerplate.
5. Use `__enter__`/`__exit__` for deterministic resource cleanup.
6. Be careful with `__setattr__` — always delegate to `super()`.

These methods are not "private" — they are the public API Python itself uses. Once you understand them, you can design classes that feel like built-in types.
