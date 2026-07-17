---
title: Java Stream Practical Guide
date: 2026-06-05
description: map, filter, sorted, collect — master Java 8 Stream API with practical examples covering sorting, grouping, Top N, and common pitfalls.
---

# Java Stream Practical Guide

Stream is a core feature introduced in Java 8, making collection operations concise, readable, and naturally parallel-ready. This guide covers common operations and pitfalls.

## 1. Quick Start: map + distinct

```java
List<Integer> numbers = Arrays.asList(3, 2, 2, 3, 7, 3, 5);

// Square each element → deduplicate
List<Integer> result = numbers.stream()
        .map(i -> i * i)          // map: square
        .distinct()               // deduplicate
        .collect(Collectors.toList());

System.out.println(result); // [9, 4, 49, 25]
```

**Key points**: `map` is one-to-one mapping; `distinct` relies on `equals/hashCode` — custom objects need proper overrides.

## 2. filter + map + sorted + limit Combo

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);

// Filter even → square → reverse sort → take top 2
List<Integer> top2 = numbers.stream()
        .filter(x -> x % 2 == 0)              // filter evens
        .map(x -> x * x)                       // square
        .sorted(Comparator.reverseOrder())     // reverse sort
        .limit(2)                              // take top 2
        .collect(Collectors.toList());

System.out.println(top2); // [36, 16]
```

**Pipeline execution order**: filter → map → sorted → limit. Each element flows through the entire pipeline (lazy evaluation), except `sorted` which needs all data before sorting.

---

## 3. Object Sorting: Ascending & Descending

In practice, you'll mostly sort object lists:

```java
List<User> users = Arrays.asList(
        new User("Alice", 28, 8000),
        new User("Bob", 22, 12000),
        new User("Charlie", 28, 10000)
);

// === Ascending: by age ===
users.sort(Comparator.comparingInt(User::getAge));
// Or
List<User> sorted = users.stream()
        .sorted(Comparator.comparingInt(User::getAge))
        .collect(Collectors.toList());

// === Descending: by age ===
users.sort(Comparator.comparingInt(User::getAge).reversed());

// === Multi-level: age ascending, then salary descending ===
users.sort(Comparator.comparingInt(User::getAge)
        .thenComparing(Comparator.comparingInt(User::getSalary).reversed()));
```

**Key points**:

| Method | Description |
|--------|-------------|
| `comparingInt` | Sort by int field (more efficient than `comparing`, avoids boxing) |
| `comparing` | Sort by object field, e.g., `Comparator.comparing(User::getName)` |
| `reversed()` | Reverse sort direction |
| `thenComparing` | Multi-level sort, secondary sort when primary is equal |

### Advanced Sorting Patterns

```java
// Custom comparison: name length descending
users.sort(Comparator.comparingInt(u -> -u.getName().length()));

// Null handling: nulls last
users.sort(Comparator.nullsLast(Comparator.comparingInt(User::getAge)));

// Chained example: by department → salary descending → hire date
employees.stream()
        .sorted(Comparator.comparing(Employee::getDept)
                .thenComparing(Employee::getSalary, Comparator.reverseOrder())
                .thenComparing(Employee::getHireDate))
        .collect(Collectors.toList());
```

---

## 4. Advanced filter

```java
// Single condition
List<User> highSalary = users.stream()
        .filter(u -> u.getSalary() > 10000)
        .collect(Collectors.toList());

// Multiple conditions
List<User> result = users.stream()
        .filter(u -> u.getAge() > 25)
        .filter(u -> u.getSalary() > 8000)
        .collect(Collectors.toList());

// Negation
List<User> notRich = users.stream()
        .filter(u -> !(u.getSalary() > 10000))
        .collect(Collectors.toList());

// Readable chained conditions
List<User> target = users.stream()
        .filter(u -> {
            boolean ageOk = u.getAge() >= 25 && u.getAge() <= 35;
            boolean salaryOk = u.getSalary() >= 10000;
            return ageOk && salaryOk;
        })
        .collect(Collectors.toList());
```

---

## 5. Top N: Practical Scenarios

Extract the top N elements from a collection:

```java
// Top 3 by salary
List<User> top3BySalary = users.stream()
        .sorted(Comparator.comparingInt(User::getSalary).reversed())
        .limit(3)
        .collect(Collectors.toList());

// Youngest 2
List<User> youngest2 = users.stream()
        .sorted(Comparator.comparingInt(User::getAge))
        .limit(2)
        .collect(Collectors.toList());

// Composite ranking: highest salary/age ratio
List<User> topEfficient = users.stream()
        .sorted(Comparator.comparingDouble(
                (User u) -> (double) u.getSalary() / u.getAge()).reversed())
        .limit(5)
        .collect(Collectors.toList());
```

---

## 6. Other Common Stream Operations

### Common collect Targets

```java
// → List
List<String> names = users.stream().map(User::getName).collect(Collectors.toList());

// → Set (dedup)
Set<String> depts = users.stream().map(User::getDept).collect(Collectors.toSet());

// → Map (keys must be unique)
Map<Integer, User> idMap = users.stream()
        .collect(Collectors.toMap(User::getId, Function.identity()));

// → Map (keep latter on duplicate key)
Map<Integer, User> idMap2 = users.stream()
        .collect(Collectors.toMap(User::getId, u -> u, (old, newVal) -> newVal));

// → Grouping
Map<String, List<User>> byDept = users.stream()
        .collect(Collectors.groupingBy(User::getDept));

// → Join strings
String nameStr = users.stream()
        .map(User::getName)
        .collect(Collectors.joining(", "));
```

### Numeric Statistics

```java
IntSummaryStatistics stats = users.stream()
        .mapToInt(User::getAge)
        .summaryStatistics();

System.out.println("Max: " + stats.getMax());
System.out.println("Min: " + stats.getMin());
System.out.println("Avg: " + stats.getAverage());
System.out.println("Sum: " + stats.getSum());
System.out.println("Count: " + stats.getCount());
```

### findFirst / anyMatch / allMatch

```java
// Find first match
Optional<User> first = users.stream()
        .filter(u -> u.getAge() > 30)
        .findFirst();

// Any match
boolean hasRich = users.stream().anyMatch(u -> u.getSalary() > 10000);

// All match
boolean allAdult = users.stream().allMatch(u -> u.getAge() >= 18);

// flatMap: flatten nested collections
List<String> allTags = articles.stream()
        .flatMap(a -> a.getTags().stream())
        .distinct()
        .collect(Collectors.toList());
```

---

## 7. ⚠️ Common Pitfalls

### Arrays.asList Trap

```java
Integer[] arr = {1, 2, 3};
List<Integer> list = Arrays.asList(arr);

list.set(0, 999);    // modify list
System.out.println(arr[0]); // outputs 999! array also changed!
```

**Reason**: `Arrays.asList` returns a list view backed by the same array. It doesn't support `add/remove` (fixed size).

**Correct approach**:
```java
List<Integer> list = new ArrayList<>(Arrays.asList(arr));
```

### Stream Can Only Be Consumed Once

```java
Stream<Integer> s = list.stream();
s.filter(x -> x > 0);       // OK
s.map(x -> x * 2);          // ❌ IllegalStateException: stream has already been operated upon
```

### Parallel Stream Thread Safety

```java
// ❌ Not thread-safe
List<Integer> result = new ArrayList<>();
list.parallelStream().map(x -> x * 2).forEach(result::add);

// ✅ Use collect
List<Integer> result = list.parallelStream()
        .map(x -> x * 2)
        .collect(Collectors.toList());
```

---

## 8. 💡 Core Summary

| Operation | Type | Description |
|-----------|------|-------------|
| `filter` | Intermediate | Keep elements matching condition |
| `map` / `mapToInt` | Intermediate | Transform element type |
| `flatMap` | Intermediate | Flatten nested collections |
| `distinct` | Intermediate | Dedup (relies on equals/hashCode) |
| `sorted` | Intermediate | Sort, stateful operation |
| `limit` / `skip` | Intermediate | Take first N / skip first N |
| `peek` | Intermediate | Debug, inspect pipeline elements |
| `collect` | Terminal | Collect to collection/Map/string |
| `forEach` | Terminal | Iterate |
| `reduce` | Terminal | Aggregate computation |
| `count` | Terminal | Count |
| `findFirst` / `findAny` | Terminal | Find |
| `anyMatch` / `allMatch` / `noneMatch` | Terminal | Short-circuit matching |

**Three things to remember**:
1. **Lazy evaluation** — intermediate ops don't trigger execution; terminal ops do
2. **Short-circuiting** — `limit`, `findFirst`, `anyMatch` don't need to process all data
3. **Non-reusable** — Stream is closed after one consumption; recreate if needed
