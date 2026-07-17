---
title: ES5 JavaScript Object Inheritance
date: 2026-06-12
description: Understand prototype chains, constructor borrowing, and Object.create — master ES5 inheritance before reaching for ES6 class sugar.
---

# ES5 JavaScript Object Inheritance

ES6's `class` syntax sugar is convenient, but understanding ES5 prototypal inheritance is essential to truly mastering JavaScript. This article covers prototype chains, constructor inheritance, and composition inheritance from scratch.

## 1. Prototype Chain Basics

Every JS object has a hidden `[[Prototype]]` link pointing to another object. Access it via `__proto__` (non-standard but widely supported) or `Object.getPrototypeOf()`.

```javascript
const parent = { name: 'parent' };
const child = Object.create(parent);
child.age = 10;

console.log(child.name);     // 'parent' — from prototype
console.log(child.age);      // 10       — own property
console.log(child.__proto__ === parent); // true
```

**Lookup rule**: When accessing a property, JS first checks the object itself. If not found, it follows the `__proto__` chain upward until `null`.

---

## 2. Constructor + prototype Inheritance

This is the most classic ES5 inheritance pattern:

```javascript
// Parent constructor
function Animal(name) {
    this.name = name;
}
Animal.prototype.sayName = function () {
    console.log('I am ' + this.name);
};

// Child constructor
function Dog(name, breed) {
    Animal.call(this, name);   // Step 1: inherit instance properties
    this.breed = breed;
}

// Step 2: inherit prototype methods
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;  // fix constructor reference

// Step 3: extend child methods
Dog.prototype.bark = function () {
    console.log(this.name + ' woof!');
};

var dog = new Dog('Buddy', 'Shiba Inu');
dog.sayName();  // I am Buddy
dog.bark();     // Buddy woof!
```

**Three steps**:
1. `Parent.call(this, ...)` — inherit instance properties
2. `Child.prototype = Object.create(Parent.prototype)` — inherit prototype methods
3. `Child.prototype.constructor = Child` — fix constructor reference

---

## 3. Prototype Chain Diagram

```
dog instance
  ├── name: 'Buddy'          (own property, assigned by Dog constructor)
  ├── breed: 'Shiba Inu'     (own property)
  └── __proto__ → Dog.prototype
                    ├── bark()
                    ├── constructor → Dog
                    └── __proto__ → Animal.prototype
                                      ├── sayName()
                                      └── __proto__ → Object.prototype
                                                        └── __proto__ → null
```

Verification:

```javascript
console.log(dog instanceof Dog);     // true
console.log(dog instanceof Animal);  // true
console.log(dog instanceof Object);  // true
```

---

## 4. Three Inheritance Patterns Compared

### ❌ Wrong Pattern 1: Direct Prototype Assignment

```javascript
Dog.prototype = Animal.prototype;
// Problem: modifying Dog.prototype affects Animal.prototype — parent-child coupling
```

### ❌ Wrong Pattern 2: new Parent Instance

```javascript
Dog.prototype = new Animal();
// Problem 1: invokes parent constructor, potential side effects
// Problem 2: parent instance properties leak into child prototype
```

### ✅ Correct Pattern: Object.create

```javascript
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
// Only inherits prototype methods, doesn't execute parent constructor, clean and pure
```

---

## 5. Multi-Level Inheritance Chain

```javascript
function Animal(name) {
    this.name = name;
}
Animal.prototype.eat = function () {
    console.log(this.name + ' is eating');
};

function Mammal(name, hasFur) {
    Animal.call(this, name);
    this.hasFur = hasFur;
}
Mammal.prototype = Object.create(Animal.prototype);
Mammal.prototype.constructor = Mammal;
Mammal.prototype.feedMilk = function () {
    console.log(this.name + ' nurses');
};

function Cat(name, color) {
    Mammal.call(this, name, true);
    this.color = color;
}
Cat.prototype = Object.create(Mammal.prototype);
Cat.prototype.constructor = Cat;
Cat.prototype.meow = function () {
    console.log(this.name + ' meow~');
};

var cat = new Cat('Mimi', 'orange');
cat.eat();       // Mimi is eating
cat.feedMilk();  // Mimi nurses
cat.meow();      // Mimi meow~
console.log(cat.hasFur);  // true
console.log(cat.color);   // orange
```

---

## 6. Creating an inherits Utility

Repeating `Object.create` + `constructor` is tedious — wrap it:

```javascript
function inherits(Child, Parent) {
    Child.prototype = Object.create(Parent.prototype);
    Child.prototype.constructor = Child;
    // convenience for calling parent methods from child
    Child._super = Parent.prototype;
}

// Usage
function Animal(name) { this.name = name; }
Animal.prototype.say = function () { console.log(this.name); };

function Dog(name, breed) {
    Animal.call(this, name);
    this.breed = breed;
}
inherits(Dog, Animal);

Dog.prototype.say = function () {
    Dog._super.say.call(this);  // call parent method
    console.log('Breed: ' + this.breed);
};

var dog = new Dog('Rex', 'Golden Retriever');
dog.say();
// Rex
// Breed: Golden Retriever
```

---

## 7. hasOwnProperty and Prototype Property Distinction

```javascript
function Person(name) {
    this.name = name;
}
Person.prototype.species = 'Human';

var p = new Person('Alice');

console.log(p.name);                  // 'Alice'    — own property
console.log(p.species);               // 'Human'    — prototype property

// Distinguish own vs prototype
console.log(p.hasOwnProperty('name'));    // true
console.log(p.hasOwnProperty('species')); // false

// Iterate own properties only
for (var key in p) {
    if (p.hasOwnProperty(key)) {
        console.log('own: ' + key);   // only outputs name
    }
}

// Get all keys (including prototype)
console.log(Object.keys(p));                      // ['name']    — own only
console.log(Object.getOwnPropertyNames(p));       // ['name']    — own only
```

---

## 8. Detecting Prototype Relationships

```javascript
function A() {}
function B() {}
B.prototype = Object.create(A.prototype);

var b = new B();

// Method 1: instanceof — checks if prototype exists in the chain
console.log(b instanceof B);      // true
console.log(b instanceof A);      // true
console.log(b instanceof Object); // true

// Method 2: isPrototypeOf
console.log(B.prototype.isPrototypeOf(b));    // true
console.log(A.prototype.isPrototypeOf(b));    // true

// Method 3: get prototype
console.log(Object.getPrototypeOf(b) === B.prototype); // true
```

---

## 9. Practical: OOP Component Development

Build a simple UI component system with ES5 inheritance:

```javascript
// Base component
function Component(el) {
    this.el = document.querySelector(el);
}
Component.prototype.show = function () {
    this.el.style.display = 'block';
};
Component.prototype.hide = function () {
    this.el.style.display = 'none';
};

// Dialog component extends base component
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

## 10. 💡 Core Summary

| Concept | Description |
|---------|-------------|
| `__proto__` | Link from object to its prototype (actual property is `[[Prototype]]`) |
| `prototype` | Function-only property, used as prototype for instances created by that function |
| `new F()` | Creates object, `__proto__` points to `F.prototype`, executes constructor |
| `Object.create(proto)` | Creates object with specified `__proto__`, doesn't execute constructor |
| `Parent.call(this)` | Constructor borrowing, inherits instance properties |
| `instanceof` | Checks if `prototype` exists in object's prototype chain |
| `hasOwnProperty` | Checks if property belongs to the object itself (not prototype) |

**Remember**:
- `prototype` belongs to functions only; `__proto__` belongs to all objects
- Inheritance relies on the `__proto__` chain, not `prototype`
- `Object.create` is better than `new` for prototype inheritance because it doesn't execute the constructor

```javascript
// One-line distinction
function Foo() {}         // Foo.prototype exists
var obj = new Foo();      // obj.__proto__ === Foo.prototype

// prototype is for "sharing methods" with instances
// __proto__ is for "looking up properties" up the chain
```
