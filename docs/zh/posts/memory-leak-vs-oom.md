---
title: 内存泄漏 vs 内存溢出 —— 面试常考题
date: 2026-07-05
description: 内存泄漏是"病"，OOM 是"死"。详解 7 种经典 Java 泄漏场景、jstat/jmap/MAT 排查步骤与 JVM 调优策略。
---

# 内存泄漏 vs 内存溢出 —— 面试常考题

> **内存泄漏（Memory Leak）** 是程序逻辑缺陷，对象用完没释放，GC 无法回收。  
> **内存溢出（OOM）** 是内存被耗尽的最终异常结果。  
> 一因一果，但面试官经常问你"有什么区别？"

## 1. 一句话区分

| | 内存泄漏 (Memory Leak) | 内存溢出 (OutOfMemoryError) |
|------|------|------|
| **本质** | 程序 Bug，对象"忘了删" | 资源耗尽，JVM 撑不住了 |
| **现象** | 内存持续增长，GC 频率升高 | 直接抛 `OutOfMemoryError`，进程崩溃 |
| **原因** | 代码缺陷（忘关资源、静态集合无限增长等） | 泄漏累积、堆太小、大对象、线程过多 |
| **检测** | 监控工具 + Heap Dump 分析 | 日志中直接看到 |
| **修复** | 改代码，释放引用 | 改代码 + 调大堆 + 优化 |

**一句话**：内存泄漏是"**病**"，OOM 是"**死**"。泄漏拖久了必 OOM。

## 2. Java 常见内存泄漏场景

### 2.1 静态集合无限增长

```java
// ❌ 最常见的内存泄漏！
public class DataCache {
    private static final Map<String, Object> cache = new HashMap<>();

    public static void put(String key, Object data) {
        cache.put(key, data);  // 只增不减，GC 永远无法回收
    }
}

// ✅ 修复：用 WeakHashMap 或加淘汰策略
private static final Map<String, Object> cache = new WeakHashMap<>();
// 或者用 Caffeine / Guava Cache 加过期时间
```

### 2.2 忘记关闭资源

```java
// ❌ 连接没关
public void readFile() {
    try {
        FileInputStream fis = new FileInputStream("data.txt");
        // 读数据...
        // 忘了 fis.close()！
    } catch (Exception e) { }
}
// 文件描述符泄漏 → 最终 OOM: unable to create new native thread 或 Too many open files


// ✅ try-with-resources（Java 7+）
public void readFile() {
    try (FileInputStream fis = new FileInputStream("data.txt");
         BufferedReader br = new BufferedReader(new InputStreamReader(fis))) {
        // 自动关闭，不用手动 finally
    } catch (Exception e) { }
}
```

### 2.3 内部类持有外部引用

```java
// ❌ 非静态内部类隐式持有外部类引用
public class MainActivity {
    private List<String> hugeData = new ArrayList<>(); // 10MB 数据

    // 非静态内部类 → 持有 MainActivity.this
    class MyTask extends Thread {
        @Override
        public void run() {
            // 这个线程跑 10 分钟，MainActivity 无法被 GC
            Thread.sleep(10 * 60 * 1000);
        }
    }
}

// ✅ 改为静态内部类 + 弱引用
static class MyTask extends Thread {
    @Override
    public void run() { /* 不持有外部引用 */ }
}
```

### 2.4 ThreadLocal 忘记 remove

```javascript
// ❌ 线程池 + ThreadLocal = 灾难
public class UserContext {
    private static final ThreadLocal<User> currentUser = new ThreadLocal<>();
    public static void set(User u) { currentUser.set(u); }
    // 忘了 remove()！线程复用时，上次的 User 对象永远存在
}

// ✅ 必须在 finally 中 remove
try {
    UserContext.set(user);
    // 业务逻辑
} finally {
    UserContext.remove();  // 必须！
}
```

### 2.5 监听器 / 回调未注销

```java
// ❌ 注册了监听器，但从不注销
button.addActionListener(new ActionListener() {
    @Override
    public void actionPerformed(ActionEvent e) {
        // 这个 listener 持有外部类的引用
    }
});
// 即使外部对象不用了，因为被 listener 引用着，GC 无法回收

// ✅ 用完后移除
listener = e -> doSomething();
button.addActionListener(listener);
// ... 用完后
button.removeActionListener(listener);
```

### 2.6 equals/hashCode 导致的内存泄漏

```java
// ❌ 对象放进 HashSet 后修改了 equals 依赖的字段
Set<Person> set = new HashSet<>();
Person p = new Person("张三", 25);
set.add(p);

p.setName("李四");  // 改了参与 hashCode 的字段！

set.remove(p);  // 删除失败！hashCode 变了，找不到原来的桶位
// p 永远留在 set 里，成为"僵尸对象"
```

### 2.7 字符串 intern 滥用（Java 6/7）

```java
// ❌ Java 6 中 String.intern() 放入 PermGen（永久代）
for (int i = 0; i < 10000000; i++) {
    ("str" + i).intern();  // PermGen OOM！
}
// Java 7+ intern 放入堆，但大量 intern 仍可能撑爆堆
```

## 3. 内存泄漏 → OOM 的过程

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ 少量泄漏  │ ──→  │ GC 频繁  │ ──→  │ FGC 不断 │ ──→  │  OOM！   │
│ 内存慢涨  │      │ 吞吐下降  │      │ STW 变长  │      │ 进程崩溃  │
└──────────┘      └──────────┘      └──────────┘      └──────────┘

典型监控指标变化：
  堆使用率:  ▂▃▄▅▆▇███ (锯齿状上升 — 垃圾回收后降不下来)
  GC 时间:   1% → 5% → 20% → 50%+
  响应时间:  100ms → 500ms → 3s → timeout
```

## 4. OOM 的四种经典类型

| 异常信息 | 原因 | 修复方向 |
|------|------|------|
| `Java heap space` | 堆内存不足 | 查泄漏 + 增大 `-Xmx` |
| `GC overhead limit exceeded` | GC 占用 98% 时间但只回收 <2% 堆 | 堆快满了，查泄漏 |
| `Metaspace` | 元空间（类定义）不足 | `-XX:MaxMetaspaceSize` |
| `unable to create new native thread` | 线程数超限 | 减少线程 / 调大系统限制 |

```bash
# 常见 JVM 参数
-Xms2g -Xmx4g                      # 堆 2-4G
-XX:MaxMetaspaceSize=256m           # 元空间上限
-XX:+HeapDumpOnOutOfMemoryError     # OOM 时自动 dump
-XX:HeapDumpPath=/tmp/heapdump.hprof
```

## 5. 如何排查内存泄漏

### 5.1 监控指标

```bash
# 看堆使用趋势
jstat -gc <pid> 1000 10

# 结果关注：
# OU (Old Used) — 老年代使用量持续上升 = 可能泄漏
# FGC (Full GC 次数) — 频繁 Full GC = 危险信号
```

### 5.2 获取 Heap Dump

```bash
# 方式1：jmap
jmap -dump:live,format=b,file=heap.hprof <pid>

# 方式2：JVM 参数自动 dump（OOM 时）
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/

# 方式3：jcmd
jcmd <pid> GC.heap_dump /tmp/heap.hprof
```

### 5.3 分析思路

用 MAT (Memory Analyzer Tool) 或 JProfiler 打开 dump 文件：

1. **看 Dominator Tree** → 哪个对象占了最多内存？
2. **看 Leak Suspects** → MAT 自动分析可疑泄漏点
3. **看 GC Roots 路径** → 为什么这个对象不能被回收？
4. **对比两份 dump** → 增长最快的对象是哪个？

```
经典排查步骤：
  jstat 观察 → 确认泄漏 → jmap dump → MAT 分析
                                    ↓
                    Dominator Tree → 最大对象
                                    ↓
                    GC Roots 路径 → 谁在引用它？
                                    ↓
                    定位代码 → 修复
```

## 6. 内存泄漏的常见源码特征

```java
// 特征1：容器只 put 不 remove
map.put(key, value);  // 没有对应的 remove

// 特征2：addListener 没有 removeListener
eventSource.addListener(listener);

// 特征3：new Thread / new Runnable 内部类
new Thread(() -> { /* 持有外部 this */ }).start();

// 特征4：ThreadLocal.set 没有 remove

// 特征5：单例持有短生命周期对象
class Singleton {
    private Context context;  // ❌ Activity/Fragment/Request 的引用！
}
```

## 7. 最佳实践

| 原则 | 做法 |
|------|------|
| **资源必关** | 一律 `try-with-resources` |
| **容器有界** | 静态集合用 WeakHashMap 或加 LRU 淘汰 |
| **ThreadLocal 必清** | `finally { threadLocal.remove(); }` |
| **监听必注销** | 注册和注销成对出现 |
| **内部类用静态** | 避免隐式持有外部引用 |
| **OOM 自动 dump** | 加上 `HeapDumpOnOutOfMemoryError` |
| **上线前压测** | 跑一段时间看内存是否稳定在某个值 |

## 8. 💡 面试回答模板

> **"内存泄漏和内存溢出有什么区别？"**

> 内存泄漏是程序 Bug——分配的对象用完后没有被释放，GC 无法回收，导致堆内存持续增长。内存溢出是最终结果——当可用内存耗尽时 JVM 抛出 OutOfMemoryError。  
>
> 两者的关系是**因果关系**：内存泄漏如果持续恶化，最终必然导致 OOM。但 OOM 不一定来自泄漏——也可能是堆配置太小、一次性加载大文件、线程数超限等。  
>
> 排查上，泄漏需要用 jstat 观察内存趋势，用 jmap dump 堆快照，用 MAT 分析 GC Roots 找到是谁持有了不该持有的引用。OOM 则可以直接从日志和异常类型（heap space / metaspace / native thread）快速定位方向。
