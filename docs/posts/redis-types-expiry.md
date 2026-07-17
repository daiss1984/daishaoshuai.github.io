---
title: Redis Data Types & Expiry Strategies
date: 2026-07-15
description: Redis is more than a key-value cache. Covers 5 basic types + 4 special types (Bitmap, HyperLogLog, Geo, Stream), along with lazy deletion, periodic deletion, and 8 memory eviction policies.
---

# Redis Data Types & Expiry Strategies

Redis is more than a key-value cache. Its data types determine what you can build, and its expiry strategies determine how long data lives.

## 1. Five Basic Data Types

### 1.1 String

The most basic type, supporting values up to 512MB.

```bash
SET user:1001:name "Alice"
GET user:1001:name        # "Alice"

SET counter 1
INCR counter               # 2 (atomic increment)
INCRBY counter 10          # 12

SETEX session:token 3600 "abc123"  # with expiration
```

> **Use cases**: JSON caching, counters, distributed locks (`SETNX`), sessions.

### 1.2 Hash

Stores objects as key → field → value.

```bash
HSET user:1001 name "Alice" age 28 email "alice@example.com"
HGET user:1001 name        # "Alice"
HGETALL user:1001          # all fields
HINCRBY user:1001 age 1    # 29
```

> **Use cases**: User profiles, product details, shopping carts. More memory-efficient than storing JSON as String, with support for partial updates.

### 1.3 List

Doubly-linked list, ordered and allows duplicates. Ideal for queues and stacks.

```bash
LPUSH queue "task1" "task2"   # left push → ["task2","task1"]
RPUSH queue "task3"           # right push → ["task2","task1","task3"]
LPOP queue                     # "task2" (left pop)
BRPOP queue 5                  # blocking right pop, wait 5s

LRANGE queue 0 -1              # view all
```

| Command | Direction | Use |
|---------|-----------|-----|
| `LPUSH` + `RPOP` | Left in, right out | Message queue |
| `RPUSH` + `LPOP` | Right in, left out | Message queue |
| `LPUSH` + `LPOP` | Left in, left out | Stack |
| `BRPOP` | Blocking pop | Blocking queue |

### 1.4 Set

Unordered, no duplicates.

```bash
SADD tags:article:1 "Java" "Redis" "Spring"
SADD tags:article:2 "Java" "MySQL"
SINTER tags:article:1 tags:article:2   # {"Java"}  intersection
SUNION tags:article:1 tags:article:2   # union
SDIFF tags:article:1 tags:article:2    # {"Redis","Spring"} difference

SISMEMBER tags:article:1 "Java"        # 1 (exists)
```

> **Use cases**: Tags, mutual friends, like deduplication, raffles (`SRANDMEMBER`).

### 1.5 Sorted Set

Each member has a score, sorted by score.

```bash
ZADD leaderboard 100 "Alice" 85 "Bob" 92 "Charlie"
ZRANGE leaderboard 0 -1           # ascending by score
ZREVRANGE leaderboard 0 -1        # descending (leaderboard)
ZRANK leaderboard "Alice"         # 2 (Alice ranks 3rd, 0-indexed)
ZSCORE leaderboard "Alice"        # "100"
ZINCRBY leaderboard 5 "Bob"       # 90 (add score)
```

> **Use cases**: Leaderboards, delayed queues (score = execution timestamp), time-sorted message feeds.

## 2. Three Special Data Types

### 2.1 Bitmap

Not a standalone type — it's bit-level operations on String. Great for statistics.

```bash
SETBIT user:login:20260717 1001 1   # user 1001 logged in today
SETBIT user:login:20260717 1002 1
BITCOUNT user:login:20260717         # 2 (login count today)
```

> **Use cases**: Check-ins, online status, Bloom filters.

### 2.2 HyperLogLog

Cardinality counting, extremely memory-efficient (12KB for 2^64 distinct elements), ~0.81% error.

```bash
PFADD uv:page1 user1 user2 user3
PFADD uv:page1 user2 user4
PFCOUNT uv:page1        # 4 (UV count)
```

> **Use cases**: UV statistics, deduplication counting where exact values aren't required.

### 2.3 Geospatial

```bash
GEOADD cities 116.397 39.908 "Beijing" 121.473 31.230 "Shanghai"
GEODIST cities "Beijing" "Shanghai" km     # "1068.xxxx" (distance)
GEORADIUS cities 116.4 39.9 200 km         # cities within 200km of Beijing
```

> **Use cases**: Nearby people, nearby shops.

### 2.4 Stream (Redis 5.0+)

```bash
XADD mystream * message "hello"
XADD mystream * message "world"
XLEN mystream              # 2
XRANGE mystream - +        # view all
XREAD COUNT 2 STREAMS mystream 0  # read
```

> **Use cases**: Message queues, event sourcing. Unlike List, Stream supports consumer groups and message acknowledgment.

## 3. Data Type Selection Cheat Sheet

| Scenario | Type |
|----------|------|
| Cache JSON | String (simple) or Hash (field-level ops) |
| Counter / rate limit | String + `INCR` + expiry |
| Message queue (simple) | List + `BRPOP` |
| Message queue (reliable) | Stream + consumer group |
| Leaderboard | Sorted Set |
| Tags / dedup | Set |
| Mutual friends / intersection | Set + `SINTER` |
| UV stats | HyperLogLog |
| Check-ins / Bloom | Bitmap |
| Nearby | Geo |
| Distributed lock | String + `SET NX EX` |

## 4. Redis Expiry Strategies

### 4.1 Setting Expiry

```bash
EXPIRE key 60              # expire in 60 seconds
SETEX key 60 "value"       # set with expiry
PEXPIRE key 60000          # expire in 60000ms
EXPIREAT key 1740000000    # expire at Unix timestamp
TTL key                    # check remaining time (-1 = no expiry, -2 = expired)
PERSIST key                # remove expiry
```

### 4.2 Three Expiry Deletion Strategies

| Strategy | Mechanism | Pros/Cons |
|----------|-----------|-----------|
| **Lazy deletion** | Check on access, delete if expired | CPU-friendly but expired keys consume memory until accessed |
| **Periodic deletion** | Every 100ms, randomly sample keys to check | Balanced approach for CPU and memory |
| **Timed deletion** | Timer per key, delete on expiry | Most timely, but high CPU cost with many keys |

### 4.3 Redis Actual Approach: Lazy + Periodic

```
┌─────────────────────────────────────────────┐
│ Redis Expiry Handling                        │
│                                              │
│ 1. Access key → lazy check → expired? delete │
│ 2. Every 100ms → randomly pick 20 keys       │
│    ├─ expired? delete                        │
│    ├─ expiry ratio > 25% → repeat this round │
│    └─ expiry ratio ≤ 25% → wait next 100ms   │
└─────────────────────────────────────────────┘
```

**Key point**: Periodic deletion uses random sampling, not full scan. Many expired keys may not be cleaned up immediately.

### 4.4 Memory Eviction Policies (When memory is full)

When Redis exceeds `maxmemory`, 8 eviction policies are available:

| Policy | Behavior |
|--------|----------|
| `noeviction` (default) | No eviction, write errors |
| `allkeys-lru` | Evict least recently used across all keys |
| `allkeys-lfu` | Evict least frequently used across all keys |
| `allkeys-random` | Random eviction across all keys |
| `volatile-lru` | Evict LRU among keys with TTL |
| `volatile-lfu` | Evict LFU among keys with TTL |
| `volatile-random` | Random eviction among keys with TTL |
| `volatile-ttl` | Evict keys with shortest TTL |

```bash
# Configuration
maxmemory 2gb
maxmemory-policy allkeys-lru
```

**Selection guide**:

| Scenario | Recommended |
|----------|-------------|
| Pure cache (data can be lost) | `allkeys-lru` or `allkeys-lfu` |
| Cache + persistence mixed | `volatile-lru` (only evict TTL keys) |
| Data must never be lost | `noeviction` |

### 4.5 LRU vs LFU

```
LRU (Least Recently Used):
  "How long since you last visited?"
  Evicts least recently accessed keys
  Best for: relatively stable hot data

LFU (Least Frequently Used):
  "How many times have you visited?"
  Evicts least frequently accessed keys
  Best for: new data easily evicted, old hot data retained

Redis LRU/LFU are approximate (random sample N keys, evict the worst)
```

## 5. 💡 Common Interview Follow-Ups

**Q: Is Redis expiry deletion immediate?**

> No. Redis uses lazy deletion (check on access) + periodic deletion (timed random sampling). Expired keys may not be deleted immediately — memory release may have a delay.

**Q: What happens if many keys expire at the same time?**

> A CPU spike may occur if all are processed in one periodic deletion round. Recommendation: add random offset to expiry times: `EXPIRE key 3600 + rand(0, 300)`.

**Q: How to check Redis memory and expiry status?**

```bash
INFO memory        # memory usage
INFO stats         # expired key stats (expired_keys)
INFO keyspace      # key count per DB + TTL count
```

**In a nutshell**: Redis expiry = lazy + periodic + memory eviction — triple safety net. Pick the right data type, configure expiry well, and memory won't overflow.
