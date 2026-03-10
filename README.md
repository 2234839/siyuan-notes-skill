# SiYuan Notes Skill

思源笔记查询工具，为 AI Agent 提供思源笔记的搜索和查询能力。

## 功能特性

- ✅ 全文搜索（支持中文分词）
- ✅ SQL 查询（灵活的高级查询）
- ✅ 获取块内容（kramdown 源码）
- ✅ 获取资源文件路径（图片、附件等）
- ✅ **排除特定笔记本**（API 层面过滤）
- ✅ **排除特定笔记路径**（包含子笔记）

## 安装

1. 克隆仓库
```bash
git clone https://github.com/2234839/siyuan-notes-skill.git
cd siyuan-notes-skill
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的思源笔记配置
```

## 配置说明

### 基础配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `SIYUAN_HOST` | 思源笔记服务器地址 | `localhost` |
| `SIYUAN_PORT` | 端口号 | `6806` |
| `SIYUAN_USE_HTTPS` | 是否使用 HTTPS | `false` |
| `SIYUAN_API_TOKEN` | API Token | - |
| `SIYUAN_BASIC_AUTH_USER` | Basic Auth 用户名 | - |
| `SIYUAN_BASIC_AUTH_PASS` | Basic Auth 密码 | - |

### 排除配置（API 层面过滤）

#### 排除笔记本

排除指定的笔记本（通过笔记本 ID）：

```bash
# 排除单个笔记本
SIYUAN_EXCLUDE_BOXES=20210816161940-xxxxxxx

# 排除多个笔记本（逗号分隔）
SIYUAN_EXCLUDE_BOXES=20210816161940-xxxxxxx,20210816161941-yyyyyyy
```

**获取笔记本 ID：**
```sql
SELECT DISTINCT box, hpath FROM blocks WHERE type = 'd' LIMIT 10
```

#### 排除笔记路径

排除指定的笔记路径（包含所有子笔记）：

```bash
# 排除单个路径
SIYUAN_EXCLUDE_PATHS=/私密笔记

# 排除多个路径（逗号分隔）
SIYUAN_EXCLUDE_PATHS=/私密笔记,/个人日记
```

**注意：**
- 路径以 `/` 开头
- 会排除该笔记及其所有子笔记
- 例如：排除 `/私密笔记` 会同时排除 `/私密笔记/子笔记1`、`/私密笔记/子笔记2` 等

## 使用示例

### 全文搜索

```javascript
const siyuan = require('./index.js');

// 搜索关键词
const results = await siyuan.searchNotes('关键词', 20);

// 按类型搜索（只搜索标题）
const headings = await siyuan.searchNotes('关键词', 10, 'h');

// 翻页
const page2 = await siyuan.searchNotes('关键词', 20, null, 2);
```

### SQL 查询

```javascript
// 查询 markdown 字段（推荐）
const results = await siyuan.executeSiyuanQuery(
  "SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[x]%' LIMIT 20"
);

// 查询已完成的任务
const completed = await siyuan.executeSiyuanQuery(
  "SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[x]%' ORDER BY updated DESC LIMIT 20"
);

// 查询未完成的任务
const pending = await siyuan.executeSiyuanQuery(
  "SELECT id, markdown, updated FROM blocks WHERE markdown LIKE '%[ ]%' ORDER BY updated DESC LIMIT 20"
);
```

### 获取块内容

```javascript
const content = await siyuan.getBlockByID('块ID');
console.log(content);
```

### 获取资源文件路径

```javascript
const imagePath = await siyuan.getLocalAssetPath('块ID', 'assets/image-xxx.webp');
console.log(imagePath); // /home/user/.claude/skills/siyuan-notes-skill/.tmp/assets/image-xxx.webp
```

## 块类型参数

搜索时可以指定块类型：

| 参数 | 类型 |
|------|------|
| `h` | 标题 |
| `p` | 段落 |
| `d` | 文档 |
| `l` | 列表 |
| `c` | 代码 |
| `t` | 表格 |
| `b` | 引用 |

## API 层面过滤

本工具在 API 层面实现了内容过滤，确保敏感内容不会被查询到：

### 工作原理

1. **SQL 查询**：自动在 WHERE 子句中添加排除条件
2. **全文搜索**：在获取结果后过滤排除的内容

### 排除笔记本

```sql
-- 原始查询
SELECT * FROM blocks WHERE content LIKE '%关键词%'

-- 自动修改为
SELECT * FROM blocks WHERE box NOT IN ('20210816161940-3mfvumm') AND content LIKE '%关键词%'
```

### 排除笔记路径

```sql
-- 原始查询
SELECT * FROM blocks WHERE content LIKE '%关键词%'

-- 自动修改为
SELECT * FROM blocks WHERE hpath NOT LIKE '/姑射山人%' AND content LIKE '%关键词%'
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.1.0 (2026-03-10)

- ✨ 新增：排除特定笔记本功能（`SIYUAN_EXCLUDE_BOXES`）
- ✨ 新增：排除特定笔记路径功能（`SIYUAN_EXCLUDE_PATHS`）
- 🔧 优化：优先使用 `markdown` 字段（保留格式标记）
- 📝 文档：更新配置说明和使用示例

### v1.0.0

- 初始版本
- 全文搜索
- SQL 查询
- 获取块内容
- 获取资源文件路径
