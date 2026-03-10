---
name: siyuan-notes
description: 思源笔记查询工具，如果用户的请求涉及查找、检索、浏览他们的笔记内容，就应该使用这个技能，例如:查询我的xxx
---

## ⚠️ 重要：优先使用 Markdown 字段

**默认查询 `markdown` 字段（源码），而不是 `content`（纯文本）**

**原因：**
- `markdown` 包含完整的格式标记（如 `[x]`、`[ ]`、`#`、`*` 等）
- 可以准确识别任务完成状态（`[x]` = 完成，`[ ]` = 未完成）
- 可以看到完整的标题层级、列表结构等

**示例：**
```sql
-- ✅ 推荐：查询 markdown 字段
SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[x]%'

-- ❌ 不推荐：只查询 content 字段（会丢失格式信息）
SELECT id, content, updated FROM blocks WHERE content LIKE '%完成%'
```

---

## 快速使用指南

### 核心方法

#### searchNotes - 全文搜索笔记

```bash
# 全文搜索（推荐，支持中文分词，返回格式化字符串）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { console.log(await s.searchNotes('关键词', 20)); })();"

# 按类型搜索（只搜索标题）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { console.log(await s.searchNotes('关键词', 10, 'h')); })();"

# 翻页（第2页）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { console.log(await s.searchNotes('关键词', 20, null, 2)); })();"
```

**返回格式：**

- **单条结果**：`📄 [文档ID] /路径 > [类型 块ID] 内容`
- **多条结果**：
  ```
  📄 [文档ID] /路径
    1. [类型 块ID] 内容
    2. [类型 块ID] 内容
  ```
- **内容预览**：最多显示 150 字符，超出会显示 `...`
- **优先显示 markdown**：包含格式标记（如 `[x]`、`[ ]`、`#` 等）

#### getBlockByID - 获取块的详细内容

```bash
# 获取指定块的内容（返回 kramdown 源码，文档块包含反向链接）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { console.log(await s.getBlockByID('块ID')); })();"
```

#### getLocalAssetPath - 获取资源文件的本地路径

```bash
# 获取资源文件（图片、附件等）的本地完整路径
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { 
  const path = await s.getLocalAssetPath('块ID', 'assets/image-xxx.webp'); 
  console.log(path); 
})();"
```

**返回示例：**
```
/home/gs/.claude/skills/siyuan-notes/.tmp/assets/image-20251223152400-195ojeh.webp
```

**使用场景：**
- 笔记中有图片需要分析时，获取本地路径后可直接使用 image-processing 技能
- 支持本地部署的思源笔记（localhost）
- 自动处理认证和临时文件管理

#### extractAssetsFromBlock - 提取块中的所有资源

```bash
# 提取指定块中所有的资源文件路径
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { 
  const assets = await s.extractAssetsFromBlock('块ID'); 
  console.log(assets); 
})();"
```

**返回格式：**
```json
[
  {
    "path": "assets/image-20251223151651-8wilav6.webp",
    "type": "image"
  }
]
```

#### SQL查询（高级用法）

```bash
# SQL查询（返回精简后的原始数据数组，包含 markdown 字段）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { console.log(await s.executeSiyuanQuery('SELECT id, markdown, updated FROM blocks WHERE markdown LIKE \\\"%关键词%\\\" LIMIT 10')); })();"
```

### 块类型参数

`h`-标题 `p`-段落 `d`-文档 `l`-列表 `c`-代码 `t`-表格 `b`-引用

### ⚠️ 限制

使用绝对路径引用 index.js，避免路径问题

---

## 快捷查询

### 查询工作 TODO

```bash
# 查询最近的工作待办（按更新时间倒序，包含 markdown 格式）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { 
  const results = await s.executeSiyuanQuery(\"SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%#工作/todo#%' ORDER BY updated DESC LIMIT 30\"); 
  results.forEach((r, i) => {
    const date = r.updated.slice(0, 8);
    const md = r.markdown.substring(0, 100);
    console.log(\`\${i+1}. [\${date}] \${md}\`);
  });
})();"
```

### 查询已完成的任务

```bash
# 查询最近完成的任务（[x] 标记）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { 
  const results = await s.executeSiyuanQuery(\"SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[x]%' ORDER BY updated DESC LIMIT 20\"); 
  results.forEach((r, i) => {
    const date = r.updated.slice(0, 8);
    console.log(\`\${i+1}. [\${date}] \${r.markdown.substring(0, 80)}\`);
  });
})();"
```

### 查询未完成的任务

```bash
# 查询最近未完成的任务（[ ] 标记）
node -e "const s = require('/home/node/.openclaw/workspace/skills/siyuan/index.js'); (async () => { 
  const results = await s.executeSiyuanQuery(\"SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[ ]%' ORDER BY updated DESC LIMIT 20\"); 
  results.forEach((r, i) => {
    const date = r.updated.slice(0, 8);
    console.log(\`\${i+1}. [\${date}] \${r.markdown.substring(0, 80)}\`);
  });
})();"
```

---

## 搜索策略指南

### 核心原则

持续尝试，直到解决用户问题：

1. **尝试同义词/相关词**
2. **尝试模糊关键词**（拆分复合词）
3. **尝试不同块类型**（标题、段落、文档）
4. **尝试翻页获取更多结果**
5. **尝试SQL组合查询**
6. **优先使用 markdown 字段**

### 关键词扩展技巧

| 用户查询 | 可尝试的关键词 |
|---------|--------------|
| 图片压缩 | 压缩、优化、减小、webp、图片处理 |
| 工作总结 | 总结、周报、月报、汇报、复盘 |
| bug修复 | bug、修复、问题、issue、调试 |
| 学习笔记 | 学习、笔记、记录、整理、心得 |
| 已完成任务 | `[x]`、完成、done |

---

## SQL 查询参考

### blocks 表结构

- `id`: 块ID | `type`: 块类型(d/h/p/l/c/t/b) | `subtype`: 子类型
- `content`: 纯文本 | `markdown`: Markdown文本（**推荐**）| `hpath`: 人类可读路径
- `created/updated`: 创建/更新时间 (YYYYMMDDHHmmss)
- `root_id`: 所属文档ID | `parent_id`: 父块ID | `box`: 笔记本ID

### SQL 示例

```sql
-- ✅ 推荐：查询 markdown 字段
SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%关键词%'

-- 查询已完成的任务
SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[x]%'

-- 查询未完成的任务
SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[ ]%'

-- 查询最近7天
SELECT id, markdown, updated FROM blocks WHERE updated > strftime('%Y%m%d%H%M%S', datetime('now', '-7 day'))

-- 查询反向链接
SELECT id, markdown FROM blocks WHERE id IN (SELECT block_id FROM refs WHERE def_block_id='块ID')
```

---

## 🔒 排除笔记配置（API 层面过滤）

**配置文件：** `skills/siyuan/.env`

### 方式 1：排除笔记路径（推荐）

**更可视化，推荐使用！**

```bash
# 排除的笔记路径（多个用逗号分隔，包含子笔记）
# 示例：排除敏感笔记及其所有子笔记
SIYUAN_EXCLUDE_PATHS=/私密笔记,/个人日记
```

**特点：**
- ✅ 路径更直观（`/私密笔记` 比 ID 更易读）
- ✅ 自动排除所有子笔记（`/私密笔记/子笔记1`、`/私密笔记/子笔记2` 等）
- ✅ 路径更稳定（笔记本 ID 可能变化）

**如何查找路径：**
```bash
# 搜索特定关键词，查看返回的路径
node -e "const s = require('./index.js'); (async () => { console.log(await s.searchNotes('关键词', 10)); })();"
```

### 方式 2：排除笔记本 ID

```bash
# 排除的笔记本ID（多个用逗号分隔）
# 示例：排除敏感笔记本
SIYUAN_EXCLUDE_BOXES=20210816161940-xxxxxxx
```

**如何获取笔记本 ID：**
```bash
# 查询所有笔记本
node -e "const s = require('./index.js'); (async () => { 
  const results = await s.executeSiyuanQuery(\"SELECT DISTINCT box FROM blocks LIMIT 20\");
  console.log(results);
})();"
```

### API 层面过滤机制

本工具在 API 层面实现了内容过滤，确保敏感内容不会被查询到：

**SQL 查询：**
```sql
-- 原始查询
SELECT * FROM blocks WHERE content LIKE '%关键词%'

-- 自动修改为（排除笔记本）
SELECT * FROM blocks WHERE box NOT IN ('笔记本ID') AND content LIKE '%关键词%'

-- 自动修改为（排除路径）
SELECT * FROM blocks WHERE hpath NOT LIKE '/排除路径%' AND content LIKE '%关键词%'
```

**全文搜索：**
- 在获取结果后过滤掉排除的内容
- 确保敏感内容不会出现在搜索结果中

**使用场景：**
- 排除包含敏感信息的笔记
- 排除私密日记、个人笔记等
- 排除特定主题的笔记（如工作笔记、财务记录等）
