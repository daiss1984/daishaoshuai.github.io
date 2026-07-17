---
title: JVM Optimization Practical Guide
date: 2026-07-17
description: From heap sizing to GC tuning — master JVM optimization with practical parameters, GC selection, and real-world troubleshooting scenarios.
---

# JVM Optimization Practical Guide

JVM tuning isn't about memorizing flags — it's about understanding your application's memory behavior and choosing the right GC for the job. This guide covers the 80/20 of JVM optimization.

## 1. JVM Memory Model Recap

```
┌─────────────────────────────────────────────┐
│                  Heap                        │
│  ┌─────────┐  ┌──────────────┐              │
│  │ Young   │  │     Old      │              │
│  │ ┌──┐┌──┐│  │   (Tenured)  │              │
│  │ │Eden││S0│S1│              │              │
│  │ └──┘└──┘└──┘              │              │
│  └─────────┘  └──────────────┘              │
├─────────────────────────────────────────────┤
│                Metaspace                     │
│          (Class metadata, replaced PermGen)  │
├─────────────────────────────────────────────┤
│              Code Cache / Direct Memory      │
└─────────────────────────────────────────────┘
```

| Region | Stores | Key Parameter |
|--------|--------|---------------|
| **Eden** | New objects | Part of `-Xmn` or ratio |
| **Survivor (S0/S1)** | Objects surviving minor GC | `-XX:SurvivorRatio` |
| **Old (Tenured)** | Long-lived objects | `-Xmx` minus young |
| **Metaspace** | Class metadata | `-XX:MaxMetaspaceSize` |
| **Direct Memory** | NIO buffers | `-XX:MaxDirectMemorySize` |

## 2. Essential JVM Parameters

### Heap Sizing

```bash
# Absolute must-know
-Xms2g -Xmx4g                    # Initial / max heap

# Young generation
-Xmn1g                            # Fixed young size
-XX:NewRatio=2                    # Old/Young ratio (old = 2x young)

# Metaspace
-XX:MaxMetaspaceSize=256m         # Prevent metaspace OOM
-XX:MetaspaceSize=128m            # Initial metaspace

# Direct memory
-XX:MaxDirectMemorySize=512m      # For NIO
```

### GC Logging (Java 9+)

```bash
# Unified GC logging
-Xlog:gc*:file=/var/log/app/gc.log:time,level,tags:filecount=10,filesize=100M

# Key flags decoded:
#   gc*       → log all GC events
#   time      → include timestamps
#   level     → include log level
#   filecount → keep 10 rotated files
#   filesize  → rotate at 100MB each
```

### Heap Dump on OOM

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/log/app/heap.hprof
-XX:+ExitOnOutOfMemoryError        # Kill process on OOM (for auto-restart)
-XX:OnOutOfMemoryError="kill -9 %p" # Custom OOM action
```

## 3. GC Selection Guide

Modern JVM GC choices — pick based on your goal:

| GC | Latency | Throughput | Footprint | Best For |
|----|---------|------------|-----------|----------|
| **Serial** | High pause | Low | Small | Desktop apps, small heaps (<100MB) |
| **Parallel** | Medium pause | **Highest** | Medium | Batch jobs, throughput-first |
| **G1** | Low pause | High | Medium | **Default since Java 9**, balanced |
| **ZGC** | **<1ms** | High | Larger | Low latency, large heaps (Java 11+) |
| **Shenandoah** | <10ms | High | Larger | Low latency alternative (Java 12+) |

```bash
# Select GC
-XX:+UseG1GC           # G1 (default Java 9+)
-XX:+UseParallelGC     # Parallel
-XX:+UseZGC            # ZGC (Java 11+, production-ready in 15+)
-XX:+UseShenandoahGC   # Shenandoah
```

### G1 Tuning (Most Common)

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200          # Target max pause (soft goal)
-XX:G1HeapRegionSize=4m           # Region size (1/2048 of heap, 1-32MB)
-XX:InitiatingHeapOccupancyPercent=45  # Start concurrent cycle at 45% heap
-XX:G1ReservePercent=10           # Reserve 10% heap for to-space
-XX:ConcGCThreads=2               # Concurrent GC threads
-XX:ParallelGCThreads=4           # Parallel GC threads
```

**G1 tuning workflow**:
```
0. Start with measurement and defaults; tune only after data is available
1. Set -Xms == -Xmx when heap size is predictable and you want stable behavior
2. Set MaxGCPauseMillis target
3. Monitor with GC logs → adjust IHOP if mixed GCs start too late
4. Increase ConcGCThreads if concurrent cycles can't keep up
```

## 4. Common Optimization Scenarios

### Scenario 1: Frequent Young GC (Minor GC)

**Symptom**: GC logs show young GC every few seconds.

```bash
# Diagnosis
jstat -gc <pid> 1000
# If Eden fills up too fast → objects die young (normal) or allocation rate too high

# Fix: increase young gen
-Xmn2g           # Double young gen
-XX:NewRatio=1   # Young = Old
```

### Scenario 2: Long Young GC Pauses

**Symptom**: Young GC takes >100ms.

```bash
# Cause: too many live objects surviving to survivor → copying overhead
# Fix 1: reduce young gen (less to scan)
-Xmn512m

# Fix 2: increase survivor space
-XX:SurvivorRatio=4   # Eden:S0 = 4:1 (default 8:1, more survivor space)

# Fix 3: objects prematurely promoted? Check with:
-XX:+PrintTenuringDistribution
# If low tenuring threshold → increase:
-XX:MaxTenuringThreshold=15
```

### Scenario 3: Full GC Too Frequent

**Symptom**: CMS/G1 Full GC or Serial Old GC happening too often.

```bash
# Common causes:
# 1. Heap too small → increase -Xmx
# 2. Memory leak → jmap dump + MAT analysis
# 3. Too many large objects → -XX:PretenureSizeThreshold=1m
#    (objects >1MB go directly to Old, skip Eden)
# 4. Metaspace full → increase MaxMetaspaceSize
```

### Scenario 4: CMS / G1 Concurrent Mode Failure

**Symptom**: `Concurrent Mode Failure` in GC log → Full GC triggers.

```bash
# G1 fix: start concurrent marking earlier
-XX:InitiatingHeapOccupancyPercent=35   # default 45, lower = earlier

# Or: increase heap
-Xmx8g

# Or: more concurrent threads
-XX:ConcGCThreads=4
```

### Scenario 5: Promotion Failure

**Symptom**: Objects can't fit in Old gen during young GC.

```bash
# G1 fix: increase reserve
-XX:G1ReservePercent=15    # default 10

# General fix: increase heap
-Xmx8g
```

## 5. Monitoring & Diagnostics

### jstat — Real-time GC Stats

```bash
# GC stats every 1s, 10 times
jstat -gc <pid> 1000 10

# Key columns:
#   S0C/S1C  → Survivor capacity (KB)
#   EC       → Eden capacity
#   OC       → Old capacity
#   YGC/YGCT → Young GC count & time
#   FGC/FGCT → Full GC count & time
#   GCT      → Total GC time

# Quick health check:
jstat -gcutil <pid> 1000
# Watch E (Eden %), O (Old %), M (Metaspace %)
# If O keeps climbing after GC → leak or too small
```

### jmap — Heap Analysis

```bash
# Histogram — top objects by count & size
jmap -histo:live <pid> | head -30

# Heap dump
jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>
```

### jstack — Thread Analysis

```bash
# Thread dump (3 times, 5s apart — compare for stuck threads)
jstack <pid> > thread1.txt
sleep 5
jstack <pid> > thread2.txt
```

### jcmd — Swiss Army Knife

```bash
jcmd <pid> help                      # List available commands
jcmd <pid> VM.flags                  # Running JVM flags
jcmd <pid> GC.heap_info              # Heap configuration
jcmd <pid> GC.run                    # Trigger GC
jcmd <pid> Thread.print              # Thread dump
jcmd <pid> VM.system_properties      # System properties
```

## 6. Production Checklist

```bash
# Essential production flags
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

> Note: use `-Xms == -Xmx` when your capacity needs are stable and predictable. For highly variable workloads, leave some headroom and tune with logging.

## 7. Optimization Process & Verification

1. Collect baseline metrics before any change: heap usage, GC pause time, throughput, and request latency.
2. Enable GC logging and capture a sample with `jstat`, `jmap`, `jstack`, or `jcmd`.
3. Tune only one dimension at a time: heap size, GC policy, metaspace, or pause target.
4. Validate against a repeatable workload and compare before/after metrics.
5. If pause goals are missed, analyze GC logs first instead of applying many flags at once.

## 8. 💡 Core Principles

| Principle | Why |
|-----------|-----|
| `-Xms == -Xmx` | Avoid heap resizing overhead at runtime |
| Always set `MaxMetaspaceSize` | Default unlimited → metaspace OOM risk |
| Always enable GC logging | Disk is cheap; debugging without logs is expensive |
| Always dump on OOM | One dump can save days of guessing |
| Don't tune prematurely | Measure first, tune later |
| Know your allocation rate | How fast you create objects determines GC pressure |

**Golden rule**: The best GC is the one that never runs. Reduce allocation rate before tuning GC parameters.
