---
title: Relational Database Index Design & Optimization
date: 2026-07-18
description: Master B+Tree index internals, composite index leftmost prefix rule, covering indexes, index failure scenarios, and EXPLAIN-driven optimization.
---

# Relational Database Index Design & Optimization

Indexes are the single most effective tool for database performance. A well-designed index turns a full table scan into a few disk seeks. But poorly designed indexes hurt writes, waste storage, and can even confuse the optimizer. This article covers index internals, design principles, and practical optimization.

## 1. What Is an Index?

Without an index, finding a row is like finding a name in a phone book with no alphabetical order — you scan every page.

```sql
-- Full table scan — reads every row
SELECT * FROM users WHERE email = 'alice@example.com';

-- With an index — O(log n) lookup
CREATE INDEX idx_users_email ON users(email);
```

Most relational databases (MySQL InnoDB, PostgreSQL) use **B+Tree** as the default index structure.

### B+Tree Structure

```
                    ┌──────────────┐
                    │  [30 | 60]   │  ← internal node (only keys)
                    └──┬───┬───┬──┘
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │[10 | 20] │    │[40 | 50] │    │[70 | 80] │  ← internal nodes
   └──┬───┬───┘    └──┬───┬───┘    └──┬───┬───┘
  ┌───┘   └───┐  ┌───┘   └───┐  ┌───┘   └───┐
  ▼           ▼  ▼           ▼  ▼           ▼
┌────┐    ┌────┐┌────┐    ┌────┐┌────┐    ┌────┐
│10  │    │20  ││40  │    │50  ││70  │    │80  │  ← leaf nodes
│row1│    │row2││row4│    │row5││row7│    │row8│     (keys + data/pointer)
└────┘    └────┘└────┘    └────┘└────┘    └────┘
    ↕ linked list → range scan is efficient
```

Key B+Tree properties:

- **All data lives in leaf nodes** — internal nodes store only keys for navigation
- **Leaf nodes are linked** — efficient range queries (`BETWEEN`, `>`, `<`)
- **Balanced** — all leaves at the same depth; O(log n) for all lookups
- **High fanout** — a 4KB node with 8-byte keys holds ~250 keys; 3 levels = millions of rows

## 2. Index Types

### 2.1 Primary Key (Clustered Index)

In InnoDB, the primary key IS the table. Data is physically organized by the primary key B+Tree. Every row's full data lives in the primary key's leaf nodes.

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,  -- clustered index
    email VARCHAR(255),
    name VARCHAR(100)
);
```

### 2.2 Secondary Index (Non-Clustered)

Leaf nodes contain the indexed column(s) + the primary key value, not the full row.

```sql
CREATE INDEX idx_email ON users(email);

-- Query: SELECT * FROM users WHERE email = 'x';
-- 1. Search idx_email B+Tree → find primary key (id=42)
-- 2. Search primary key B+Tree → find full row  ← this is "回表" (table lookup)
```

This two-step process is called **table lookup** (回表). It doubles the B+Tree search cost.

### 2.3 Unique Index

```sql
CREATE UNIQUE INDEX idx_email ON users(email);
-- Enforces uniqueness + provides index lookup
```

### 2.4 Composite Index

```sql
CREATE INDEX idx_name_age ON users(name, age);
-- Order matters! See leftmost prefix rule below.
```

### 2.5 Full-Text Index

```sql
CREATE FULLTEXT INDEX idx_content ON articles(title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST('database optimization');
```

## 3. Clustered vs Non-Clustered

```
┌─────────────────────────────────────────────┐
│           Clustered Index (PK)               │
│  ┌──────────────────────────────────────┐   │
│  │ B+Tree leaf = full row data           │   │
│  │  id=1 │ name, email, ... (all cols)  │   │
│  │  id=2 │ name, email, ... (all cols)  │   │
│  └──────────────────────────────────────┘   │
│  One per table, physically orders data      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         Secondary Index (email)              │
│  ┌──────────────────────────────────────┐   │
│  │ B+Tree leaf = email + primary key     │   │
│  │  "a@x.com" │ id=42  ──► PK lookup    │   │
│  │  "b@x.com" │ id=17  ──► PK lookup    │   │
│  └──────────────────────────────────────┘   │
│  Multiple per table, stores PK pointer       │
└─────────────────────────────────────────────┘
```

| | Clustered (PK) | Secondary |
|---|---|---|
| Count per table | 1 | Many |
| Leaf stores | Full row | Indexed cols + PK |
| Lookup speed | One B+Tree walk | Two B+Tree walks (unless covering) |
| Physical order | Rows ordered by PK | N/A |

## 4. Composite Index & Leftmost Prefix Rule

This is the most important index design rule. A composite index `(A, B, C)` works like a phone book sorted by last name, then first name:

```sql
CREATE INDEX idx_a_b_c ON orders(user_id, status, created_at);
```

| Query | Uses index? | Why |
|-------|-------------|-----|
| `WHERE user_id = 1` | ✅ Yes | Matches leftmost column A |
| `WHERE user_id = 1 AND status = 'paid'` | ✅ Yes | Matches A + B |
| `WHERE user_id = 1 AND created_at > '2024-01-01'` | ✅ Partial (A only) | Skips B, so C can't be used |
| `WHERE status = 'paid'` | ❌ No | Doesn't start from leftmost |
| `WHERE created_at > '2024-01-01'` | ❌ No | Doesn't start from leftmost |
| `WHERE user_id = 1 AND created_at > '2024-01-01' AND status = 'paid'` | ✅ Full | Optimizer reorders to (A, B, C) |

```
Index (A, B, C) sorted as:

(A=1, B=1, C=1)
(A=1, B=1, C=2)
(A=1, B=2, C=1)   ← Can't skip B to use C
(A=1, B=2, C=3)
(A=2, B=1, C=1)   ← A changes, B resets
(A=2, B=1, C=2)
```

**Design rule**: Put equality columns first, range column last.

```sql
-- Good: equality → equality → range
CREATE INDEX idx_good ON orders(user_id, status, created_at);

-- Bad: range in the middle cuts off later columns
CREATE INDEX idx_bad ON orders(user_id, created_at, status);
```

## 5. Covering Index — Avoid Table Lookup

If a secondary index already contains all columns the query needs, the optimizer skips the table lookup:

```sql
CREATE INDEX idx_cover ON users(email, name);

-- Covering: both email and name are in the index — no PK lookup needed
SELECT email, name FROM users WHERE email = 'alice@example.com';

-- Not covering: age is not in the index — must do PK lookup
SELECT email, name, age FROM users WHERE email = 'alice@example.com';
```

`EXPLAIN` shows `Using index` when a covering index is used — one of the best things to see.

## 6. EXPLAIN — Your Optimization Compass

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 42 AND status = 'paid';
```

Key columns to watch:

| Column | What to look for |
|--------|-----------------|
| `type` | `ALL` (full scan) = bad. Want: `const`, `eq_ref`, `ref`, `range` |
| `key` | Which index is actually used (NULL = no index!) |
| `rows` | Estimated rows scanned — lower is better |
| `Extra` | `Using index` (covering) = great. `Using filesort` = bad. `Using temporary` = bad |

```sql
-- Good
-- type: ref, key: idx_user_status, rows: 5, Extra: Using index

-- Bad
-- type: ALL, key: NULL, rows: 1000000, Extra: Using where; Using filesort
```

### EXPLAIN Hierarchy (best → worst)

```
system → const → eq_ref → ref → range → index → ALL
                                    ↑ acceptable    ↑ avoid
```

## 7. When Indexes Fail — Common Scenarios

### 7.1 Function on Indexed Column

```sql
-- ❌ Index is useless
SELECT * FROM users WHERE YEAR(created_at) = 2024;

-- ✅ Move the function to the value side
SELECT * FROM users WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

### 7.2 Implicit Type Conversion

```sql
-- phone is VARCHAR, but we compare with an integer
-- ❌ Index fails — MySQL converts the column, not the value
SELECT * FROM users WHERE phone = 13800138000;

-- ✅ Use a string
SELECT * FROM users WHERE phone = '13800138000';
```

### 7.3 LIKE with Leading Wildcard

```sql
-- ❌ Can't use index (B+Tree is prefix-sorted)
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- ✅ Leading prefix — index works
SELECT * FROM users WHERE email LIKE 'alice%';
```

### 7.4 OR Across Different Columns

```sql
-- ❌ May not use indexes on both columns effectively
SELECT * FROM users WHERE email = 'x' OR phone = 'y';

-- ✅ UNION ALL with separate indexed queries
SELECT * FROM users WHERE email = 'x'
UNION ALL
SELECT * FROM users WHERE phone = 'y';
```

### 7.5 Negative Conditions

```sql
-- ❌ Index often skipped
SELECT * FROM users WHERE status != 'deleted';
SELECT * FROM users WHERE id NOT IN (1, 2, 3);

-- ✅ Use range or positive conditions when possible
SELECT * FROM users WHERE status IN ('active', 'pending');
```

### 7.6 Low Cardinality + Large Result Set

If a query returns >~30% of the table, the optimizer may skip the index and do a full scan — sequential I/O can be faster than random I/O for large result sets.

## 8. Index Design Principles

### Do Index

- Primary key (always, auto-increment recommended for InnoDB)
- Columns in `WHERE`, `JOIN`, `ORDER BY`, `GROUP BY`
- Foreign key columns
- High-cardinality columns (many distinct values)
- Columns used in frequently-run queries (optimize for the hot path)

### Don't Index

- Tiny tables (< few thousand rows — full scan is fine)
- Columns rarely used in queries
- Low-cardinality columns (e.g., `gender`, `is_deleted`) — unless as part of a composite
- Frequently-updated columns (index maintenance cost)
- `TEXT`/`BLOB` without prefix length

```sql
-- Only index the first 20 characters of a long VARCHAR/TEXT
CREATE INDEX idx_title_prefix ON articles(title(20));
```

## 9. Index Optimization Strategies

### 9.1 Avoid Redundant Indexes

```sql
-- Redundant: (A, B) already covers queries on A alone
CREATE INDEX idx_a ON t(a);       -- ❌ redundant
CREATE INDEX idx_a_b ON t(a, b);  -- ✅ this already covers A queries

-- Check existing indexes
SHOW INDEX FROM orders;
```

### 9.2 Use `pt-duplicate-key-checker`

Percona Toolkit can find duplicate and redundant indexes automatically.

### 9.3 Index Merge — Don't Rely on It

MySQL can combine multiple indexes for a single query (index merge), but it's less efficient than one well-designed composite index:

```sql
-- Two separate indexes
CREATE INDEX idx_status ON orders(status);
CREATE INDEX idx_user_id ON orders(user_id);

-- MySQL may do index merge, but a composite index is better:
CREATE INDEX idx_user_status ON orders(user_id, status);
```

### 9.4 Monitor Unused Indexes

```sql
-- MySQL 8.0+
SELECT * FROM sys.schema_unused_indexes;

-- PostgreSQL
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

Unused indexes waste storage and slow down writes. Drop them.

### 9.5 Prefix Index for Long Strings

```sql
-- Index only first 10 chars — enough for selectivity
CREATE INDEX idx_email_prefix ON users(email(10));

-- Check selectivity
SELECT COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) FROM users;
-- > 0.9 → good enough
```

## 10. Index and Write Performance

Every index on a table adds overhead to `INSERT`, `UPDATE`, and `DELETE`:

```
INSERT → write row to PK B+Tree → update all secondary index B+Trees
UPDATE → if indexed column changed: delete old + insert new index entry
DELETE → remove from PK B+Tree → remove from all secondary index B+Trees
```

**Rule of thumb**: 5-8 indexes per table is reasonable for OLTP. Beyond that, measure carefully.

## 11. Summary

| Principle | Why |
|-----------|-----|
| **Leftmost prefix** | Composite index (A,B,C) only works from A forward |
| **Equality first, range last** | Order columns: `=` then `>` / `BETWEEN` / `LIKE` |
| **Covering index** | Put queried columns in the index to avoid table lookup |
| **No functions on columns** | `WHERE fn(col) = x` kills index |
| **Prefix index** | Index first N chars of long strings |
| **Drop unused indexes** | They slow writes, waste space |
| **EXPLAIN everything** | `type=ALL` or `Extra=filesort` = red flag |

> "The best index is the one you measure, not the one you guess." — Measure with `EXPLAIN`, monitor with slow query log, and iterate.
