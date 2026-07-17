---
title: Java Stream 实战指南
date: 2026-06-05
description: map、filter、sorted、collect —— 从入门到进阶，掌握 Java 8 Stream API，涵盖排序、分组、Top N 与常见踩坑。
---

# Java Stream 实战指南

Stream 是 Java 8 引入的核心特性，它让集合操作变得简洁、可读、且天然支持并行。本文从实战出发，涵盖常用操作与易错点。

## 1. 快速入门：map + distinct

```java
List<Integer> numbers = Arrays.asList(3, 2, 2, 3, 7, 3, 5);

// 每个元素平方 → 去重
List<Integer> result = numbers.stream()
        .map(i -> i * i)          // 映射：平方
        .distinct()               // 去重
        .collect(Collectors.toList());

System.out.println(result); // [9, 4, 49, 25]
```

**知识点**：`map` 是一对一映射；`distinct` 依赖 `equals/hashCode`，自定义对象需要正确覆写。

## 2. filter + map + sorted + limit 组合拳

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6);

// 过滤偶数 → 平方 → 倒序 → 取前2
List<Integer> top2 = numbers.stream()
        .filter(x -> x % 2 == 0)              // 过滤偶数
        .map(x -> x * x)                       // 平方
        .sorted(Comparator.reverseOrder())     // 倒序排列
        .limit(2)                              // 取前2
        .collect(Collectors.toList());

System.out.println(top2); // [36, 16]
```

**管道执行顺序**：filter → map → sorted → limit，每个元素依次走完整个管道（惰性求值），sorted 例外需要全部数据才能排序。

---

## 3. 对象排序：正向 & 反向

实际开发中更多是对对象列表排序：

```java
List<User> users = Arrays.asList(
        new User("张三", 28, 8000),
        new User("李四", 22, 12000),
        new User("王五", 28, 10000)
);

// === 正序：按年龄升序 ===
users.sort(Comparator.comparingInt(User::getAge));
// 或
List<User> sorted = users.stream()
        .sorted(Comparator.comparingInt(User::getAge))
        .collect(Collectors.toList());

// === 倒序：按年龄降序 ===
users.sort(Comparator.comparingInt(User::getAge).reversed());

// === 多级排序：先年龄升序，年龄相同按薪资降序 ===
users.sort(Comparator.comparingInt(User::getAge)
        .thenComparing(Comparator.comparingInt(User::getSalary).reversed()));
```

**知识点**：

| 方式 | 说明 |
|------|------|
| `comparingInt` | 按 int 字段排序（比 `comparing` 更高效，避免装箱） |
| `comparing` | 按对象字段排序，如 `Comparator.comparing(User::getName)` |
| `reversed()` | 翻转排序方向 |
| `thenComparing` | 多级排序，主排序相同时启用次级排序 |

### 更复杂的排序写法

```java
// 自定义比较逻辑：名字长度降序
users.sort(Comparator.comparingInt(u -> -u.getName().length()));

// 空值处理：null 排最后
users.sort(Comparator.nullsLast(Comparator.comparingInt(User::getAge)));

// 链式写法示例：按部门 → 薪资降序 → 入职日期
employees.stream()
        .sorted(Comparator.comparing(Employee::getDept)
                .thenComparing(Employee::getSalary, Comparator.reverseOrder())
                .thenComparing(Employee::getHireDate))
        .collect(Collectors.toList());
```

---

## 4. 对象过滤 filter 进阶

```java
// 单一条件
List<User> highSalary = users.stream()
        .filter(u -> u.getSalary() > 10000)
        .collect(Collectors.toList());

// 多条件组合
List<User> result = users.stream()
        .filter(u -> u.getAge() > 25)
        .filter(u -> u.getSalary() > 8000)
        .collect(Collectors.toList());

// 条件取反
List<User> notRich = users.stream()
        .filter(u -> !(u.getSalary() > 10000))
        .collect(Collectors.toList());

// 链式条件的可读写法
List<User> target = users.stream()
        .filter(u -> {
            boolean ageOk = u.getAge() >= 25 && u.getAge() <= 35;
            boolean salaryOk = u.getSalary() >= 10000;
            return ageOk && salaryOk;
        })
        .collect(Collectors.toList());
```

---

## 5. Top N：实战场景

从集合中取出排名前 N 的元素：

```java
// 薪资最高的 3 个用户
List<User> top3BySalary = users.stream()
        .sorted(Comparator.comparingInt(User::getSalary).reversed())
        .limit(3)
        .collect(Collectors.toList());

// 年龄最小的 2 个
List<User> youngest2 = users.stream()
        .sorted(Comparator.comparingInt(User::getAge))
        .limit(2)
        .collect(Collectors.toList());

// 综合排序取 Top N：按 (薪资/年龄) 比值最高
List<User> topEfficient = users.stream()
        .sorted(Comparator.comparingDouble(
                (User u) -> (double) u.getSalary() / u.getAge()).reversed())
        .limit(5)
        .collect(Collectors.toList());
```

---

## 6. 其他高频 Stream 操作

### collect 的常见目标

```java
// → List
List<String> names = users.stream().map(User::getName).collect(Collectors.toList());

// → Set（去重）
Set<String> depts = users.stream().map(User::getDept).collect(Collectors.toSet());

// → Map（key 不能重复）
Map<Integer, User> idMap = users.stream()
        .collect(Collectors.toMap(User::getId, Function.identity()));

// → Map（key 重复时取后者）
Map<Integer, User> idMap2 = users.stream()
        .collect(Collectors.toMap(User::getId, u -> u, (old, newVal) -> newVal));

// → 分组
Map<String, List<User>> byDept = users.stream()
        .collect(Collectors.groupingBy(User::getDept));

// → 拼接字符串
String nameStr = users.stream()
        .map(User::getName)
        .collect(Collectors.joining(", "));
```

### 数值统计

```java
IntSummaryStatistics stats = users.stream()
        .mapToInt(User::getAge)
        .summaryStatistics();

System.out.println("最大: " + stats.getMax());
System.out.println("最小: " + stats.getMin());
System.out.println("平均: " + stats.getAverage());
System.out.println("总和: " + stats.getSum());
System.out.println("数量: " + stats.getCount());
```

### findFirst / anyMatch / allMatch

```java
// 找到第一个匹配的
Optional<User> first = users.stream()
        .filter(u -> u.getAge() > 30)
        .findFirst();

// 是否存在
boolean hasRich = users.stream().anyMatch(u -> u.getSalary() > 10000);

// 是否全部满足
boolean allAdult = users.stream().allMatch(u -> u.getAge() >= 18);

// flatMap：展开嵌套集合
List<String> allTags = articles.stream()
        .flatMap(a -> a.getTags().stream())
        .distinct()
        .collect(Collectors.toList());
```

---

## 7. ⚠️ 易错点

### Arrays.asList 的陷阱

```java
Integer[] arr = {1, 2, 3};
List<Integer> list = Arrays.asList(arr);

list.set(0, 999);    // 修改 List
System.out.println(arr[0]); // 输出 999！数组也被改了！
```

**原因**：`Arrays.asList` 返回的 List 是数组的视图，底层共用同一个数组。不支持 `add/remove`（固定大小）。

**正确做法**：
```java
List<Integer> list = new ArrayList<>(Arrays.asList(arr));
```

### Stream 只能消费一次

```java
Stream<Integer> s = list.stream();
s.filter(x -> x > 0);       // OK
s.map(x -> x * 2);          // ❌ IllegalStateException: stream has already been operated upon
```

### 并行流线程安全

```java
// ❌ 非线程安全
List<Integer> result = new ArrayList<>();
list.parallelStream().map(x -> x * 2).forEach(result::add);

// ✅ 使用 collect
List<Integer> result = list.parallelStream()
        .map(x -> x * 2)
        .collect(Collectors.toList());
```

---

## 8. 💡 核心知识点总结

| 操作 | 类型 | 说明 |
|------|------|------|
| `filter` | 中间操作 | 过滤，保留满足条件的 |
| `map` / `mapToInt` | 中间操作 | 转换元素类型 |
| `flatMap` | 中间操作 | 扁平化嵌套集合 |
| `distinct` | 中间操作 | 去重（依赖 equals/hashCode） |
| `sorted` | 中间操作 | 排序，有状态操作 |
| `limit` / `skip` | 中间操作 | 截取前 N / 跳过前 N |
| `peek` | 中间操作 | 调试用，查看管道中元素 |
| `collect` | 终止操作 | 收集到集合/Map/字符串 |
| `forEach` | 终止操作 | 遍历 |
| `reduce` | 终止操作 | 聚合计算 |
| `count` | 终止操作 | 计数 |
| `findFirst` / `findAny` | 终止操作 | 查找 |
| `anyMatch` / `allMatch` / `noneMatch` | 终止操作 | 短路匹配 |

**记住三点**：
1. **惰性求值** — 中间操作不触发计算，终止操作才执行
2. **短路** — `limit`、`findFirst`、`anyMatch` 不需要处理全部数据
3. **不可重用** — Stream 消费一次后关闭，需要重新创建
