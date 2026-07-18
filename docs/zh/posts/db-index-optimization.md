---
title: 关系型数据库索引设计与优化
date: 2026-07-18
description: 掌握 B+Tree 索引原理、联合索引最左前缀法则、覆盖索引、索引失效场景，以及 EXPLAIN 驱动的优化实战。
---

# 关系型数据库索引设计与优化

索引是数据库性能优化最有效的工具。设计良好的索引能把全表扫描变成几次磁盘寻道。但设计不当的索引会拖慢写入、浪费存储，甚至迷惑优化器。本文从索引原理到实战优化，逐一讲透。

## 1. 什么是索引？

没有索引时，查找一行数据就像在没排序的电话簿里找人——每页都得翻。

```sql
-- 全表扫描 —— 读取每一行
SELECT * FROM users WHERE email = 'alice@example.com';

-- 有索引 —— O(log n) 查询
CREATE INDEX idx_users_email ON users(email);
```

大多数关系型数据库（MySQL InnoDB、PostgreSQL）默认使用 **B+Tree** 作为索引结构。

### B+Tree 结构

```
                    ┌──────────────┐
                    │  [30 | 60]   │  ← 内部节点（只存键值）
                    └──┬───┬───┬──┘
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │[10 | 20] │    │[40 | 50] │    │[70 | 80] │  ← 内部节点
   └──┬───┬───┘    └──┬───┬───┘    └──┬───┬───┘
  ┌───┘   └───┐  ┌───┘   └───┐  ┌───┘   └───┐
  ▼           ▼  ▼           ▼  ▼           ▼
┌────┐    ┌────┐┌────┐    ┌────┐┌────┐    ┌────┐
│10  │    │20  ││40  │    │50  ││70  │    │80  │  ← 叶子节点
│row1│    │row2││row4│    │row5││row7│    │row8│     (键 + 数据/指针)
└────┘    └────┘└────┘    └────┘└────┘    └────┘
    ↕ 双向链表 → 范围查询高效
```

B+Tree 核心特性：

- **数据只存在于叶子节点**——内部节点只存键值用于导航
- **叶子节点之间有双向链表**——范围查询 (`BETWEEN`、`>`、`<`) 高效
- **绝对平衡**——所有叶子节点深度相同；每次查找都是 O(log n)
- **高扇出**——4KB 节点 + 8 字节键 ≈ 250 个键；3 层就能覆盖百万行

## 2. 索引类型

### 2.1 主键索引（聚簇索引）

InnoDB 中，主键就是表本身。数据按主键 B+Tree 物理组织，完整行数据存在主键索引的叶子节点中。

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 聚簇索引
    email VARCHAR(255),
    name VARCHAR(100)
);
```

### 2.2 二级索引（非聚簇索引）

叶子节点存的是索引列 + 主键值，而不是完整行。

```sql
CREATE INDEX idx_email ON users(email);

-- 查询: SELECT * FROM users WHERE email = 'x';
-- 1. 查 idx_email B+Tree → 找到主键 (id=42)
-- 2. 查主键 B+Tree → 找到完整行  ← 这就是"回表"
```

这两步过程叫**回表**（table lookup），翻倍了 B+Tree 查找成本。

### 2.3 唯一索引

```sql
CREATE UNIQUE INDEX idx_email ON users(email);
-- 保证唯一性 + 提供索引查找
```

### 2.4 联合索引（复合索引）

```sql
CREATE INDEX idx_name_age ON users(name, age);
-- 列的顺序至关重要！见下文最左前缀法则。
```

### 2.5 全文索引

```sql
CREATE FULLTEXT INDEX idx_content ON articles(title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST('数据库优化');
```

## 3. 聚簇索引 vs 非聚簇索引

```
┌─────────────────────────────────────────────┐
│           聚簇索引（主键）                    │
│  ┌──────────────────────────────────────┐   │
│  │ B+Tree 叶子 = 完整行数据               │   │
│  │  id=1 │ name, email, ... (全部列)    │   │
│  │  id=2 │ name, email, ... (全部列)    │   │
│  └──────────────────────────────────────┘   │
│  每表仅一个，数据物理按主键排序               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         二级索引（email）                     │
│  ┌──────────────────────────────────────┐   │
│  │ B+Tree 叶子 = email + 主键            │   │
│  │  "a@x.com" │ id=42  ──► 回表查PK    │   │
│  │  "b@x.com" │ id=17  ──► 回表查PK    │   │
│  └──────────────────────────────────────┘   │
│  每表可有多个，存主键指针                     │
└─────────────────────────────────────────────┘
```

| | 聚簇索引 (PK) | 二级索引 |
|---|---|---|
| 每表数量 | 1 个 | 多个 |
| 叶子存什么 | 完整行 | 索引列 + 主键 |
| 查找速度 | 一次 B+Tree | 两次 B+Tree（覆盖索引除外） |
| 物理顺序 | 行按主键排序 | 不适用 |

## 4. 联合索引与最左前缀法则

这是索引设计中最重要的一条规则。联合索引 `(A, B, C)` 就像一个按姓、再按名排序的电话簿：

```sql
CREATE INDEX idx_a_b_c ON orders(user_id, status, created_at);
```

| 查询 | 命中索引？ | 原因 |
|------|-----------|------|
| `WHERE user_id = 1` | ✅ 是 | 匹配最左列 A |
| `WHERE user_id = 1 AND status = 'paid'` | ✅ 是 | 匹配 A + B |
| `WHERE user_id = 1 AND created_at > '2024-01-01'` | ✅ 部分（仅 A） | 跳过了 B，所以 C 用不上 |
| `WHERE status = 'paid'` | ❌ 否 | 不从最左列开始 |
| `WHERE created_at > '2024-01-01'` | ❌ 否 | 不从最左列开始 |
| `WHERE user_id = 1 AND created_at > '2024-01-01' AND status = 'paid'` | ✅ 全命中 | 优化器重排为 (A, B, C) |

```
联合索引 (A, B, C) 排序如下：

(A=1, B=1, C=1)
(A=1, B=1, C=2)
(A=1, B=2, C=1)   ← 不能跳过 B 直接用 C
(A=1, B=2, C=3)
(A=2, B=1, C=1)   ← A 变了，B 重新开始
(A=2, B=1, C=2)
```

**设计原则**：等值查询列放前面，范围查询列放最后。

```sql
-- ✅ 好：等值 → 等值 → 范围
CREATE INDEX idx_good ON orders(user_id, status, created_at);

-- ❌ 差：范围在中间，后面的列全失效
CREATE INDEX idx_bad ON orders(user_id, created_at, status);
```

## 5. 覆盖索引 —— 避免回表

如果二级索引中已经包含了查询所需的所有列，优化器就跳过回表：

```sql
CREATE INDEX idx_cover ON users(email, name);

-- 覆盖：email 和 name 都在索引里 —— 不需要回表
SELECT email, name FROM users WHERE email = 'alice@example.com';

-- 不覆盖：age 不在索引里 —— 必须回表
SELECT email, name, age FROM users WHERE email = 'alice@example.com';
```

`EXPLAIN` 的 `Extra` 列显示 `Using index` 就是覆盖索引——这是最想看到的结果之一。

## 6. EXPLAIN —— 你的优化指南针

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 42 AND status = 'paid';
```

重点关注列：

| 列 | 关注什么 |
|----|---------|
| `type` | `ALL`（全表扫描）= 差。期望：`const`、`eq_ref`、`ref`、`range` |
| `key` | 实际使用的索引（NULL = 没走索引！） |
| `rows` | 预估扫描行数——越少越好 |
| `Extra` | `Using index`（覆盖）= 好。`Using filesort` = 差。`Using temporary` = 差 |

```sql
-- 好的 EXPLAIN
-- type: ref, key: idx_user_status, rows: 5, Extra: Using index

-- 差的 EXPLAIN
-- type: ALL, key: NULL, rows: 1000000, Extra: Using where; Using filesort
```

### EXPLAIN type 层级（好 → 差）

```
system → const → eq_ref → ref → range → index → ALL
                                    ↑ 可接受      ↑ 必须避免
```

## 7. 索引失效 —— 常见场景

### 7.1 索引列上使用函数

```sql
-- ❌ 索引失效
SELECT * FROM users WHERE YEAR(created_at) = 2024;

-- ✅ 把函数移到值那边
SELECT * FROM users WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

### 7.2 隐式类型转换

```sql
-- phone 是 VARCHAR，但用整数去比较
-- ❌ 索引失效 —— MySQL 把列转了，不是把值转了
SELECT * FROM users WHERE phone = 13800138000;

-- ✅ 用字符串
SELECT * FROM users WHERE phone = '13800138000';
```

### 7.3 LIKE 前置通配符

```sql
-- ❌ 索引用不上（B+Tree 是按前缀排序的）
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- ✅ 前置匹配 —— 索引有效
SELECT * FROM users WHERE email LIKE 'alice%';
```

### 7.4 不同列的 OR

```sql
-- ❌ 可能不会有效利用两个列的索引
SELECT * FROM users WHERE email = 'x' OR phone = 'y';

-- ✅ UNION ALL 各自走索引
SELECT * FROM users WHERE email = 'x'
UNION ALL
SELECT * FROM users WHERE phone = 'y';
```

### 7.5 否定条件

```sql
-- ❌ 索引常常被跳过
SELECT * FROM users WHERE status != 'deleted';
SELECT * FROM users WHERE id NOT IN (1, 2, 3);

-- ✅ 尽可能用正向条件
SELECT * FROM users WHERE status IN ('active', 'pending');
```

### 7.6 低区分度 + 大结果集

如果查询返回超过约 30% 的表数据，优化器可能放弃索引直接用全表扫描——大结果集下顺序 I/O 比随机 I/O 更快。

## 8. 索引设计原则

### 适合建索引

- 主键（必须有，InnoDB 推荐自增）
- `WHERE`、`JOIN`、`ORDER BY`、`GROUP BY` 中的列
- 外键列
- 高区分度列（值种类多）
- 高频查询中的列（优化热路径）

### 不适合建索引

- 小型表（几千行以内——全表扫描就够）
- 很少出现在查询中的列
- 低区分度列（如 `gender`、`is_deleted`）——除非作为联合索引一部分
- 频繁更新的列（索引维护开销大）
- `TEXT`/`BLOB` 不加前缀长度

```sql
-- 长 VARCHAR/TEXT 只索引前 20 个字符
CREATE INDEX idx_title_prefix ON articles(title(20));
```

## 9. 索引优化策略

### 9.1 去除冗余索引

```sql
-- 冗余：(A, B) 已经覆盖了对 A 单独的查询
CREATE INDEX idx_a ON t(a);       -- ❌ 冗余
CREATE INDEX idx_a_b ON t(a, b);  -- ✅ 这个已经能覆盖 A 的查询

-- 查看已有索引
SHOW INDEX FROM orders;
```

### 9.2 使用 `pt-duplicate-key-checker`

Percona Toolkit 可以自动发现重复和冗余索引。

### 9.3 索引合并 —— 别依赖它

MySQL 可以对单次查询组合多个索引（index merge），但不如一个设计良好的联合索引高效：

```sql
-- 两个独立索引
CREATE INDEX idx_status ON orders(status);
CREATE INDEX idx_user_id ON orders(user_id);

-- MySQL 可能做 index merge，但联合索引更好：
CREATE INDEX idx_user_status ON orders(user_id, status);
```

### 9.4 监控未使用的索引

```sql
-- MySQL 8.0+
SELECT * FROM sys.schema_unused_indexes;

-- PostgreSQL
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

未使用的索引浪费存储、拖慢写入。直接删。

### 9.5 长字符串用前缀索引

```sql
-- 只索引前 10 个字符 —— 区分度足够了
CREATE INDEX idx_email_prefix ON users(email(10));

-- 检查区分度
SELECT COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) FROM users;
-- > 0.9 → 够用了
```

## 10. 索引与写入性能

表中每个索引都会增加 `INSERT`、`UPDATE`、`DELETE` 的开销：

```
INSERT → 写入 PK B+Tree → 更新所有二级索引 B+Tree
UPDATE → 如果索引列变了：删除旧索引项 + 插入新索引项
DELETE → 从 PK B+Tree 移除 → 从所有二级索引 B+Tree 移除
```

**经验值**：OLTP 场景每表 5-8 个索引是合理范围。超过后需要严格评估。

## 11. 总结

| 原则 | 原因 |
|------|------|
| **最左前缀** | 联合索引 (A,B,C) 只能从 A 开始匹配 |
| **等值在前，范围在后** | 列顺序：`=` 然后 `>` / `BETWEEN` / `LIKE` |
| **覆盖索引** | 查哪些列就把哪些列放进索引，避免回表 |
| **列上别用函数** | `WHERE fn(col) = x` 会让索引失效 |
| **前缀索引** | 长字符串只索引前 N 个字符 |
| **删掉无用索引** | 它们拖慢写入、浪费空间 |
| **每个查询先 EXPLAIN** | `type=ALL` 或 `Extra=filesort` = 红灯 |

> "最好的索引不是你猜出来的，是你测出来的。" —— 用 `EXPLAIN` 验证，用慢查询日志监控，持续迭代。
