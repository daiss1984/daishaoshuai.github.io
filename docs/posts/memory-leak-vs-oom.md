---
title: Memory Leak vs OOM — Common Interview Question
date: 2026-07-05
description: Memory leak is the disease, OOM is death. Learn 7 classic Java leak scenarios, investigation steps with jstat/jmap/MAT, and JVM tuning strategies.
---

# Memory Leak vs OOM — Common Interview Question

> **Memory Leak** is a program logic defect — objects are not released after use and GC can't reclaim them.  
> **OutOfMemoryError (OOM)** is the end result — memory is exhausted.  
> One is the cause, the other the effect. Interviewers love asking, "What's the difference?"

## 1. Quick Comparison

| | Memory Leak | OutOfMemoryError |
|------|------|------|
| **Nature** | Code bug — objects "forgotten" | Resource exhaustion — JVM overwhelmed |
| **Symptom** | Memory grows continuously, GC frequency increases | Throws `OutOfMemoryError`, process crashes |
| **Cause** | Code defects (unclosed resources, unbounded static collections, etc.) | Accumulated leaks, small heap, large objects, excessive threads |
| **Detection** | Monitoring tools + Heap Dump analysis | Directly visible in logs |
| **Fix** | Fix code, release references | Fix code + increase heap + optimize |

**In one line**: Memory leak is the **disease**, OOM is **death**. Leaks left untreated inevitably lead to OOM.

## 2. Common Java Memory Leak Scenarios

### 2.1 Unbounded Static Collections

```java
// ❌ Most common memory leak!
public class DataCache {
    private static final Map<String, Object> cache = new HashMap<>();

    public static void put(String key, Object data) {
        cache.put(key, data);  // only grows, GC can never reclaim
    }
}

// ✅ Fix: use WeakHashMap or add eviction policy
private static final Map<String, Object> cache = new WeakHashMap<>();
// Or use Caffeine / Guava Cache with expiration
```

### 2.2 Forgetting to Close Resources

```java
// ❌ Connection not closed
public void readFile() {
    try {
        FileInputStream fis = new FileInputStream("data.txt");
        // read data...
        // forgot fis.close()!
    } catch (Exception e) { }
}
// File descriptor leak → eventually OOM: unable to create new native thread or Too many open files


// ✅ try-with-resources (Java 7+)
public void readFile() {
    try (FileInputStream fis = new FileInputStream("data.txt");
         BufferedReader br = new BufferedReader(new InputStreamReader(fis))) {
        // auto-close, no manual finally needed
    } catch (Exception e) { }
}
```

### 2.3 Inner Classes Holding Outer References

```java
// ❌ Non-static inner class implicitly holds outer reference
public class MainActivity {
    private List<String> hugeData = new ArrayList<>(); // 10MB data

    // Non-static inner class → holds MainActivity.this
    class MyTask extends Thread {
        @Override
        public void run() {
            // This thread runs for 10 minutes; MainActivity can't be GC'd
            Thread.sleep(10 * 60 * 1000);
        }
    }
}

// ✅ Use static inner class + weak reference
static class MyTask extends Thread {
    @Override
    public void run() { /* no outer reference held */ }
}
```

### 2.4 ThreadLocal without remove

```java
// ❌ Thread pool + ThreadLocal = disaster
public class UserContext {
    private static final ThreadLocal<User> currentUser = new ThreadLocal<>();
    public static void set(User u) { currentUser.set(u); }
    // forgot remove()! When thread is reused, the old User object persists forever
}

// ✅ Must remove in finally
try {
    UserContext.set(user);
    // business logic
} finally {
    UserContext.remove();  // mandatory!
}
```

### 2.5 Listener/Callback Not Unregistered

```java
// ❌ Listener registered but never removed
button.addActionListener(new ActionListener() {
    @Override
    public void actionPerformed(ActionEvent e) {
        // this listener holds reference to outer class
    }
});
// Even when the outer object is no longer needed, GC can't reclaim it

// ✅ Remove when done
listener = e -> doSomething();
button.addActionListener(listener);
// ... when done
button.removeActionListener(listener);
```

### 2.6 equals/hashCode Causing Memory Leak

```java
// ❌ Object put into HashSet, then equals-dependent field is modified
Set<Person> set = new HashSet<>();
Person p = new Person("Alice", 25);
set.add(p);

p.setName("Bob");  // modified field used in hashCode!

set.remove(p);  // deletion fails! hashCode changed, can't find original bucket
// p remains in set forever as a "zombie object"
```

### 2.7 String intern Abuse (Java 6/7)

```java
// ❌ Java 6: String.intern() goes into PermGen
for (int i = 0; i < 10000000; i++) {
    ("str" + i).intern();  // PermGen OOM!
}
// Java 7+ intern goes to heap, but heavy intern usage can still blow it up
```

## 3. Memory Leak → OOM Progression

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Small    │ ──→  │ Frequent │ ──→  │ Constant │ ──→  │  OOM!    │
│ leak     │      │ GC drops │      │ FGC,     │      │ Process  │
│ memory   │      │ through- │      │ long STW │      │ crash    │
│ grows    │      │ put      │      │          │      │          │
└──────────┘      └──────────┘      └──────────┘      └──────────┘

Typical monitoring metric changes:
  Heap usage:  ▂▃▄▅▆▇███ (sawtooth upward — GC can't bring it down)
  GC time:     1% → 5% → 20% → 50%+
  Response:    100ms → 500ms → 3s → timeout
```

## 4. Four Classic OOM Types

| Exception | Cause | Fix |
|------|------|------|
| `Java heap space` | Insufficient heap memory | Find leak + increase `-Xmx` |
| `GC overhead limit exceeded` | GC uses 98% time but reclaims <2% heap | Heap nearly full, find leak |
| `Metaspace` | Class metadata space insufficient | `-XX:MaxMetaspaceSize` |
| `unable to create new native thread` | Thread limit exceeded | Reduce threads / increase OS limits |

```bash
# Common JVM flags
-Xms2g -Xmx4g                      # heap 2-4G
-XX:MaxMetaspaceSize=256m           # metaspace limit
-XX:+HeapDumpOnOutOfMemoryError     # auto dump on OOM
-XX:HeapDumpPath=/tmp/heapdump.hprof
```

## 5. How to Investigate Memory Leaks

### 5.1 Monitoring

```bash
# Watch heap usage trends
jstat -gc <pid> 1000 10

# Key metrics:
# OU (Old Used) — old gen usage continuously rising = possible leak
# FGC (Full GC count) — frequent Full GC = danger signal
```

### 5.2 Capture Heap Dump

```bash
# Method 1: jmap
jmap -dump:live,format=b,file=heap.hprof <pid>

# Method 2: JVM auto-dump on OOM
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/

# Method 3: jcmd
jcmd <pid> GC.heap_dump /tmp/heap.hprof
```

### 5.3 Analysis Approach

Use MAT (Memory Analyzer Tool) or JProfiler to open the dump:

1. **Dominator Tree** → which object consumes the most memory?
2. **Leak Suspects** → MAT auto-analysis of suspicious leak points
3. **GC Roots Path** → why can't this object be reclaimed?
4. **Compare two dumps** → which object grew the fastest?

```
Classic investigation steps:
  jstat observe → confirm leak → jmap dump → MAT analysis
                                    ↓
                    Dominator Tree → largest object
                                    ↓
                    GC Roots path → who's referencing it?
                                    ↓
                    Locate code → fix
```

## 6. Common Leak-Prone Code Patterns

```java
// Pattern 1: container with put but no remove
map.put(key, value);  // no corresponding remove

// Pattern 2: addListener without removeListener
eventSource.addListener(listener);

// Pattern 3: new Thread / new Runnable inner class
new Thread(() -> { /* holds outer this */ }).start();

// Pattern 4: ThreadLocal.set without remove

// Pattern 5: singleton holding short-lived references
class Singleton {
    private Context context;  // ❌ Activity/Fragment/Request reference!
}
```

## 7. Best Practices

| Principle | Practice |
|-----------|----------|
| **Always close resources** | Use `try-with-resources` everywhere |
| **Bound your collections** | Use WeakHashMap for static caches or add LRU eviction |
| **Always clear ThreadLocal** | `finally { threadLocal.remove(); }` |
| **Always unregister listeners** | Register and unregister in pairs |
| **Use static inner classes** | Avoid implicit outer references |
| **Auto-dump on OOM** | Add `HeapDumpOnOutOfMemoryError` |
| **Load test before launch** | Run for a while, check if memory stabilizes |

## 8. 💡 Interview Answer Template

> **"What's the difference between memory leak and OOM?"**

> A memory leak is a program bug — allocated objects are not released after use and GC can't reclaim them, causing heap memory to grow continuously. OOM is the end result — when available memory is exhausted, the JVM throws OutOfMemoryError.
>
> Their relationship is **cause and effect**: if a memory leak persists, it inevitably leads to OOM. But OOM doesn't always come from a leak — it could also be due to a heap that's too small, loading a huge file at once, or too many threads.
>
> For investigation: leaks require observing memory trends with jstat, capturing heap dumps with jmap, and analyzing GC Roots with MAT to find who's holding unwanted references. OOM can be quickly diagnosed from logs and the exception type (heap space / metaspace / native thread).
