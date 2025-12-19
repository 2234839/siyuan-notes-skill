---
name: siyuan-notes
description: 思源笔记查询工具，基于思源SQL查询系统，支持blocks、refs、attributes等表的完整查询功能
---

# 思源笔记查询技能

## 技能概述

这是一个专业的思源笔记查询工具，通过思源笔记的SQL API接口提供强大的数据检索能力。基于SQLite数据库，支持复杂的关系查询、全文搜索和属性过滤。

## 核心功能特性

### 🔍 强大的SQL查询引擎
- **完整SQLite语法**: 支持所有SQLite标准语法和函数
- **多表关联查询**: 同时查询blocks、refs、attributes等多个表
- **全文搜索支持**: 利用blocks_fts表进行高效文本检索
- **时间函数**: 支持strftime()等SQLite时间函数

### 🔧 双重认证安全
- **API Token认证**: 使用思源笔记的官方Token认证
- **HTTP Basic Auth**: 支持额外的Basic Auth中间件保护
- **智能认证**: 自动识别和适配不同的认证组合
- **冲突解决**: Basic Auth用头，Token用URL参数，避免冲突

### 📊 实时数据库结构 (基于实际探索)

#### blocks 表 - 核心内容块表
```sql
-- 字段说明 (按重要性排序)
content: 纯文本内容 - 最常用的搜索字段
markdown: 完整Markdown内容 - 包含格式化信息
type: 块类型 - 段落(p)/标题(h)/列表(l)/图片(i)/文档(d)/代码块(c)/表格(tb)等
subtype: 子类型 - 如h1-h6标题级别
created/updated: 时间戳 - 用于时间范围查询
hpath: 人类可读路径 - 文档定位
parent_id: 父块ID - 层级关系
root_id: 根文档ID - 文档归属
box: 笔记本ID - 笔记本隔离
id: 唯一标识 - 精确定位
length: 内容长度 - 可用于过滤短内容
tag: 标签信息 - 标签分类
ial: 内联属性 - 块级属性设置
name: 块名称 - 命名块
alias: 别名 - 多名称支持
memo: 备注 - 附加信息
hash: 内容哈希 - 重复检测
sort: 排序 - 自定义排序
path: 文件路径 - 系统路径

-- 常见块类型分布 (因用户而异)
段落(p): 最常见的文本内容
图片(i): 图片和媒体文件
列表(l): 有序列表和无序列表
标题(h): 各级标题 (h1-h6)
文档(d): 文档根节点
块引用(b): 块引用内容
代码块(c): 代码和脚本
表格(tb): 表格数据
嵌入查询(query_embed): 动态嵌入查询
符号(s): 特殊符号和标记
```

#### refs 表 - 引用关系表
```sql
-- 字段说明
def_block_id: 被引用块ID - 链接目标
def_block_root_id: 被引用文档ID - 目标文档
block_id: 引用所在块ID - 来源位置
content: 引用锚文本 - 链接文本
type: 引用类型 - 链接分类

-- 常见引用类型
textmark: 文本标记、高亮
query_embed: 嵌入查询引用
```

#### attributes 表 - 属性表
```sql
-- 字段说明
name: 属性名称 - 支持自定义属性
value: 属性值 - 属性内容
block_id: 关联块ID - 属性归属
type: 属性类型 - 属性分类
root_id: 根文档ID - 文档级属性
box: 笔记本ID - 笔记本级属性
```

#### 全文搜索支持
```sql
blocks_fts: 全文搜索表 - 高效文本检索
blocks_fts_case_insensitive: 不区分大小写搜索
blocks_fts_content: 搜索内容索引
blocks_fts_data: 搜索数据存储
```

## 实用查询模板

### 🎯 日常常用查询

#### 1. 内容搜索 (最常用)
```sql
-- 基础文本搜索
SELECT content, created, hpath
FROM blocks
WHERE content LIKE '%关键词%' AND type = 'p'
ORDER BY updated DESC
LIMIT 20

-- 全文搜索 (更快)
SELECT b.content, b.created, b.hpath
FROM blocks b
JOIN blocks_fts fts ON b.id = fts.rowid
WHERE blocks_fts MATCH '关键词'
LIMIT 20

-- 按文档搜索特定内容
SELECT content, type, created
FROM blocks
WHERE hpath LIKE '%项目名称%'
AND content LIKE '%重要%'
ORDER BY created DESC
```

#### 2. 文档管理查询
```sql
-- 列出所有文档 (按更新时间)
SELECT id, content, updated, hpath
FROM blocks
WHERE type = 'd'
ORDER BY updated DESC
LIMIT 50

-- 查找特定笔记本下的文档
SELECT * FROM blocks
WHERE box = '20210816161940-3mfvumm'
AND type = 'd'
ORDER BY updated DESC

-- 查找最近修改的标题
SELECT content, type, subtype, hpath, updated
FROM blocks
WHERE type = 'h' AND content IS NOT NULL
ORDER BY updated DESC
LIMIT 10
```

#### 3. 任务和时间管理
```sql
-- 查找所有列表项 (可能包含任务)
SELECT content, created, hpath
FROM blocks
WHERE type = 'l'
AND content LIKE '%待办%'
ORDER BY updated DESC
LIMIT 15

-- 按时间范围查询内容
SELECT content, type, created, hpath
FROM blocks
WHERE created > '20250101000000'
ORDER BY created DESC
LIMIT 20

-- 查找近期更新的内容
SELECT * FROM blocks
WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 days'))
ORDER BY updated DESC
LIMIT 10
```

#### 4. 媒体和资源查询
```sql
-- 查找所有图片块
SELECT content, created, hpath
FROM blocks
WHERE type = 'i'
ORDER BY updated DESC
LIMIT 20

-- 查找代码块
SELECT content, created, hpath
FROM blocks
WHERE type = 'c'
ORDER BY updated DESC
LIMIT 15

-- 查找表格内容
SELECT content, created, hpath
FROM blocks
WHERE type = 'tb'
ORDER BY updated DESC
LIMIT 10
```

#### 5. 引用和链接分析
```sql
-- 查找所有引用关系
SELECT r.content, b.hpath, b.type
FROM refs r
JOIN blocks b ON r.block_id = b.id
WHERE r.type = 'textmark'
LIMIT 20

-- 查找包含特定关键词的嵌入查询
SELECT content, created, hpath
FROM blocks
WHERE type = 'query_embed'
AND content LIKE '%关键词%'
```

### 🛠 高级查询技巧

#### 性能优化查询
```sql
-- 使用LIMIT避免过多结果
SELECT content FROM blocks WHERE type = 'p' LIMIT 10

-- 使用长度过滤排除空内容
SELECT content, hpath FROM blocks
WHERE length > 10 AND content IS NOT NULL
ORDER BY updated DESC
LIMIT 20

-- 使用索引友好的查询
SELECT * FROM blocks WHERE box = '笔记本ID' AND type = 'd'
```

#### 复杂关联查询
```sql
-- 查询包含特定内容的文档及其子块
SELECT d.content as doc_title, c.content as child_content
FROM blocks d
LEFT JOIN blocks c ON c.root_id = d.id
WHERE d.type = 'd' AND d.content LIKE '%重要%'
ORDER BY d.updated DESC
LIMIT 30

-- 统计各类块的数量
SELECT type, COUNT(*) as count, AVG(length) as avg_length
FROM blocks
GROUP BY type
ORDER BY count DESC
```

## 使用指南

### 快速开始

#### 环境配置 (首次使用)
技能会自动检测环境配置，如果未设置会显示详细配置步骤：
1. 获取思源笔记API Token (设置 → 关于 → API Token)
2. 创建 `.env` 文件配置服务器信息
3. 如果有Basic Auth中间件，配置认证信息

#### 三种使用方式

**方式1: 命令行工具 (推荐日常使用)**
```bash
# 基础搜索
node index.js search "人工智能"        # 搜索关键词
node index.js search "开发" 5          # 搜索前5个结果
node index.js search "重要" h1         # 在标题中搜索

# 文档管理
node index.js docs                     # 列出所有文档
node index.js recent 7                # 最近7天更新的内容

# 检查连接
node index.js check                    # 验证配置和连接
```

**方式2: 编程接口 (集成使用)**
```javascript
const siyuan = require('./index.js');

// 搜索内容
const results = await siyuan.searchNotes('关键词');
console.log(`找到 ${results.length} 条结果`);

// 列出文档
const docs = await siyuan.listDocuments();
docs.forEach(doc => console.log(doc.content));
```

**方式3: 自定义SQL (高级查询)**
```javascript
const { executeSiyuanQuery } = require('./index.js');

const sql = `
    SELECT content, created, hpath
    FROM blocks
    WHERE type = 'h1'
    AND created > '20250101000000'
    ORDER BY updated DESC
    LIMIT 10
`;

const results = await executeSiyuanQuery(sql);
```

### 最佳实践建议

#### 查询优化
1. **合理使用LIMIT**: 避免返回过多结果，推荐10-50条
2. **指定具体类型**: 使用`WHERE type = 'p'`过滤不需要的块类型
3. **时间范围过滤**: 使用created/updated字段限制时间范围
4. **内容长度过滤**: 使用`length > 10`排除空内容或过短内容

#### 搜索技巧
1. **精确搜索**: 使用`=`进行精确匹配
2. **模糊搜索**: 使用`LIKE '%关键词%'`进行模糊搜索
3. **全文搜索**: 对于大量文本，考虑使用blocks_fts表
4. **路径搜索**: 使用`hpath LIKE '%文档名%'`按文档搜索

#### 结果处理
1. **去重处理**: 使用`DISTINCT`避免重复结果
2. **排序优化**: 使用`ORDER BY updated DESC`获取最新内容
3. **字段选择**: 只选择需要的字段，提高查询效率

## 实际应用场景

### 📚 知识管理
- **内容检索**: 快速查找特定主题的笔记内容
- **文档整理**: 按时间或类型整理文档结构
- **标签管理**: 基于内容自动分类和标记

### 📈 项目管理
- **任务跟踪**: 查找包含项目关键词的相关内容
- **进度回顾**: 按时间范围查看项目进展
- **资源收集**: 整理项目相关的图片、代码、表格等资源

### 🔍 研究分析
- **关联分析**: 通过引用表分析内容关联关系
- **趋势分析**: 基于时间戳分析内容创作趋势
- **知识图谱**: 构建笔记内容的关联网络

## 错误处理和故障排除

### 常见问题解决
1. **连接失败**: 检查思源笔记是否运行，端口是否正确
2. **认证错误**: 验证API Token和Basic Auth配置
3. **查询超时**: 增加LIMIT条件，减少结果集大小
4. **语法错误**: 检查SQL语法，特别是引号和关键字使用

### 调试技巧
1. **简单测试**: 先用`SELECT 1`测试连接
2. **分步查询**: 从简单查询开始，逐步增加复杂度
3. **结果验证**: 检查返回结果的字段和数量是否符合预期

---

## Instructions (给AI的使用指南)

作为AI助手，使用这个技能时请遵循以下原则：

### 查询构建原则
1. **优先使用content字段进行文本搜索**，这是最直接的方式
2. **合理使用LIMIT**，避免返回过多结果影响用户体验
3. **按updated DESC排序**，优先展示最新内容
4. **根据查询目的选择合适的type**，如搜索用'p'，标题用'h'

### 用户意图理解
1. **搜索关键词**: 使用content LIKE '%关键词%'
2. **查找文档**: 使用type = 'd'
3. **查找标题**: 使用type = 'h'
4. **时间相关查询**: 使用created/updated字段和时间函数
5. **特定文档搜索**: 使用hpath LIKE '%文档名%'

### 结果展示优化
1. **返回内容摘要**: 选择最重要的content字段
2. **提供上下文**: 包含hpath和时间信息
3. **控制结果数量**: 一般返回10-20条最相关结果
4. **格式化输出**: 使用清晰的格式展示查询结果

### 性能考虑
1. **避免复杂嵌套查询**，保持查询简单高效
2. **使用具体的过滤条件**，减少不必要的计算
3. **缓存常用查询结果**，提高响应速度
4. **批量操作优于多次单独查询**

这个技能为AI助手提供了强大的思源笔记数据访问能力，能够帮助用户快速、准确地找到所需信息，提升知识管理效率。