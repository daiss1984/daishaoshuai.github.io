---
title: 数据库优化 —— 六个维度全攻略（MySQL & PostgreSQL）
date: 2026-07-18
description: 关系型数据库优化的系统框架 —— SQL 改写、索引设计、表结构优化、参数调优、架构升级、监控发现 —— 覆盖 MySQL 和 PostgreSQL 实战。
---

# 数据库优化 —— 六个维度全攻略（MySQL & PostgreSQL）

数据库优化不是"加个索引就完事了"。它是一门**系统工程**，横跨 SQL、表结构、配置参数、架构设计。本文把优化组织成六个维度，每个维度都给出 MySQL 和 PostgreSQL 的具体实操。

## 六个维度全景

```
    ┌──────────────┐
    │  0. 监控发现  │  ← 一切优化的起点：慢查询日志、EXPLAIN、系统视图
    ├──────────────┤
    │  1. SQL 改写  │  ← 见效最快、零风险
    │  2. 索引优化  │  ← 低风险、效果显著
    │  3. 表结构设计 │  ← 影响写入与存储效率
    │  4. 参数调优  │  ← 需要验证，影响全局
    │  5. 架构升级  │  ← 解决根本性问题
    └──────────────┘
```

---

## 维度 0：监控 —— 先找到瓶颈再动手

动手优化之前，必须知道**哪里在痛**。靠猜是浪费时间。

### MySQL

```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.5;          -- 超过 500ms 就记录

-- 用 Percona Toolkit 分析（强烈推荐）
-- pt-query-digest /var/log/mysql/slow.log
```

```sql
-- 实时看正在跑的查询
SHOW FULL PROCESSLIST;

-- 哪些 SQL 耗时最长（MySQL 8.0+）
SELECT * FROM sys.statement_analysis ORDER BY total_latency DESC LIMIT 10;
```

### PostgreSQL

```sql
-- 在 postgresql.conf 中设置：
-- log_min_duration_statement = 500   # 记录超过 500ms 的查询

-- 或者当前会话设置：
SET log_min_duration_statement = 500;
```

```sql
-- 最强大的工具：pg_stat_statements（需要先装扩展）
CREATE EXTENSION pg_stat_statements;

-- 平均耗时最长的 Top 10
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- 执行次数最多的 Top 10
SELECT query, calls, total_time
FROM pg_stat_statements
ORDER BY calls DESC LIMIT 10;
```

**黄金法则**：优先优化那些**既慢又频繁**的查询。修好一条热点查询，每分钟少跑几百次慢查询。

---

## 维度 1：SQL 改写 —— 见效最快

### 1.1 禁用 `SELECT *`

每多取一列，就多耗网络带宽和内存，还可能破坏覆盖索引。

```sql
-- ❌ 取了 50 列，只用 3 列 —— 覆盖索引白建了
SELECT * FROM orders WHERE user_id = 42;

-- ✅ 只取需要的 —— 可以完全走覆盖索引，零回表
SELECT id, amount, status FROM orders WHERE user_id = 42;
```

### 1.2 放弃大 OFFSET —— 改用游标分页

```sql
-- ❌ 扫描 100,020 行，扔掉 10 万行 —— 翻页越深越慢
SELECT id, title FROM articles ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- ✅ 通过索引直接跳到目标位置 —— 始终只碰 20 行
SELECT id, title FROM articles
WHERE created_at < '2024-03-15 10:30:00'
ORDER BY created_at DESC LIMIT 20;
```

实测：`LIMIT 20 OFFSET 500000` 耗时 2-3 秒。游标方式 < 5ms。

### 1.3 `EXISTS` 替代 `IN`（语义合适时）

```sql
-- ❌ MySQL ≤5.6 会把子查询物化后再查外表
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 100);

-- ✅ 关联 EXISTS —— 找到一条匹配就停
SELECT * FROM users u WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.amount > 100
);
```

现代版本通常能优化成一样。但 `NOT EXISTS` 在有 NULL 时始终优于 `NOT IN`——`NOT IN` 遇到子查询有 NULL 会返回零行，极其隐蔽且危险。

### 1.4 `UNION ALL` 替代 `UNION`

```sql
-- ❌ UNION 隐含 DISTINCT —— 额外排序去重
SELECT email FROM customers UNION SELECT email FROM leads;

-- ✅ 直接拼接结果 —— 零去重开销
SELECT email FROM customers UNION ALL SELECT email FROM leads;
```

### 1.5 批量 INSERT

```sql
-- ❌ 1000 次网络往返，1000 次事务提交
INSERT INTO logs (msg) VALUES ('log1');
INSERT INTO logs (msg) VALUES ('log2');

-- ✅ 一次往返，一次事务。每批 500-2000 行最佳
INSERT INTO logs (msg) VALUES ('log1'), ('log2'), ..., ('log1000');
```

### 1.6 PostgreSQL：大批量用 `COPY`

```sql
COPY users (name, email) FROM '/tmp/users.csv' CSV HEADER;
```

MySQL 对应的是 `LOAD DATA INFILE`。都绕过了大部分常规 SQL 路径，速度天差地别。

### 1.7 MySQL JOIN 驱动表

MySQL 的嵌套循环 JOIN 会选一个**驱动表**做外层循环。简单原则：**让结果集小的表做驱动表**。

```sql
-- orders 有 1000 万行，users 有 10 万行。谁驱动？
-- ✅ 优化器通常选 users（经过 WHERE 过滤后结果更小）
SELECT u.name, o.amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active';
```

确保被驱动表的 JOIN 列上有索引。这里 `orders.user_id` 必须建索引。

---

## 维度 2：索引优化

详见[数据库索引设计与优化](/zh/posts/db-index-optimization)一文。关键区别：

**MySQL**：主键即聚簇索引。保持 PK 小（自增 `BIGINT`）。`EXPLAIN` 见 `Using index` 说明覆盖。

**PostgreSQL 特有**：
- **部分索引**：只索引一部分行，索引体量小、扫描快
- **表达式索引**：对函数/表达式结果建索引
- **INCLUDE 覆盖索引（PG 11+）**：不参与搜索但避免回表

```sql
-- 部分索引 —— 只索引 active 的订单（假设占 5%），索引小了 20 倍
CREATE INDEX idx_active_orders ON orders(created_at) WHERE status = 'active';

-- 表达式索引 —— LOWER() 也能走索引
CREATE INDEX idx_email_lower ON users(LOWER(email));

-- 覆盖索引
CREATE INDEX idx_cov ON orders(user_id, status) INCLUDE (amount, created_at);
```

---

## 维度 3：表结构设计

### 3.1 用最小的数据类型

```sql
-- ❌
age INT;            -- 4 字节，范围 -21 亿 ~ +21 亿
status VARCHAR(50); -- 浪费空间，无约束

-- ✅
age TINYINT;               -- MySQL 1 字节 / PG 用 SMALLINT
status ENUM('active','inactive','banned');  -- MySQL 1-2 字节
status VARCHAR(10) CHECK (status IN ('active','inactive','banned')); -- PG
```

| 场景 | MySQL | PostgreSQL |
|------|-------|------------|
| 是/否标记 | `TINYINT(1)` | `BOOLEAN` |
| 状态 < 256 种 | `ENUM` 或 `TINYINT` | `SMALLINT` + CHECK |
| 精确金额 | `DECIMAL(19,4)` | `NUMERIC(19,4)` |
| 时间戳 | `TIMESTAMP`（1970-2038）或 `DATETIME` | `TIMESTAMPTZ`（推荐） |

### 3.2 尽量避免 NULL

NULL 让索引、比较（`!=` 会静默排除 NULL 行）、聚合都变复杂。尽可能用 `NOT NULL DEFAULT ...`。

### 3.3 垂直拆分 —— 宽表拆开

```sql
-- 主表：高频访问，行窄
CREATE TABLE articles (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    author_id BIGINT,
    created_at TIMESTAMP
);

-- 扩展表：大字段，低频访问
CREATE TABLE article_contents (
    article_id BIGINT PRIMARY KEY,
    body TEXT,
    rendered_html TEXT,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

效果：主表行更窄 → 每个 page 装更多行 → 不需要 body 的查询扫描更少的页。

### 3.4 水平分区

```sql
-- MySQL RANGE 分区
CREATE TABLE orders (...) PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025)
);

-- PostgreSQL 10+ 原生分区
CREATE TABLE orders (...) PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

单表超过 ~1000 万行 + 查询天然按分区键过滤时考虑分区。

### 3.5 选择性反范式

只在满足两个条件时冗余：(1) 该列极少变化，(2) 每次查询都要 JOIN 那张表（通过慢查询日志验证，不是靠猜）。

```sql
-- 反范式：把 user_name 直接存在 orders 里
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    user_name VARCHAR(100),   -- 冗余列 —— 很少变化
    amount DECIMAL(10,2)
);
```

---

## 维度 4：参数调优

### MySQL（InnoDB）

```ini
# === 最重要的参数，没有之一 ===
# 缓冲池 = InnoDB 的页缓存。专用 DB 服务器设 50-70% 内存。
# 如果你的热数据是 5GB，这个值只设了 1GB，等于有 4GB 本可避免的磁盘 I/O。
innodb_buffer_pool_size = 8G

# redo log：越大 = 写入吞吐越好，但崩溃恢复越慢
innodb_log_file_size = 1G

# 持久性 vs 性能：1=最安全(每次提交都 fsync)，2=更快(每秒 fsync 一次)
innodb_flush_log_at_trx_commit = 1

# I/O 能力：HDD ~200，SATA SSD ~2000，NVMe SSD ~5000+
innodb_io_capacity = 2000
```

### PostgreSQL

```ini
# 共享缓冲区：设 25% 内存（PG 还严重依赖 OS 页缓存）
shared_buffers = 2GB

# 每个排序/哈希操作的内存 —— 注意是 PER OPERATION，不是全局！
# 50 个并发查询 × 64MB = 潜在 3.2GB 内存占用
work_mem = 64MB

# 告诉优化器总共有多少缓存可用（设 75% 内存）
effective_cache_size = 6GB

# === 关键中的关键：autovacuum ===
# PostgreSQL 的垃圾回收器。对于 UPDATE/DELETE 频繁的表，必须调激进：
autovacuum_vacuum_scale_factor = 0.05   -- 死元组达 5% 就 VACUUM
autovacuum_analyze_scale_factor = 0.05  -- 行变化 5% 就 ANALYZE
```

**PostgreSQL 最大的坑**：autovacuum。不管它，死元组堆积、表膨胀、性能雪崩。

---

## 维度 5：架构升级

### 缓存前置

```
App → Redis/Memcached → (miss) → Database
       ↑                           │
       └────── 回种缓存 ───────────┘
```

缓存那些**读得频繁、变得少**的结果。永远要处理缓存 miss、缓存失效、缓存雪崩。

### 读写分离

```
       App
     ┌──┴──┐
     ▼     ▼
  Master  Slave(s) ← 读流量
 (写)      │
     └── 主从复制 ──┘
```

注意复制延迟——刚写完不要立刻去从库读。

### 消息队列削峰

```
App → Kafka/RabbitMQ → Worker → 批量 INSERT → DB
```

10000 次并发 INSERT → 队列吸收峰值 → worker 按可控节奏批量写库。DB 看到的是平滑、稳定的负载。

### 分库分表 —— 核武器

只有当所有优化手段用过之后，单一主库仍然扛不住写入时才考虑：

```
按 user_id % 4 分片：
  user_id 1,5,9...  → 分片 0
  user_id 2,6,10... → 分片 1
  ...
```

代价：跨分片查询极复杂，丢失跨分片 ACID，应用代码必须感知分片。

---

## 维度 6：PostgreSQL 特别篇

### VACUUM 健康检查

```sql
-- 你的表膨胀到什么程度了？
SELECT schemaname, relname,
       n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_ratio DESC;
```

### 连接池是必需的

PostgreSQL 每个连接 fork 一个进程 —— 远比 MySQL 的线程模型重。务必用 PgBouncer：

```
App → PgBouncer (pool_mode=transaction) → PostgreSQL (~20 连接)
```

### EXPLAIN ANALYZE——PG 的大杀器

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...
-- shared hit = 命中缓存（好），read = 磁盘读（差）
```

用 [explain.depesz.com](https://explain.depesz.com) 可视化分析。

---

## 优化决策树

```
开始 → 开慢查询日志 → 找出 Top N 慢查询
  → EXPLAIN 每一条（type=ALL？rows=千万？）
    → 加/改索引 或 改写 SQL  ← 80% 的问题到这里解决
      → 还慢？检查表结构设计
        → 还慢？调 DB 配置参数
          → 还慢？加缓存 + 读写分离
            → 还慢？分库分表 / 架构重构
```

---

## 总结

| 维度 | MySQL 核心动作 | PostgreSQL 核心动作 |
|------|---------------|-------------------|
| **监控** | `pt-query-digest` 分析慢日志 | `pg_stat_statements` |
| **SQL** | 批量 INSERT、游标分页、`EXISTS` | 同上 + `COPY` 大批量导入 |
| **索引** | 覆盖索引、警惕 `Using filesort` | 部分/表达式索引、`INCLUDE` |
| **表结构** | `TINYINT` 代替 `INT`、避免 NULL | `BOOLEAN` 做标记、同样避免 NULL |
| **参数** | `buffer_pool_size` = 70% 内存 | `shared_buffers` = 25% 内存 + autovacuum 要激进 |
| **架构** | 读写分离、Redis、MQ 削峰 | 同上 + PgBouncer 连接池必装 |

> "先测量再动手，先 EXPLAIN 再下结论，先优化热点再优化全局。" —— 数据库优化，一句话总结。
