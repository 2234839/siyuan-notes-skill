# 思源笔记查询技能

这是一个用于查询思源笔记内容的Claude技能，基于思源SQL查询系统规范，支持blocks表、refs表、attributes表的完整查询功能。

## 特性

- ✅ **基于思源官方SQL规范** - 完全兼容思源笔记数据库结构和查询语法
- ✅ **多表查询支持** - 支持blocks、refs、attributes三表关联查询
- ✅ **丰富查询类型** - 内容搜索、文档管理、引用查询、属性过滤等
- ✅ **SQLite语法** - 支持strftime等SQLite函数
- ✅ **嵌入块兼容** - 生成思源嵌入块格式的SQL查询
- ✅ **命令行工具** - 提供完整的CLI接口

## 安装配置

### 1. 安装依赖

```bash
cd siyuan-notes
npm install
```

### 2. 配置API Token

1. 打开思源笔记
2. 进入 **设置** → **关于**
3. 复制 **API Token**
4. 创建 `.env` 文件并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的API Token：

```env
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_API_TOKEN=your_actual_token
```

### 3. 测试连接

```bash
npm test
# 或者
node index.js check
```

## 使用方法

### 命令行使用

```bash
# 基础搜索
node index.js search "人工智能" p          # 搜索段落
node index.js search "关键词" h            # 搜索标题

# 文档管理
node index.js docs                         # 列出所有文档
node index.js headings "文档ID" h2         # 查询二级标题
node index.js blocks "文档ID" l            # 查询列表块

# 高级查询
node index.js backlinks "块ID"             # 查询反向链接
node index.js tasks "[ ]" 7                # 查询7天未完成任务
node index.js daily 20231010 20231013      # 查询日记
node index.js attr "custom-priority"       # 查询自定义属性
node index.js bookmarks "重要"             # 查询书签

# 实用工具
node index.js random "文档ID"              # 随机漫游
node index.js recent 7 h                   # 最近7天的标题
node index.js unreferenced "笔记本ID"      # 未被引用的文档
```

# 列出指定笔记本的文档
node index.js docs "20211231120000-abcdefg"

# 查询文档的子块
node index.js blocks "20211231120000-abcdefg"

# 搜索包含标签的笔记
node index.js tag "重要"

# 查询指向文档的链接
node index.js backlinks "20211231120000-abcdefg"

# 查询待办事项
node index.js tasks

# 查询最近7天的文档
node index.js recent 7
```

### 编程接口使用

```javascript
const siyuan = require('./index.js');

// 搜索笔记
const results = await siyuan.searchNotes('人工智能');
console.log(siyuan.formatResults(results));

// 列出笔记本
const notebooks = await siyuan.listNotebooks();

// 查询待办事项
const tasks = await siyuan.searchTasks('[ ]');
```

## SQL查询示例

### 基础查询

```sql
-- 搜索包含特定内容的块
SELECT * FROM blocks WHERE content LIKE '%关键词%' LIMIT 10

-- 查询特定文档的子块
SELECT * FROM blocks WHERE root_id = '文档ID' ORDER BY create_time

-- 搜索标题
SELECT * FROM blocks WHERE type = 'h1' AND content LIKE '%关键词%'
```

### 高级查询

```sql
-- 查询最近修改的内容
SELECT * FROM blocks
WHERE content LIKE '%关键词%'
ORDER BY updated_time DESC
LIMIT 20

-- 查询未完成的任务
SELECT * FROM blocks
WHERE content LIKE '%[ ]%'
AND type = 'l'
ORDER BY created_time DESC
```

## API文档

### 主要函数

- `executeSiyuanQuery(sql)` - 执行SQL查询
- `searchNotes(keyword, limit)` - 搜索笔记内容
- `listNotebooks()` - 列出所有笔记本
- `listDocuments(notebookId, docType)` - 列出笔记本文档
- `getDocumentBlocks(rootId, blockType)` - 查询文档子块
- `searchByTag(tag, limit)` - 搜索标签
- `searchBacklinks(targetId, limit)` - 查询反向链接
- `searchTasks(status, limit)` - 查询待办事项
- `getRecentDocuments(days, orderBy, limit)` - 查询最近文档
- `checkConnection()` - 检查连接状态

### 数据字段

- `id` - 块ID
- `content` - 块内容
- `type` - 块类型 (h1-h6, p, l, i, b等)
- `created_time` - 创建时间
- `updated_time` - 更新时间
- `root_id` - 根文档ID
- `parent_id` - 父块ID
- `notebook` - 笔记本ID
- `path` - 文档路径
- `ial` - 内联属性链接

## 注意事项

1. **思源笔记必须运行** - 确保思源笔记正在运行且API已启用
2. **API Token安全** - 不要将API Token提交到代码仓库
3. **网络访问** - 默认只允许本地访问
4. **查询限制** - 使用LIMIT避免返回过多结果

## 故障排除

### 连接失败
- 检查思源笔记是否运行
- 确认端口号是否正确 (默认6806)
- 验证API Token是否正确

### 查询错误
- 检查SQL语法是否正确
- 确认字段名拼写正确
- 使用简单SQL测试连接

### 性能问题
- 使用LIMIT限制结果数量
- 添加WHERE条件过滤
- 避免过于复杂的JOIN查询

## 许可证

MIT License