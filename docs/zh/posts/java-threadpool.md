---
title: Java 多线程与线程池配置
date: 2026-07-18
description: 掌握 Java 多线程基础、ThreadPoolExecutor 七大参数，以及 CPU 密集 vs IO 密集场景下的线程池配置实战指南。
---

# Java 多线程与线程池配置

多线程是 Java 最强大的特性之一——也是最容易出错的。本文先梳理基础概念，然后深入 `ThreadPoolExecutor` 的参数配置：如何为真实负载调优 7 个核心参数。

## 1. 创建线程的三种方式

```java
// 1. 继承 Thread
class MyThread extends Thread {
    public void run() {
        System.out.println("线程运行中");
    }
}
new MyThread().start();

// 2. 实现 Runnable（推荐——任务与线程分离）
class MyRunnable implements Runnable {
    public void run() {
        System.out.println("Runnable 运行中");
    }
}
new Thread(new MyRunnable()).start();

// 3. 实现 Callable —— 可以返回值，可以抛受检异常
class MyCallable implements Callable<String> {
    public String call() throws Exception {
        return "Callable 返回的结果";
    }
}
FutureTask<String> task = new FutureTask<>(new MyCallable());
new Thread(task).start();
System.out.println(task.get()); // 阻塞等待结果
```

| | `Runnable` | `Callable` |
|---|---|---|
| 返回值 | `void` | `V` |
| 受检异常 | 不能抛 | 可以抛 |
| 提交到线程池 | `execute()` / `submit()` | 只能 `submit()` |
| 获取结果 | — | `Future.get()` |

## 2. 线程生命周期 —— 6 种状态

```
         ┌─────────┐
         │   NEW   │  线程创建，尚未 start()
         └────┬────┘
              │ .start()
         ┌────▼────┐
         │ RUNNABLE│  正在运行或等待 CPU 调度
         └────┬────┘
     ┌────────┼────────┐
     │        │        │
┌────▼───┐ ┌──▼──┐ ┌──▼──────────┐
│BLOCKED │ │WAIT-│ │TIMED_WAITING│
│ 阻塞   │ │ ING │ │  超时等待    │
│        │ │等待 │ │              │
│等待锁  │ │join │ │sleep(ms)     │
└────┬───┘ └──┬──┘ └──┬──────────┘
     │        │        │
     └────────┼────────┘
              │ 获取锁 / 被通知 / 超时
         ┌────▼────┐
         │TERMINATED│  执行完毕
         └─────────┘
```

- **NEW**：`new Thread()` 但 `start()` 还没调用
- **RUNNABLE**：JVM 中正在执行（包含 OS 层面的"就绪"状态）
- **BLOCKED**：等待获取 `synchronized` 锁
- **WAITING**：`Object.wait()`、`Thread.join()`、`LockSupport.park()`
- **TIMED_WAITING**：`sleep()`、`wait(timeout)`、`join(timeout)`
- **TERMINATED**：`run()` 执行完毕

## 3. 为什么需要线程池？

反复创建和销毁线程开销很大。线程池复用固定数量的线程来执行任务。

```java
// 差 —— 每个任务创建一个新线程
for (int i = 0; i < 1000; i++) {
    new Thread(() -> doWork()).start();
}

// 好 —— 池化复用
ExecutorService pool = Executors.newFixedThreadPool(10);
for (int i = 0; i < 1000; i++) {
    pool.execute(() -> doWork());
}
pool.shutdown();
```

线程池的好处：

- **降低延迟**：线程预先创建好，没有逐个创建的开销
- **资源可控**：限制并发线程数，防止 CPU/内存耗尽
- **可管理性**：统一的 `execute()`、`shutdown()`、监控接口

## 4. ThreadPoolExecutor —— 七大核心参数

所有 `Executors` 工厂方法都是对 `ThreadPoolExecutor` 的封装：

```java
public ThreadPoolExecutor(
    int corePoolSize,        // ① 核心线程数
    int maximumPoolSize,     // ② 最大线程数
    long keepAliveTime,      // ③ 空闲线程存活时间
    TimeUnit unit,            // ④ 时间单位
    BlockingQueue<Runnable> workQueue,  // ⑤ 任务队列
    ThreadFactory threadFactory,        // ⑥ 线程工厂
    RejectedExecutionHandler handler    // ⑦ 拒绝策略
)
```

### ① `corePoolSize` —— 核心线程数

即使空闲也保持存活的线程数（除非设置 `allowCoreThreadTimeOut`）。

### ② `maximumPoolSize` —— 最大线程数

线程池能容纳的线程数上限。

### ③ `keepAliveTime` —— 空闲存活时间

当线程数超过 `corePoolSize`，空闲线程经过这个时间后被回收。

### ④ `unit` —— 时间单位

`TimeUnit.SECONDS`、`TimeUnit.MILLISECONDS` 等。

### ⑤ `workQueue` —— 任务队列

所有线程都忙时，任务在此排队。队列类型直接影响线程池行为：

| 队列类型 | 行为 | 风险 |
|----------|------|------|
| `SynchronousQueue` | 无容量——每个任务必须立刻有线程承接 | 无空闲线程时直接拒绝 |
| `LinkedBlockingQueue`（无界） | 任务无限排队 | 任务堆积导致 OOM |
| `LinkedBlockingQueue`（有界） | 固定容量队列 | 队列满时触发拒绝 |
| `ArrayBlockingQueue` | 固定容量有界队列 | 同上 |

### ⑥ `threadFactory` —— 线程工厂

自定义线程名、守护状态、优先级：

```java
ThreadFactory factory = r -> {
    Thread t = new Thread(r, "worker-" + counter.incrementAndGet());
    t.setDaemon(false);
    return t;
};
```

### ⑦ `handler` —— 拒绝策略

当线程数达到 `maximumPoolSize` 且队列已满时触发：

| 策略 | 行为 |
|------|------|
| `AbortPolicy`（默认） | 抛出 `RejectedExecutionException` |
| `CallerRunsPolicy` | 由调用者线程自己执行该任务 |
| `DiscardPolicy` | 静默丢弃任务 |
| `DiscardOldestPolicy` | 丢弃队列中最老的任务，然后重试 |

## 5. 内置线程池（以及为什么不该用）

```java
// FixedThreadPool —— core = max = n，无界 LinkedBlockingQueue
Executors.newFixedThreadPool(10);
// ⚠️ 风险：无界队列 → 高负载下 OOM

// CachedThreadPool —— core = 0，max = Integer.MAX_VALUE，SynchronousQueue
Executors.newCachedThreadPool();
// ⚠️ 风险：无上限线程数 → CPU 耗尽

// SingleThreadExecutor —— core = max = 1，无界队列
Executors.newSingleThreadExecutor();
// ⚠️ 风险：无界队列 → OOM

// ScheduledThreadPool —— 用于延迟/周期任务
Executors.newScheduledThreadPool(5);
// ⚠️ 风险：max = Integer.MAX_VALUE
```

> **《阿里巴巴 Java 开发手册》明确规定：禁止使用 `Executors` 创建线程池，必须通过 `new ThreadPoolExecutor(...)` 显式指定参数。**

## 6. 如何配置线程池大小

线程池大小没有万能公式，取决于你的负载类型。

### CPU 密集型

任务持续占用 CPU（计算、加密、压缩）：

```
线程数 = CPU 核数 + 1
```

为什么 +1？当某个线程因缺页中断或短暂 I/O 暂停时，多出的线程可以顶上。

```java
int cores = Runtime.getRuntime().availableProcessors();
int poolSize = cores + 1;
```

### IO 密集型

任务大部分时间在等待（数据库查询、HTTP 调用、文件读写）：

```
线程数 = CPU 核数 * (1 + 平均等待时间 / 平均计算时间)
```

实践中常用简化公式：

```
线程数 = CPU 核数 * 2
```

如果知道阻塞系数：

```
线程数 = CPU 核数 / (1 - 阻塞系数)

// 例如 50% 时间在阻塞（系数 0.5）
// 线程数 = 8 / (1 - 0.5) = 16
```

### 混合场景

将 CPU 密集和 IO 密集任务分离到不同线程池：

```java
@Configuration
public class ThreadPoolConfig {

    @Bean("cpuPool")
    public ExecutorService cpuPool() {
        int cores = Runtime.getRuntime().availableProcessors();
        return new ThreadPoolExecutor(
            cores + 1, cores + 1,
            60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(100),
            new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    @Bean("ioPool")
    public ExecutorService ioPool() {
        int cores = Runtime.getRuntime().availableProcessors();
        return new ThreadPoolExecutor(
            cores * 2, cores * 4,
            60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(500),
            new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }
}
```

## 7. 任务执行流程 —— 逐步拆解

当调用 `execute(task)` 时：

```
             execute(task)
                  │
     ┌────────────▼────────────┐
     │ 当前线程 < corePoolSize？ │
     └────────────┬────────────┘
          是      │     否
     ┌────▼────┐  │
     │ 创建新  │  │
     │  线程   │  │
     └─────────┘  │
                  ▼
     ┌─────────────────────────┐
     │      队列已满？          │
     └────────────┬────────────┘
          否      │     是
     ┌────▼────┐  │
     │ 加入队列 │  │
     └─────────┘  │
                  ▼
     ┌─────────────────────────┐
     │ 当前线程 < maxPoolSize？  │
     └────────────┬────────────┘
          是      │     否
     ┌────▼────┐  │
     │ 创建新  │  │
     │  线程   │  │
     └─────────┘  │
                  ▼
     ┌─────────────────────────┐
     │     执行拒绝策略         │
     └─────────────────────────┘
```

关键认知：**队列先满，然后才创建超过 corePoolSize 的新线程**。如果用了无界队列，`maximumPoolSize` 实际上等于废了。

## 8. 运行时动态调整

`ThreadPoolExecutor` 提供 setter 支持热调优：

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(...);

// 根据监控数据在运行时调整
pool.setCorePoolSize(8);
pool.setMaximumPoolSize(16);
pool.setKeepAliveTime(120, TimeUnit.SECONDS);
```

监控指标：

```java
pool.getPoolSize();           // 当前线程数
pool.getActiveCount();        // 正在执行任务的线程数
pool.getQueue().size();       // 队列中等待的任务数
pool.getCompletedTaskCount(); // 已完成任务总数
```

## 9. 常见陷阱

### 9.1 在线程池内部调用 `Future.get()`

```java
// 死锁风险！
ExecutorService pool = Executors.newFixedThreadPool(2);
Future<String> f1 = pool.submit(() -> {
    Future<String> f2 = pool.submit(() -> "inner");
    return f2.get(); // 等待 f2，但所有线程都忙（包括当前线程）
});
```

**修复**：提交子任务的线程池与父任务分离，或用 `CompletableFuture`。

### 9.2 ThreadLocal 内存泄漏

```java
// 池化线程会跨任务保留 ThreadLocal 值
ThreadLocal<MyContext> ctx = new ThreadLocal<>();

pool.execute(() -> {
    ctx.set(new MyContext());
    // 如果不清理，这个值会和线程一样长寿
    ctx.remove(); // 务必清理
});
```

### 9.3 忘记关闭线程池

```java
ExecutorService pool = Executors.newFixedThreadPool(10);
// ... 提交任务 ...
// pool.shutdown();  // 忘了！线程会阻止 JVM 退出

// 正确做法：shutdown + 等待终止
pool.shutdown();
if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
    pool.shutdownNow(); // 强制关闭
}
```

## 10. Spring Boot 集成

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        int cores = Runtime.getRuntime().availableProcessors();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(cores * 2);
        executor.setMaxPoolSize(cores * 4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}

// 使用
@Service
public class ReportService {
    @Async
    public CompletableFuture<Report> generateReport() {
        // 在 async 线程池中执行
    }
}
```

## 11. 总结

| 参数 | CPU 密集型 | IO 密集型 |
|------|-----------|----------|
| `corePoolSize` | `核数 + 1` | `核数 * 2` |
| `maxPoolSize` | `核数 + 1` | `核数 * 4` |
| `workQueue` | 有界（保护内存） | 有界（保护内存） |
| `rejectPolicy` | `CallerRunsPolicy` | `CallerRunsPolicy` |

- **禁止用 `Executors` 工厂方法**——始终显式构造 `ThreadPoolExecutor`。
- **队列先满，再扩线程**——无界队列会让 `maxPoolSize` 形同虚设。
- **CPU 和 IO 线程池分离**——别让 IO 任务把 CPU 任务饿死。
- **池化环境务必清理 `ThreadLocal`**。
- **做好监控**：通过 Actuator 或日志暴露 pool 的活跃线程数、队列大小等指标。
