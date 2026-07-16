---
title: Redis 数据类型与过期策略
---

# Redis 数据类型与过期策略

Redis 不只是 key-value 缓存。它的数据类型决定了你能用它做什么，过期策略决定了它能撑多久。

## 1. 五种基本数据类型

### 1.1 String（字符串）

最基础的类型，value 最大 512MB。

```bash
SET user:1001:name "张三"
GET user:1001:name        # "张三"

SET counter 1
INCR counter               # 2（原子自增）
INCRBY counter 10          # 12

SETEX session:token 3600 "abc123"  # 带过期时间
```

> **场景**：缓存 JSON、计数器、分布式锁（`SETNX`）、Session。

### 1.2 Hash（哈希）

存储对象，key → field → value。

```bash
HSET user:1001 name "张三" age 28 email "zhang@example.com"
HGET user:1001 name        # "张三"
HGETALL user:1001          # 全部字段
HINCRBY user:1001 age 1    # 29
```

> **场景**：用户信息、商品详情、购物车。比 String 存 JSON 更省内存，且支持部分更新。

### 1.3 List（列表）

双向链表，有序可重复。适合队列和栈。

```bash
LPUSH queue "task1" "task2"   # 左推入 ["task2","task1"]
RPUSH queue "task3"           # 右推入 ["task2","task1","task3"]
LPOP queue                     # "task2"（左弹出）
BRPOP queue 5                  # 阻塞右弹出，等 5 秒

LRANGE queue 0 -1              # 查看全部
```

| 命令 | 方向 | 用途 |
|------|------|------|
| `LPUSH` + `RPOP` | 左进右出 | 消息队列 |
| `RPUSH` + `LPOP` | 右进左出 | 消息队列 |
| `LPUSH` + `LPOP` | 左进左出 | 栈 |
| `BRPOP` | 阻塞弹出 | 阻塞队列 |

### 1.4 Set（集合）

无序、不重复。

```bash
SADD tags:article:1 "Java" "Redis" "Spring"
SADD tags:article:2 "Java" "MySQL"
SINTER tags:article:1 tags:article:2   # {"Java"}  交集
SUNION tags:article:1 tags:article:2   # 并集
SDIFF tags:article:1 tags:article:2    # {"Redis","Spring"} 差集

SISMEMBER tags:article:1 "Java"        # 1（存在）
```

> **场景**：标签、共同好友、点赞用户（去重）、抽奖（`SRANDMEMBER`）。

### 1.5 Sorted Set（有序集合）

每个成员带一个 score，按 score 排序。

```bash
ZADD leaderboard 100 "Alice" 85 "Bob" 92 "Charlie"
ZRANGE leaderboard 0 -1           # 按分数升序
ZREVRANGE leaderboard 0 -1        # 按分数降序（排行榜）
ZRANK leaderboard "Alice"         # 2（Alice 排名第 3，从 0 开始）
ZSCORE leaderboard "Alice"        # "100"
ZINCRBY leaderboard 5 "Bob"       # 90（加分）
```

> **场景**：排行榜、延迟队列（score = 执行时间戳）、按时间排序的消息流。

## 2. 三种特殊数据类型

### 2.1 Bitmap（位图）

不是独立类型，是 String 的位操作。适合统计类场景。

```bash
SETBIT user:login:20260717 1001 1   # 用户 1001 今天登录了
SETBIT user:login:20260717 1002 1
BITCOUNT user:login:20260717         # 2（今天登录人数）
```

> **场景**：签到打卡、在线状态、布隆过滤器。

### 2.2 HyperLogLog

基数统计，极度省内存（12KB 统计 2^64 个不同元素），但有约 0.81% 误差。

```bash
PFADD uv:page1 user1 user2 user3
PFADD uv:page1 user2 user4
PFCOUNT uv:page1        # 4（UV 统计）
```

> **场景**：UV 统计、去重计数。不需要精确值，只要近似值。

### 2.3 Geospatial（地理坐标）

```bash
GEOADD cities 116.397 39.908 "北京" 121.473 31.230 "上海"
GEODIST cities "北京" "上海" km     # "1068.xxxx"（距离）
GEORADIUS cities 116.4 39.9 200 km  # 北京 200km 内的城市
```

> **场景**：附近的人、周边商铺。

### 2.4 Stream（消息流，Redis 5.0+）

```bash
XADD mystream * message "hello"
XADD mystream * message "world"
XLEN mystream              # 2
XRANGE mystream - +        # 查看全部
XREAD COUNT 2 STREAMS mystream 0  # 读取
```

> **场景**：消息队列、事件溯源。相比 List，Stream 支持消费者组、消息确认。

## 3. 数据类型选择速查

| 场景 | 选型 |
|------|------|
| 缓存 JSON 对象 | String（简单）或 Hash（字段级操作） |
| 计数器 / 限流 | String + `INCR` + 过期 |
| 消息队列（简单） | List + `BRPOP` |
| 消息队列（可靠） | Stream + 消费者组 |
| 排行榜 | Sorted Set |
| 标签 / 去重 | Set |
| 共同好友 / 交集 | Set + `SINTER` |
| UV 统计 | HyperLogLog |
| 签到 / 布隆 | Bitmap |
| 附近的人 | Geo |
| 分布式锁 | String + `SET NX EX` |

## 4. Redis 过期策略

### 4.1 如何设置过期

```bash
EXPIRE key 60              # 60 秒后过期
SETEX key 60 "value"       # 创建时直接设过期
PEXPIRE key 60000          # 60000 毫秒后过期
EXPIREAT key 1740000000    # 指定 Unix 时间戳过期
TTL key                    # 查看剩余时间（-1 永不过期，-2 已过期）
PERSIST key                # 移除过期时间
```

### 4.2 三种过期删除策略

| 策略 | 机制 | 优缺点 |
|------|------|------|
| **惰性删除** | 访问 key 时才检查是否过期，过期则删 | 省 CPU，但过期 key 不访问就永远占内存 |
| **定期删除** | 每隔 100ms 随机抽取一批 key 检查过期 | 折中，CPU 和内存的平衡 |
| **定时删除** | 每个 key 建一个定时器，到点就删 | 最及时，但大量 key 时 CPU 开销巨大 |

### 4.3 Redis 的实际做法：惰性 + 定期

```
┌─────────────────────────────────────────────┐
│ Redis 过期处理                               │
│                                              │
│ 1. 访问 key → 惰性检查 → 过期？删             │
│ 2. 每 100ms → 随机取 20 个 key                │
│    ├─ 过期？删                                │
│    ├─ 过期比例 > 25% → 重复此轮               │
│    └─ 过期比例 ≤ 25% → 等下一个 100ms          │
└─────────────────────────────────────────────┘
```

**关键点**：定期删除不是全量扫描，而是**随机抽样**。所以可能出现大量过期 key 没被及时清理。

### 4.4 内存淘汰策略（内存满时怎么办？）

当 Redis 内存超过 `maxmemory`，有 8 种淘汰策略：

| 策略 | 行为 |
|------|------|
| `noeviction`（默认） | 不淘汰，写请求报错 |
| `allkeys-lru` | 所有 key 中，淘汰最近最少用的 |
| `allkeys-lfu` | 所有 key 中，淘汰最不常用的 |
| `allkeys-random` | 所有 key 中，随机淘汰 |
| `volatile-lru` | 设了过期的 key 中，淘汰最近最少用的 |
| `volatile-lfu` | 设了过期的 key 中，淘汰最不常用的 |
| `volatile-random` | 设了过期的 key 中，随机淘汰 |
| `volatile-ttl` | 设了过期的 key 中，淘汰 TTL 最短的 |

```bash
# 配置
maxmemory 2gb
maxmemory-policy allkeys-lru
```

**选型建议**：

| 场景 | 推荐策略 |
|------|------|
| 纯缓存（数据可丢） | `allkeys-lru` 或 `allkeys-lfu` |
| 缓存 + 持久化混合 | `volatile-lru`（只淘汰有 TTL 的） |
| 绝对不能丢数据 | `noeviction` |

### 4.5 LRU vs LFU

```
LRU（Least Recently Used）：
  "你多久没来了？"
  最近没访问的 → 淘汰
  适合：热点数据相对稳定的场景

LFU（Least Frequently Used）：
  "你来过几次？"
  访问频率最低的 → 淘汰
  适合：新数据容易被淘汰，老热点数据保留

Redis 的 LRU/LFU 是近似算法（随机抽样 N 个 key，淘汰其中最差的）
```

## 5. 💡 常见面试追问

**Q：Redis 的过期 key 删除是即时的吗？**

> 不是。Redis 使用惰性删除（访问时检查）+ 定期删除（定时随机抽样）。这意味着过期 key 可能不会立即被删除，内存释放可能有延迟。

**Q：如果有大量 key 同时过期会怎样？**

> 如果这些 key 在同一轮定期删除中被处理，可能导致短暂的 CPU 尖峰。建议给过期时间加随机偏移：`EXPIRE key 3600 + rand(0, 300)`。

**Q：如何查看 Redis 的内存和过期情况？**

```bash
INFO memory        # 内存使用情况
INFO stats         # 过期 key 统计（expired_keys）
INFO keyspace      # 每个 DB 的 key 数量 + 带 TTL 的数量
```

**一句话总结**：Redis 的过期 = 惰性 + 定期 + 内存淘汰三重保障。数据类型选对，事半功倍；过期策略配好，内存不爆。
