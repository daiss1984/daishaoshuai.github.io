---
title: JVM 调优实战指南
date: 2026-07-17
description: 从堆内存配置到 GC 选型 —— 掌握 JVM 调优核心参数、垃圾收集器选择与生产环境实战排查场景。
---

# JVM 调优实战指南

JVM 调优不是背参数，而是理解应用的内存行为，选对 GC。本文覆盖 80% 日常调优场景。

## 1. JVM 内存模型回顾

```
┌─────────────────────────────────────────────┐
│                 堆 (Heap)                    │
│  ┌─────────┐  ┌──────────────┐              │
│  │ 新生代   │  │    老年代     │              │
│  │ ┌──┐┌──┐│  │  (Tenured)   │              │
│  │ │Eden││S0│S1│              │              │
│  │ └──┘└──┘└──┘              │              │
│  └─────────┘  └──────────────┘              │
├─────────────────────────────────────────────┤
│              元空间 (Metaspace)              │
│          (类元数据，替代了永久代)              │
├─────────────────────────────────────────────┤
│          Code Cache / 直接内存               │
└─────────────────────────────────────────────┘
```

| 区域 | 存放内容 | 关键参数 |
|------|---------|---------|
| **Eden** | 新创建的对象 | `-Xmn` 或比例控制 |
| **Survivor (S0/S1)** | Minor GC 存活对象 | `-XX:SurvivorRatio` |
| **Old (Tenured)** | 长期存活对象 | `-Xmx` 减去新生代 |
| **Metaspace** | 类元数据 | `-XX:MaxMetaspaceSize` |
| **直接内存** | NIO Buffer | `-XX:MaxDirectMemorySize` |

## 2. 核心 JVM 参数

### 堆内存配置

```bash
# 必知必会
-Xms2g -Xmx4g                    # 初始 / 最大堆

# 新生代
-Xmn1g                            # 固定新生代大小
-XX:NewRatio=2                    # 老年代/新生代比例（老年代 = 2 倍新生代）

# 元空间
-XX:MaxMetaspaceSize=256m         # 防止元空间 OOM
-XX:MetaspaceSize=128m            # 初始元空间

# 直接内存
-XX:MaxDirectMemorySize=512m      # NIO 场景
```

### GC 日志（Java 9+）

```bash
# 统一 GC 日志
-Xlog:gc*:file=/var/log/app/gc.log:time,level,tags:filecount=10,filesize=100M

# 参数解读：
#   gc*       → 记录所有 GC 事件
#   time      → 包含时间戳
#   level     → 包含日志级别
#   filecount → 保留 10 个滚动文件
#   filesize  → 每个文件最大 100MB
```

### OOM 时自动 Dump

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/app/heap.hprof
-XX:+ExitOnOutOfMemoryError        # OOM 时退出进程（配合自动重启）
-XX:OnOutOfMemoryError="kill -9 %p" # OOM 时执行自定义命令
```

## 3. GC 选型指南

| GC | 暂停时间 | 吞吐量 | 内存占用 | 适用场景 |
|----|---------|--------|---------|---------|
| **Serial** | 高 | 低 | 小 | 桌面应用、小堆 (<100MB) |
| **Parallel** | 中 | **最高** | 中 | 批处理、吞吐量优先 |
| **G1** | 低 | 高 | 中 | **Java 9+ 默认**，均衡 |
| **ZGC** | **<1ms** | 高 | 较大 | 低延迟、大堆 (Java 11+) |
| **Shenandoah** | <10ms | 高 | 较大 | 低延迟备选 (Java 12+) |

```bash
# 选择 GC
-XX:+UseG1GC           # G1（Java 9+ 默认）
-XX:+UseParallelGC     # Parallel
-XX:+UseZGC            # ZGC（Java 11+, 15+ 生产可用）
-XX:+UseShenandoahGC   # Shenandoah
```

### G1 调优（最常用）

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200          # 目标最大暂停（软目标）
-XX:G1HeapRegionSize=4m           # Region 大小（堆的 1/2048，1-32MB）
-XX:InitiatingHeapOccupancyPercent=45  # 堆占用 45% 时启动并发标记
-XX:G1ReservePercent=10           # 保留 10% 堆做 to-space
-XX:ConcGCThreads=2               # 并发 GC 线程数
-XX:ParallelGCThreads=4           # 并行 GC 线程数
```

**G1 调优流程**：
```
0. 先测量再调参，默认值通常是最安全的起点
1. 在堆大小可预测时设置 -Xms == -Xmx（避免堆扩缩容开销）
2. 设定 MaxGCPauseMillis 目标
3. 观察 GC 日志 → Mixed GC 太晚则降低 IHOP
4. 并发周期跟不上则增加 ConcGCThreads
```

## 4. 常见调优场景

### 场景 1：Young GC 太频繁

**现象**：GC 日志显示每隔几秒一次 Young GC。

```bash
# 诊断
jstat -gc <pid> 1000
# Eden 很快填满 → 对象朝生夕死（正常）或分配速率太高

# 解决：增大新生代
-Xmn2g
-XX:NewRatio=1   # 新生代 = 老年代
```

### 场景 2：Young GC 暂停过长

**现象**：Young GC 耗时 > 100ms。

```bash
# 原因：存活对象太多 → 拷贝开销大
# 方案1：减小新生代（扫描更少）
-Xmn512m

# 方案2：增大 Survivor 空间
-XX:SurvivorRatio=4   # Eden:S0=4:1（默认 8:1，增大了 Survivor）

# 方案3：对象过早晋升？检查：
-XX:+PrintTenuringDistribution
# 晋升阈值偏低 → 调大：
-XX:MaxTenuringThreshold=15
```

### 场景 3：Full GC 频繁

**现象**：CMS/G1 Full GC 或 Serial Old GC 频繁触发。

```bash
# 常见原因：
# 1. 堆太小 → 增大 -Xmx
# 2. 内存泄漏 → jmap dump + MAT 分析
# 3. 大对象太多 → -XX:PretenureSizeThreshold=1m
#    （大于 1MB 的对象直接进老年代，跳过 Eden）
# 4. 元空间满了 → 增大 MaxMetaspaceSize
```

### 场景 4：CMS / G1 Concurrent Mode Failure

**现象**：GC 日志出现 `Concurrent Mode Failure` → 触发 Full GC。

```bash
# G1 解决：提前启动并发标记
-XX:InitiatingHeapOccupancyPercent=35   # 默认 45，降低 = 更早启动

# 或：增大堆
-Xmx8g

# 或：增加并发线程
-XX:ConcGCThreads=4
```

### 场景 5：Promotion Failure

**现象**：Young GC 时对象无法放入老年代。

```bash
# G1 解决：增大保留空间
-XX:G1ReservePercent=15    # 默认 10

# 通用方案：增大堆
-Xmx8g
```

## 5. 监控诊断工具

### jstat — 实时 GC 统计

```bash
# 每秒输出 GC 统计，共 10 次
jstat -gc <pid> 1000 10

# 关键列：
#   S0C/S1C  → Survivor 容量 (KB)
#   EC       → Eden 容量
#   OC       → 老年代容量
#   YGC/YGCT → Young GC 次数 & 耗时
#   FGC/FGCT → Full GC 次数 & 耗时
#   GCT      → GC 总耗时

# 快速健康检查：
jstat -gcutil <pid> 1000
# 关注 E (Eden%), O (Old%), M (Metaspace%)
# Old 区持续上升不降 → 泄漏或太小
```

### jmap — 堆分析

```bash
# 直方图 — 对象数量 & 大小排名
jmap -histo:live <pid> | head -30

# 堆 Dump
jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>
```

### jstack — 线程分析

```bash
# 线程 Dump（3 次，间隔 5 秒 — 对比找出卡住的线程）
jstack <pid> > thread1.txt
sleep 5
jstack <pid> > thread2.txt
```

### jcmd — 瑞士军刀

```bash
jcmd <pid> help                      # 列出可用命令
jcmd <pid> VM.flags                  # 查看运行中的 JVM 参数
jcmd <pid> GC.heap_info              # 堆配置信息
jcmd <pid> GC.run                    # 手动触发 GC
jcmd <pid> Thread.print              # 线程 Dump
jcmd <pid> VM.system_properties      # 系统属性
```

## 6. 生产环境启动参数模板

```bash
# 生产必备参数
java \
  -Xms4g -Xmx4g \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:MaxMetaspaceSize=256m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/app/ \
  -XX:+ExitOnOutOfMemoryError \
  -Xlog:gc*:file=/var/log/app/gc.log::filecount=10,filesize=50M \
  -Djava.awt.headless=true \
  -Dfile.encoding=UTF-8 \
  -jar app.jar
```

> 注意：当负载可预测且堆容量稳定时使用 `-Xms == -Xmx`。对于波动较大场景，保留一定余量并通过日志调优更安全。

## 7. 调优流程与验证

1. 在改动前收集基线指标：堆使用、GC 暂停、吞吐量、响应延迟。
2. 开启 GC 日志，并用 `jstat`、`jmap`、`jstack`、`jcmd` 采样。
3. 每次只调整一个维度：堆大小、GC 策略、元空间或暂停目标。
4. 用可复现负载验证改动，比较调整前后指标。
5. 如果未达暂停目标，优先分析 GC 日志，而不是一次性改太多参数。

## 8. 💡 核心原则

| 原则 | 原因 |
|------|------|
| `-Xms == -Xmx` | 避免运行时堆扩缩容开销 |
| 一定设置 `MaxMetaspaceSize` | 默认无上限 → 元空间 OOM 风险 |
| 一定开启 GC 日志 | 磁盘便宜；没日志排查贵 |
| 一定配 OOM Dump | 一个 Dump 省好几天猜测 |
| 不要过早优化 | 先测量，再调优 |
| 了解你的分配速率 | 创建对象多快，决定 GC 压力多大 |

**黄金法则**：最好的 GC 是不用跑 GC。降低分配速率优先于调 GC 参数。
