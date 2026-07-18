---
title: Database Optimization — A 6-Dimensional Guide (MySQL & PostgreSQL)
date: 2026-07-18
description: A systematic framework for relational database optimization — SQL rewriting, indexing, schema design, configuration tuning, architecture scaling, and monitoring — with practical MySQL and PostgreSQL examples.
---

# Database Optimization — A 6-Dimensional Guide (MySQL & PostgreSQL)

Database optimization is not "add an index and walk away." It's a **systematic discipline** that spans SQL, schema, configuration, and architecture. This guide organizes optimization into six dimensions, with concrete MySQL and PostgreSQL examples for each.

## The 6 Dimensions at a Glance

```
    ┌──────────────┐
    │  0. Monitor   │  ← Find the bottleneck first: slow log, EXPLAIN, system views
    ├──────────────┤
    │  1. SQL       │  ← Fastest wins, zero risk
    │  2. Index     │  ← Low risk, high reward
    │  3. Schema    │  ← Affects write & storage efficiency
    │  4. Config    │  ← Needs verification, global impact
    │  5. Architect │  ← Solves fundamental problems
    └──────────────┘
```

---

## Dimension 0: Monitoring — Find the Bottleneck First

Before optimizing anything, you must know **where the pain is**. Guessing wastes time.

### MySQL

```sql
-- Enable slow query log
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.5;          -- queries > 500ms get logged

-- Analyze with Percona Toolkit (highly recommended)
-- pt-query-digest /var/log/mysql/slow.log

-- Real-time: what's running right now?
SHOW FULL PROCESSLIST;

-- Top time-consuming queries (MySQL 8.0+)
SELECT * FROM sys.statement_analysis ORDER BY total_latency DESC LIMIT 10;
```

### PostgreSQL

```sql
-- Enable in postgresql.conf:
-- log_min_duration_statement = 500   # log queries > 500ms

-- Or per-session:
SET log_min_duration_statement = 500;
```

```sql
-- Essential: pg_stat_statements (install extension first)
CREATE EXTENSION pg_stat_statements;

-- Top 10 slowest queries by average time
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- Top 10 most frequent queries
SELECT query, calls, total_time
FROM pg_stat_statements
ORDER BY calls DESC LIMIT 10;
```

**Golden rule**: start with queries that are **both slow AND frequent**. Fix one hot query, and you fix hundreds of slow executions per minute.

---

## Dimension 1: SQL Rewriting — Fastest Wins

### 1.1 Never `SELECT *`

Every extra column costs network bandwidth, memory, and can kill covering indexes.

```sql
-- ❌ Fetches 50 columns, only uses 3 — covering index wasted
SELECT * FROM orders WHERE user_id = 42;

-- ✅ Only what you need — can be served entirely from a covering index
SELECT id, amount, status FROM orders WHERE user_id = 42;
```

### 1.2 Ditch Large OFFSET — Use Cursor Pagination

```sql
-- ❌ Scans 100,020 rows, discards 100,000 — gets slower with each page
SELECT id, title FROM articles ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- ✅ Jumps directly to the right position via index — always ~20 rows
SELECT id, title FROM articles
WHERE created_at < '2024-03-15 10:30:00'
ORDER BY created_at DESC LIMIT 20;
```

Real numbers: `LIMIT 20 OFFSET 500000` = 2-3 seconds. Cursor equivalent: < 5ms.

### 1.3 `EXISTS` Over `IN` (When It Makes Sense)

```sql
-- ❌ MySQL ≤5.6 materializes inner query first
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 100);

-- ✅ Correlated EXISTS — stops scanning as soon as one match is found
SELECT * FROM users u WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.amount > 100
);
```

Modern versions often optimize both to the same plan. But `NOT EXISTS` consistently beats `NOT IN` when NULLs are present — `NOT IN` with a NULL in the subquery returns zero rows (subtle and dangerous).

### 1.4 `UNION ALL` Over `UNION`

```sql
-- ❌ UNION does implicit DISTINCT — sorts and deduplicates
SELECT email FROM customers UNION SELECT email FROM leads;

-- ✅ Just concatenates results — zero dedup cost
SELECT email FROM customers UNION ALL SELECT email FROM leads;
```

Only use `UNION` when you genuinely need deduplication. Most real-world cases (different tables, already-unique columns) need `UNION ALL`.

### 1.5 Batch INSERT

```sql
-- ❌ 1000 round-trips, 1000 transactions
INSERT INTO logs (msg) VALUES ('log1');
INSERT INTO logs (msg) VALUES ('log2');

-- ✅ One round-trip, one transaction. 500-2000 rows per batch is ideal
INSERT INTO logs (msg) VALUES ('log1'), ('log2'), ..., ('log1000');
```

For MySQL, batch sizes of 500-2000 rows per statement are ideal. For PostgreSQL, the same range applies.

### 1.6 PostgreSQL: Use `COPY` for Bulk Loading

```sql
COPY users (name, email) FROM '/tmp/users.csv' CSV HEADER;
```

MySQL equivalent: `LOAD DATA INFILE`. Both bypass much of the normal SQL execution path — orders of magnitude faster than `INSERT`.

### 1.7 MySQL: Join Driving Table

MySQL's nested-loop join picks a **driving table** (outer loop). A simple rule: **the smaller result set should drive**.

```sql
-- orders has 10M rows, users has 100K. Which should drive?
-- ✅ MySQL optimizer usually picks users (smaller after WHERE filter)
SELECT u.name, o.amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active';
```

Ensure the driven table has an index on the join column. Here, `orders.user_id` must be indexed.

---

## Dimension 2: Indexing — Make the DB Work Less

Covered in depth in the [DB Index article](/posts/db-index-optimization). Here are the essentials applied to MySQL and PostgreSQL.

### Cardinal Rule: Fewer Rows Scanned = Faster

An index that scans 100 rows is good. One that scans 100,000 is questionable. `EXPLAIN` tells the truth.

### MySQL: InnoDB Specifics

- **Primary key is always clustered** — rows are physically ordered by PK. Use auto-increment `BIGINT`.
- **Secondary indexes store the PK** — keep your PK small so secondary indexes stay compact.

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 42 AND status = 'paid';
-- Look for: type=ref (good), key=idx_xxx (index used), rows=small number
-- Red flags: type=ALL (full scan), Extra=Using filesort, Extra=Using temporary
```

### PostgreSQL: Key Differences

- **No clustered index by default** — secondary indexes point to heap tuple ID (TID).
- **Partial indexes** — index only a subset of rows, much smaller and faster:

```sql
-- Only ~5% of orders are active — index is 20x smaller
CREATE INDEX idx_active_orders ON orders(created_at) WHERE status = 'active';
```

- **Expression indexes** — index a function's result:

```sql
CREATE INDEX idx_email_lower ON users(LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com'; -- uses index!
```

- **Covering index with INCLUDE (PG 11+)**:

```sql
CREATE INDEX idx_cov ON orders(user_id, status) INCLUDE (amount, created_at);
```

### Both: Covering Index is Gold

`EXPLAIN` shows `Using index` (MySQL) or `Index Only Scan` (PostgreSQL) — the query never touches the table.

---

## Dimension 3: Schema Design — Get the Foundation Right

### 3.1 Choose the Smallest Data Type

Every byte matters when multiplied by millions of rows:

```sql
-- ❌
age INT;            -- 4 bytes, range -2B..+2B
status VARCHAR(50); -- wasted space, no constraint

-- ✅
age TINYINT;               -- MySQL: 1 byte / PG: SMALLINT
status ENUM('active','inactive','banned');  -- MySQL: 1-2 bytes
status VARCHAR(10) CHECK (status IN ('active','inactive','banned')); -- PG
```

| Use Case | MySQL | PostgreSQL |
|----------|-------|------------|
| Yes/No flag | `TINYINT(1)` | `BOOLEAN` |
| Status < 256 values | `ENUM` or `TINYINT` | `SMALLINT` + CHECK |
| Precise money | `DECIMAL(19,4)` | `NUMERIC(19,4)` |
| Timestamps | `TIMESTAMP` (1970-2038) or `DATETIME` | `TIMESTAMPTZ` (recommended) |

### 3.2 Avoid NULL Where Possible

NULL complicates indexing, comparisons (`!=` excludes NULLs silently), and aggregation. Use `NOT NULL DEFAULT ...` wherever possible.

```sql
-- ❌ NULL allowed — WHERE email != 'x' silently excludes NULL rows
email VARCHAR(255);

-- ✅ No surprises
email VARCHAR(255) NOT NULL DEFAULT '';
```

### 3.3 Vertical Partitioning — Split Wide Tables

```sql
-- Main table: frequently accessed, narrow rows
CREATE TABLE articles (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    author_id BIGINT,
    created_at TIMESTAMP
);

-- Extended table: large columns, rarely accessed
CREATE TABLE article_contents (
    article_id BIGINT PRIMARY KEY,
    body TEXT,
    rendered_html TEXT,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

Why: more narrow rows fit per page (16KB InnoDB / 8KB PG). Queries that don't need `body` scan fewer pages.

### 3.4 Horizontal Partitioning

```sql
-- MySQL RANGE partition
CREATE TABLE orders (...) PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025)
);

-- PostgreSQL 10+ native partitioning
CREATE TABLE orders (...) PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

Consider when tables exceed ~10M rows and queries naturally scope by partition key (e.g., time range).

### 3.5 Selective Denormalization

Only denormalize when: (1) the column **rarely changes**, (2) the JOIN appears on every single query (verified by slow log, not assumed).

```sql
-- Denormalized: user_name stored directly in orders
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    user_id BIGINT,
    user_name VARCHAR(100),   -- denormalized — rarely changes
    amount DECIMAL(10,2)
);
```

---

## Dimension 4: Configuration Tuning — The Knobs That Matter

### MySQL (InnoDB)

```ini
# === THE most important parameter ===
# Buffer pool = InnoDB's page cache. 50-70% of RAM for dedicated DB server.
# If your working set is 5GB and this is 1GB, you're doing 4GB of avoidable disk I/O.
innodb_buffer_pool_size = 8G

# Redo log: larger = better write throughput, longer crash recovery
innodb_log_file_size = 1G

# Durability vs performance:
# 1 = safest (fsync every commit), 2 = faster (fsync every second)
innodb_flush_log_at_trx_commit = 1

# I/O capacity: HDD ~200, SATA SSD ~2000, NVMe SSD ~5000+
innodb_io_capacity = 2000
```

### PostgreSQL

```ini
# Shared buffers: 25% of RAM (PG also relies heavily on OS page cache)
shared_buffers = 2GB

# Per-operation memory — NOT global. 50 concurrent queries × 64MB = potential 3.2GB
work_mem = 64MB

# Tells the planner total cache available (75% of RAM)
effective_cache_size = 6GB

# === CRITICAL: autovacuum ===
# PostgreSQL's garbage collector. For UPDATE/DELETE-heavy tables, tune aggressively:
autovacuum_vacuum_scale_factor = 0.05   -- vacuum when 5% of rows are dead
autovacuum_analyze_scale_factor = 0.05  -- analyze when 5% of rows change
```

**PostgreSQL's biggest difference from MySQL**: autovacuum. Neglect it, dead tuples pile up, tables bloat, and performance craters. If your `UPDATE`/`DELETE` rate is high, make autovacuum more aggressive.

---

## Dimension 5: Architecture — Scaling Beyond One Machine

### 5.1 Cache Before the Database

```
App → Redis/Memcached → (miss) → Database
       ↑                           │
       └────── store result ───────┘
```

- Cache query results that are **frequently read, rarely changed**
- Set TTL based on staleness tolerance (30s for dashboards, 1h for reference data)
- Always handle cache miss, cache failure, and cache stampede

### 5.2 Read/Write Splitting

```
       App
     ┌──┴──┐
     ▼     ▼
  Master  Slave(s) ← reads
 (writes)   │
     └── replication ──┘
```

- MySQL: async/semi-sync replication, `read_only=ON` on slaves.
- PostgreSQL: streaming replication + `hot_standby=on`.
- Handle replication lag — don't read from slave immediately after writing to master.

### 5.3 Message Queue for Write Spikes

```
App → Kafka/RabbitMQ → Worker → Batch INSERT → DB
```

Instead of 10,000 concurrent INSERTs hitting the database, the queue absorbs the spike and workers write in controlled batches. The DB sees a smooth, predictable load.

### 5.4 Sharding — The Nuclear Option

Only when a single master cannot handle writes after ALL other optimizations:

```
user_id % 4:  1,5,9... → Shard 0 | 2,6,10... → Shard 1 | ...
```

Cost: cross-shard queries become extremely complex. You lose ACID across shards. Application code must be sharding-aware. Only reach for this when you have tens of millions of users and a dedicated infrastructure team.

---

## Dimension 6: PostgreSQL Deep Cuts

### VACUUM Health Check

```sql
-- How bloated are your tables?
SELECT schemaname, relname,
       n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY dead_ratio DESC;
```

### Connection Pooling is Mandatory

PostgreSQL forks a process per connection — much heavier than MySQL's threads. Always use PgBouncer:

```
App → PgBouncer (pool_mode=transaction) → PostgreSQL (~20 connections)
```

This allows hundreds of application connections to share ~20 database connections.

### EXPLAIN ANALYZE — PostgreSQL's Superpower

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...
-- shared hit = from cache (good), read = from disk (bad)
```

Visualize at [explain.depesz.com](https://explain.depesz.com).

---

## The Optimization Decision Tree

```
Start → Enable slow log → Find top N slow queries
  → EXPLAIN each (type=ALL? rows=millions?)
    → Add/modify index OR rewrite SQL  ← 80% of problems solved here
      → Still slow? Check schema design
        → Still slow? Tune config params
          → Still slow? Add cache + read/write split
            → Still slow? Shard / redesign
```

**Most performance problems are solved at steps 1-3. Never jump to sharding because a query is slow.**

---

## Summary

| Dimension | MySQL Key Action | PostgreSQL Key Action |
|-----------|-----------------|----------------------|
| **Monitor** | `pt-query-digest` on slow log | `pg_stat_statements` |
| **SQL** | Batch INSERT, cursor pagination, `EXISTS` | Same + `COPY` for bulk loads |
| **Index** | Covering index, watch for `Using filesort` | Partial/expression indexes, `INCLUDE` |
| **Schema** | `TINYINT` over `INT`, avoid NULL, vertical split | `BOOLEAN` for flags, same NULL/split logic |
| **Config** | `buffer_pool_size` = 70% RAM | `shared_buffers` = 25% RAM + aggressive autovacuum |
| **Architecture** | Read/write split, Redis cache, MQ for writes | Same + PgBouncer mandatory |

> "Measure, don't guess. EXPLAIN, don't assume. Fix the hot path, not everything." — Database optimization in one sentence.
