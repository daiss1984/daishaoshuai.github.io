---
title: ES5 JavaScript 对象继承
---

# ES5 JavaScript 对象继承

ES6 的 `class` 语法糖很好用，但理解 ES5 的原型继承才能真正掌握 JavaScript。本文从零梳理原型链、构造函数继承与组合继承。

## 1. 原型链基础

每个 JS 对象都有一个隐藏的 `[[Prototype]]` 链接，指向另一个对象。通过 `__proto__`（非标准但广泛支持）或 `Object.getPrototypeOf()` 访问。

```javascript
const parent = { name: 'parent' };
const child = Object.create(parent);
child.age = 10;

console.log(child.name);     // 'parent' —— 来自原型
console.log(child.age);      // 10       —— 自身属性
console.log(child.__proto__ === parent); // true
```

**查找规则**：访问属性时，先从自身找，找不到就沿着 `__proto__` 链向上找，直到 `null`。

---

## 2. 构造函数 + prototype 继承

这是 ES5 中最经典的继承模式：

```javascript
// 父类构造函数
function Animal(name) {
    this.name = name;
}
Animal.prototype.sayName = function () {
    console.log('我是 ' + this.name);
};

// 子类构造函数
function Dog(name, breed) {
    Animal.call(this, name);   // 第1步：继承实例属性
    this.breed = breed;
}

// 第2步：继承原型方法
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;  // 修复 constructor 指向

// 第3步：扩展子类方法
Dog.prototype.bark = function () {
    console.log(this.name + ' 汪汪！');
};

var dog = new Dog('旺财', '柴犬');
dog.sayName();  // 我是 旺财
dog.bark();     // 旺财 汪汪！
```

**三步走**：
1. `Parent.call(this, ...)` — 继承实例属性
2. `Child.prototype = Object.create(Parent.prototype)` — 继承原型方法
3. `Child.prototype.constructor = Child` — 修复构造器指向

---

## 3. 图解原型链

```
dog 实例
  ├── name: '旺财'          (自身属性，由 Dog 构造函数赋值)
  ├── breed: '柴犬'         (自身属性)
  └── __proto__ → Dog.prototype
                    ├── bark()
                    ├── constructor → Dog
                    └── __proto__ → Animal.prototype
                                      ├── sayName()
                                      └── __proto__ → Object.prototype
                                                        └── __proto__ → null
```

验证一下：

```javascript
console.log(dog instanceof Dog);     // true
console.log(dog instanceof Animal);  // true
console.log(dog instanceof Object);  // true
```

---

## 4. 继承的三种常见写法对比

### ❌ 错误写法 1：直接赋值原型

```javascript
Dog.prototype = Animal.prototype;
// 问题：修改 Dog.prototype 会影响 Animal.prototype，父子耦合
```

### ❌ 错误写法 2：new 父类实例

```javascript
Dog.prototype = new Animal();
// 问题1：调用了父类构造函数，可能产生副作用
// 问题2：父类实例属性混入子类原型
```

### ✅ 正确写法：Object.create

```javascript
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
// 只继承原型方法，不执行父类构造函数，干净纯粹
```

---

## 5. 多层继承链

```javascript
function Animal(name) {
    this.name = name;
}
Animal.prototype.eat = function () {
    console.log(this.name + ' 吃东西');
};

function Mammal(name, hasFur) {
    Animal.call(this, name);
    this.hasFur = hasFur;
}
Mammal.prototype = Object.create(Animal.prototype);
Mammal.prototype.constructor = Mammal;
Mammal.prototype.feedMilk = function () {
    console.log(this.name + ' 哺乳');
};

function Cat(name, color) {
    Mammal.call(this, name, true);
    this.color = color;
}
Cat.prototype = Object.create(Mammal.prototype);
Cat.prototype.constructor = Cat;
Cat.prototype.meow = function () {
    console.log(this.name + ' 喵喵~');
};

var cat = new Cat('咪咪', '橘色');
cat.eat();       // 咪咪 吃东西
cat.feedMilk();  // 咪咪 哺乳
cat.meow();      // 咪咪 喵喵~
console.log(cat.hasFur);  // true
console.log(cat.color);   // 橘色
```

---

## 6. 封装一个 inherits 工具函数

重复写 `Object.create` + `constructor` 很烦，封装一下：

```javascript
function inherits(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
    // 方便在子类方法中调用父类方法
    Child._super = Parent.prototype;
}

// 使用
function Animal(name) { this.name = name; }
Animal.prototype.say = function () { console.log(this.name); };

function Dog(name, breed) {
    Animal.call(this, name);
    this.breed = breed;
}
inherits(Dog, Animal);

Dog.prototype.say = function () {
    Dog._super.say.call(this);  // 调用父类方法
    console.log('品种：' + this.breed);
};

var dog = new Dog('阿黄', '金毛');
dog.say();
// 阿黄
// 品种：金毛
```

---

## 7. hasOwnProperty 与原型属性区分

```javascript
function Person(name) {
    this.name = name;
}
Person.prototype.species = '人类';

var p = new Person('张三');

console.log(p.name);                  // '张三'    —— 自身属性
console.log(p.species);               // '人类'    —— 原型属性

// 区分自身 vs 原型
console.log(p.hasOwnProperty('name'));    // true
console.log(p.hasOwnProperty('species')); // false

// 遍历自身属性
for (var key in p) {
    if (p.hasOwnProperty(key)) {
        console.log('自身: ' + key);   // 只输出 name
    }
}

// 获取所有 key（含原型）
console.log(Object.keys(p));                      // ['name']    —— 只自身
console.log(Object.getOwnPropertyNames(p));       // ['name']    —— 只自身
```

---

## 8. 检测原型关系

```javascript
function A() {}
function B() {}
B.prototype = Object.create(A.prototype);

var b = new B();

// 方式1：instanceof —— 检查原型链上是否存在
console.log(b instanceof B);      // true
console.log(b instanceof A);      // true
console.log(b instanceof Object); // true

// 方式2：isPrototypeOf
console.log(B.prototype.isPrototypeOf(b));    // true
console.log(A.prototype.isPrototypeOf(b));    // true

// 方式3：获取原型
console.log(Object.getPrototypeOf(b) === B.prototype); // true
```

---

## 9. 实战：面向对象组件开发

用 ES5 继承写一个简单的 UI 组件体系：

```javascript
// 基础组件
function Component(el) {
    this.el = document.querySelector(el);
}
Component.prototype.show = function () {
    this.el.style.display = 'block';
};
Component.prototype.hide = function () {
    this.el.style.display = 'none';
};

// 弹窗组件继承基础组件
function Dialog(el, title) {
    Component.call(this, el);
    this.title = title;
}
inherits(Dialog, Component);

Dialog.prototype.open = function () {
    this.el.querySelector('.title').textContent = this.title;
    this.show();
};
Dialog.prototype.close = function () {
    this.hide();
};
```

---

## 10. 💡 核心知识点总结

| 概念 | 说明 |
|------|------|
| `__proto__` | 对象到其原型的链接（实际属性为 `[[Prototype]]`） |
| `prototype` | 函数特有的属性，作为该函数创建的实例的原型 |
| `new F()` | 创建对象，`__proto__` 指向 `F.prototype`，执行构造函数 |
| `Object.create(proto)` | 创建对象，直接指定 `__proto__`，不执行构造函数 |
| `Parent.call(this)` | 构造函数借用，继承实例属性 |
| `instanceof` | 检查 `prototype` 是否在对象的原型链上 |
| `hasOwnProperty` | 判断属性是否属于对象自身（非原型） |

**记住**：
- `prototype` 是函数才有的，`__proto__` 是所有对象都有的
- 继承靠的是 `__proto__` 链，不是 `prototype`
- `Object.create` 比 `new` 更适合做原型继承，因为它不执行构造函数

```javascript
// 一句话区分
function Foo() {}         // Foo.prototype 存在
var obj = new Foo();      // obj.__proto__ === Foo.prototype

// prototype 是用来给实例"共享方法"的
// __proto__ 是用来"往上找属性"的
```
