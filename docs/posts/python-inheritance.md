---
title: Python Inheritance
date: 2026-07-18
description: Master single, multiple, and multilevel inheritance in Python — MRO, super(), ABC, composition vs inheritance, and common pitfalls.
---

# Python Inheritance

Inheritance is a core OOP mechanism that lets a class reuse and extend another class's behavior. Python's inheritance model is flexible — supporting single, multiple, and multilevel inheritance — but that flexibility comes with unique challenges like the diamond problem. This article covers everything from basic syntax to MRO internals.

## 1. Why Inheritance?

Without inheritance, shared behavior leads to copy-paste:

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} says Woof!"

class Cat:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} says Meow!"
```

`__init__` is identical. Inheritance eliminates this duplication:

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def speak(self):
        return f"{self.name} says Woof!"

class Cat(Animal):
    def speak(self):
        return f"{self.name} says Meow!"
```

## 2. Single Inheritance

```python
class Vehicle:
    def __init__(self, brand):
        self.brand = brand

    def start(self):
        return f"{self.brand} is starting..."

class Car(Vehicle):
    def __init__(self, brand, doors):
        super().__init__(brand)  # call parent's __init__
        self.doors = doors

    def honk(self):
        return "Beep beep!"

car = Car("Toyota", 4)
print(car.start())  # Toyota is starting...   (inherited)
print(car.honk())   # Beep beep!              (own method)
```

### `super()` — The Right Way to Call Parent Methods

```python
class A:
    def greet(self):
        return "Hello from A"

class B(A):
    def greet(self):
        parent_greeting = super().greet()  # NOT A.greet(self)
        return f"{parent_greeting} and B"

print(B().greet())  # Hello from A and B
```

Always use `super()` instead of hardcoding the parent class name — it's critical for correct MRO in multiple inheritance.

## 3. Method Resolution Order (MRO)

When you call a method, Python searches classes in a specific order. This is the **MRO** — Method Resolution Order.

```python
class A:
    def who(self):
        return "A"

class B(A):
    def who(self):
        return "B"

class C(A):
    def who(self):
        return "C"

class D(B, C):
    pass

print(D().who())  # B
print(D.__mro__)
# (D, B, C, A, object)
```

Python uses **C3 Linearization** to compute MRO. Two rules:

1. Children come before parents
2. The order in the `class D(B, C)` declaration is preserved

```
       A
      / \
     B   C
      \ /
       D

MRO: D → B → C → A → object
```

If the MRO cannot satisfy both rules (e.g., inconsistent base order), Python raises `TypeError` at class definition time.

## 4. Multiple Inheritance & The Diamond Problem

```python
class A:
    def __init__(self):
        print("A.__init__")

class B(A):
    def __init__(self):
        print("B.__init__")
        super().__init__()

class C(A):
    def __init__(self):
        print("C.__init__")
        super().__init__()

class D(B, C):
    def __init__(self):
        print("D.__init__")
        super().__init__()

D()
# D.__init__
# B.__init__
# C.__init__
# A.__init__
```

Notice two things:

**1. `B.__init__`'s `super()` goes to `C`, not `A`.** That's because `super()` follows MRO: `D → B → C → A`. From `B`'s position in the MRO, the next class is `C`, not `A`. Each class cooperates by calling `super()` — this is the **cooperative multiple inheritance** pattern.

**2. `A.__init__` prints only once.** Even though both `B` and `C` inherit from `A`, the `super()` chain is linear, not tree-shaped:

```
D.__init__
  → super() → B.__init__
                → super() → C.__init__   (not A! MRO says C comes before A)
                              → super() → A.__init__
                                            → super() → object (nothing)
```

Both `B` and `C` sit between `D` and `A` in the MRO. `super()` in `B` finds `C` first; `super()` in `C` then finds `A`. So `A` is only reached once, through `C`'s `super()` call — `B`'s `super()` never directly calls `A`. The chain is **D → B → C → A**, not two separate paths.

Without `super()` in `B` and `C`, `A.__init__` would be skipped entirely — a common diamond pitfall.

## 5. Types of Inheritance

```python
# Single
class A: pass
class B(A): pass

# Multilevel
class A: pass
class B(A): pass
class C(B): pass

# Hierarchical
class A: pass
class B(A): pass
class C(A): pass

# Multiple
class A: pass
class B: pass
class C(A, B): pass

# Hybrid — any combination of the above
```

## 6. `isinstance()` and `issubclass()`

```python
class Animal: pass
class Dog(Animal): pass

dog = Dog()

print(isinstance(dog, Dog))      # True
print(isinstance(dog, Animal))   # True  (indirect parent)
print(isinstance(dog, object))   # True  (everything inherits from object)

print(issubclass(Dog, Animal))   # True
print(issubclass(Dog, object))   # True
print(issubclass(Animal, Dog))   # False
```

## 7. Private Members & Name Mangling

Python doesn't have true private members. The `__` prefix triggers **name mangling**:

```python
class Parent:
    def __init__(self):
        self.__secret = 42       # actually stored as _Parent__secret

    def reveal(self):
        return self.__secret     # works inside the class

class Child(Parent):
    def peek(self):
        return self.__secret     # AttributeError! (looks for _Child__secret)

p = Parent()
print(p.reveal())                # 42
print(p._Parent__secret)         # 42 (still accessible if you know the mangled name)
```

Name mangling is a convention to avoid accidental name collisions in subclasses, not a security mechanism.

Use a single `_` prefix (`self._internal`) for the conventional "protected" signal.

## 8. Abstract Base Classes (ABC)

Prevent incomplete subclasses by requiring certain methods:

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

    @abstractmethod
    def perimeter(self):
        pass

class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14 * self.radius ** 2

    # Missing perimeter()!

# c = Circle(5)  # TypeError: Can't instantiate — perimeter is abstract
```

`ABC` + `@abstractmethod` enforces a contract: subclasses MUST implement all abstract methods before they can be instantiated.

## 9. `@property` and Inheritance

```python
class Rectangle:
    def __init__(self, width, height):
        self._width = width
        self._height = height

    @property
    def area(self):
        return self._width * self._height

class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)

    # area is inherited automatically — no need to redefine
    @property
    def side(self):
        return self._width

sq = Square(5)
print(sq.area)  # 25 (inherited from Rectangle)
print(sq.side)  # 5  (Square-specific)
```

Properties are inherited like any other method. This makes read-only computed attributes easy to share across a class hierarchy.

## 10. Inheritance vs Composition

> "Prefer composition over inheritance" — but what does that mean?

```python
# Inheritance: "is-a"
class Stack(list):  # Stack is-a list
    def push(self, item):
        self.append(item)

# Problem: Stack inherits ALL list methods — insert(), remove(), sort()...
# A stack shouldn't allow inserting in the middle!
```

```python
# Composition: "has-a"
class Stack:
    def __init__(self):
        self._items = []        # Stack has-a list (internally)

    def push(self, item):
        self._items.append(item)

    def pop(self):
        return self._items.pop()

    def __len__(self):
        return len(self._items)

# Only exposes push/pop/len — true stack semantics
```

| | Inheritance | Composition |
|---|---|---|
| Relationship | "is-a" | "has-a" |
| Coupling | Tight (subclass depends on parent internals) | Loose (uses public interface) |
| Flexibility | Fixed at definition | Can swap implementation at runtime |
| When to use | Clear hierarchical relationship, shared interface | Reusing behavior without identity |
| Python example | `class Square(Rectangle)` | `Stack` wraps a `list` |

## 11. Common Pitfalls

### 11.1 Forgetting `super().__init__()`

```python
class Parent:
    def __init__(self):
        self.data = []

class Child(Parent):
    def __init__(self):
        pass  # forgot super().__init__()!

c = Child()
print(c.data)  # AttributeError: 'Child' object has no attribute 'data'
```

### 11.2 Mutable Default Arguments in Parent

```python
class Parent:
    def __init__(self, items=[]):     # DANGER: shared across all instances
        self.items = items

class Child(Parent):
    pass

c1 = Child()
c2 = Child()
c1.items.append(1)
print(c2.items)  # [1] — surprised?
```

**Fix**: `def __init__(self, items=None): self.items = items if items is not None else []`

### 11.3 Conflicting Method Signatures

```python
class Parent:
    def connect(self, host, port):
        pass

class Child(Parent):
    def connect(self, url):  # different signature — Liskov violation
        pass
```

This breaks polymorphism. Design your hierarchy so subclasses can be used wherever the parent is expected.

## 12. `__init_subclass__` — Hook into Subclass Creation

```python
class Registry:
    _subclasses = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        Registry._subclasses.append(cls)

class PluginA(Registry): pass
class PluginB(Registry): pass

print(Registry._subclasses)  # [PluginA, PluginB]
```

A powerful hook for plugin systems — auto-register subclasses without decorators or metaclasses.

## 13. Summary

- **Single inheritance**: `class Child(Parent)` — simple, widely used.
- **`super()`**: Always use `super()` instead of hardcoded parent names — it respects MRO.
- **MRO**: C3 linearization; `Child.__mro__` tells you the lookup order.
- **Diamond problem**: Cooperative multiple inheritance with `super()` resolves it cleanly.
- **Name mangling**: `__name` becomes `_Classname__name` — convention, not security.
- **ABC**: `@abstractmethod` enforces method implementation contracts.
- **Composition over inheritance**: When "has-a" fits better than "is-a", prefer wrapping.
- **`__init_subclass__`**: Hook subclass creation for plugin/registry patterns.
