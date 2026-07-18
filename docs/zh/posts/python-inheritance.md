---
title: Python 继承
date: 2026-07-18
description: 掌握 Python 的单继承、多继承与多层继承 —— MRO、super()、ABC、组合 vs 继承，以及常见陷阱。
---

# Python 继承

继承是面向对象的核心机制，让类能够复用和扩展另一个类的行为。Python 的继承模型非常灵活——支持单继承、多继承、多层继承——但这种灵活也带来了菱形继承等独特挑战。本文从基础语法到 MRO 内部原理，全面覆盖。

## 1. 为什么需要继承？

没有继承，共享逻辑只能靠复制粘贴：

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

两个 `__init__` 完全一样。继承能消除这种重复：

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

## 2. 单继承

```python
class Vehicle:
    def __init__(self, brand):
        self.brand = brand

    def start(self):
        return f"{self.brand} is starting..."

class Car(Vehicle):
    def __init__(self, brand, doors):
        super().__init__(brand)  # 调用父类的 __init__
        self.doors = doors

    def honk(self):
        return "Beep beep!"

car = Car("Toyota", 4)
print(car.start())  # Toyota is starting...   (继承来的)
print(car.honk())   # Beep beep!              (自己的方法)
```

### `super()` —— 调用父类方法的正确姿势

```python
class A:
    def greet(self):
        return "Hello from A"

class B(A):
    def greet(self):
        parent_greeting = super().greet()  # 不要用 A.greet(self)
        return f"{parent_greeting} and B"

print(B().greet())  # Hello from A and B
```

始终用 `super()` 而不是写死父类名——这在多继承中至关重要。

## 3. MRO（方法解析顺序）

调用一个方法时，Python 按特定顺序查找类。这就是 **MRO**——Method Resolution Order。

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

Python 用 **C3 线性化**算法计算 MRO。两条规则：

1. 子类优先于父类
2. `class D(B, C)` 中的声明顺序被保留

```
       A
      / \
     B   C
      \ /
       D

MRO: D → B → C → A → object
```

如果 MRO 无法同时满足两条规则（比如基类顺序不一致），Python 会在类定义时直接抛出 `TypeError`。

## 4. 多继承与菱形继承问题

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

注意两个关键点：

**1. `B.__init__` 的 `super()` 到达的是 `C`，不是 `A`。**

等等——`B` 声明的是 `class B(A)`，那 `B` 的 `super()` 不应该去 `A` 吗？这是对 `super()` 最常见的误解。

**`super()` 不是"我的父类"。**它的含义是："在 `type(self)` 的 MRO 中，找到当前类，返回下一个类。"

当我们调用 `D()` 时，`self` 是 `D` 的实例。所以 `type(self)` 是 `D`，MRO 是 `D → B → C → A → object`。整个调用链中，**每一个** `super()` 看的都是**同一份 MRO**（`D` 的 MRO），而不是自己所在类的父类：

| `super()` 所在位置 | `type(self)` | MRO 中当前类 | 下一个 → |
|---|---|---|---|
| `D.__init__` | `D` | `D` | **`B`** |
| `B.__init__` | `D` | `B` | **`C`**（不是 `A`！） |
| `C.__init__` | `D` | `C` | **`A`** |
| `A.__init__` | `D` | `A` | `object` |

在 `B.__init__` 内部，`super()` 看到的依然是 `type(self) == D`，在 MRO 中找到 `B`，返回下一个——`C`。`B` 自己声明的父类（`A`）跟这次查找没有任何关系。

每个类都通过调用 `super()` 来协作——这就是**协作式多继承**模式。

**2. `A.__init__` 只打印一次。**虽然 `B` 和 `C` 都继承自 `A`，但 `super()` 的调用链是线性的，不是树状的：

```
D.__init__
  → super() → B.__init__
                → super() → C.__init__   （不是 A！MRO 中 C 在 A 前面）
                              → super() → A.__init__
                                            → super() → object（无操作）
```

`B` 和 `C` 在 MRO 中都排在 `A` 前面。`B` 的 `super()` 先找到 `C`；`C` 的 `super()` 再找到 `A`。所以 `A` 只被经过一次——通过 `C` 的 `super()` 调用。`B` 的 `super()` 永远不会直接调到 `A`。整条链是 **D → B → C → A**，不是两条分开的路径。

如果 `B` 和 `C` 中没有 `super()`，`A.__init__` 会完全被跳过——这是菱形继承最常见的坑。

## 5. 继承的类型

```python
# 单继承
class A: pass
class B(A): pass

# 多层继承
class A: pass
class B(A): pass
class C(B): pass

# 层次继承
class A: pass
class B(A): pass
class C(A): pass

# 多继承
class A: pass
class B: pass
class C(A, B): pass

# 混合继承 — 以上任意组合
```

## 6. `isinstance()` 与 `issubclass()`

```python
class Animal: pass
class Dog(Animal): pass

dog = Dog()

print(isinstance(dog, Dog))      # True
print(isinstance(dog, Animal))   # True  (间接父类也算)
print(isinstance(dog, object))   # True  (万物皆继承自 object)

print(issubclass(Dog, Animal))   # True
print(issubclass(Dog, object))   # True
print(issubclass(Animal, Dog))   # False
```

## 7. 私有成员与名称改写（Name Mangling）

Python 没有真正的私有成员。`__` 前缀会触发**名称改写**：

```python
class Parent:
    def __init__(self):
        self.__secret = 42       # 实际存储为 _Parent__secret

    def reveal(self):
        return self.__secret     # 在类内部访问没问题

class Child(Parent):
    def peek(self):
        return self.__secret     # AttributeError! (找的是 _Child__secret)

p = Parent()
print(p.reveal())                # 42
print(p._Parent__secret)         # 42 (知道改写后的名字依然能访问)
```

名称改写是为了避免子类中的命名冲突，而非安全机制。用单下划线 `_`（如 `self._internal`）作为"受保护"的约定信号即可。

## 8. 抽象基类（ABC）

通过要求子类必须实现某些方法来防止不完整的子类：

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

    # 缺少 perimeter() 实现！

# c = Circle(5)  # TypeError: 无法实例化 —— perimeter 是抽象方法
```

`ABC` + `@abstractmethod` 强制子类实现所有抽象方法后才能实例化。

## 9. `@property` 与继承

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

    # area 自动继承 —— 无需重新定义
    @property
    def side(self):
        return self._width

sq = Square(5)
print(sq.area)  # 25 (从 Rectangle 继承)
print(sq.side)  # 5  (Square 特有)
```

属性和普通方法一样会被继承。这让只读计算属性能轻松在类层级中共享。

## 10. 继承 vs 组合

> "优先组合而非继承"——这句话到底什么意思？

```python
# 继承："是一个"
class Stack(list):  # Stack 是一个 list
    def push(self, item):
        self.append(item)

# 问题：Stack 继承了 list 的所有方法 —— insert()、remove()、sort()...
# 栈不应该允许在中间插入！
```

```python
# 组合："有一个"
class Stack:
    def __init__(self):
        self._items = []        # Stack 内部有一个 list

    def push(self, item):
        self._items.append(item)

    def pop(self):
        return self._items.pop()

    def __len__(self):
        return len(self._items)

# 只暴露 push/pop/len —— 真正的栈语义
```

| | 继承 | 组合 |
|---|---|---|
| 关系 | "是一个" (is-a) | "有一个" (has-a) |
| 耦合度 | 紧密（子类依赖父类内部实现） | 松散（只依赖公开接口） |
| 灵活性 | 定义时固定 | 运行时可以替换实现 |
| 适用场景 | 明确的层级关系、共享接口 | 复用行为但不需要身份一致 |
| Python 示例 | `class Square(Rectangle)` | `Stack` 内部包装 `list` |

## 11. 常见陷阱

### 11.1 忘记调用 `super().__init__()`

```python
class Parent:
    def __init__(self):
        self.data = []

class Child(Parent):
    def __init__(self):
        pass  # 忘了 super().__init__()！

c = Child()
print(c.data)  # AttributeError: 'Child' object has no attribute 'data'
```

### 11.2 父类中的可变默认参数

```python
class Parent:
    def __init__(self, items=[]):     # 危险：所有实例共享同一个列表
        self.items = items

class Child(Parent):
    pass

c1 = Child()
c2 = Child()
c1.items.append(1)
print(c2.items)  # [1] —— 没想到吧？
```

**修复**：`def __init__(self, items=None): self.items = items if items is not None else []`

### 11.3 方法签名不一致

```python
class Parent:
    def connect(self, host, port):
        pass

class Child(Parent):
    def connect(self, url):  # 签名不同 —— 违反里氏替换原则
        pass
```

这破坏了多态。设计层级结构时，确保子类可以替换父类使用。

## 12. `__init_subclass__` —— 钩入子类创建过程

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

强大的钩子，适用于插件系统——无需装饰器或元类即可自动注册子类。

## 13. 总结

- **单继承**：`class Child(Parent)` —— 简单，最常用。
- **`super()`**：始终用 `super()` 而非写死父类名——它遵循 MRO。
- **MRO**：C3 线性化；`Child.__mro__` 查看查找顺序。
- **菱形问题**：协作式多继承 + `super()` 可以干净解决。
- **名称改写**：`__name` → `_Classname__name` —— 约定，不是安全机制。
- **ABC**：`@abstractmethod` 强制方法实现契约。
- **组合优于继承**：当"有一个"比"是一个"更合适时，优先包装。
- **`__init_subclass__`**：钩入子类创建，适合插件/注册模式。
