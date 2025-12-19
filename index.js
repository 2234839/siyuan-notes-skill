/**
 * 思源笔记查询工具
 * 提供SQL查询、文档搜索、笔记本管理等功能
 * 基于思源笔记SQL查询系统规范
 */

const fs = require('fs');
const path = require('path');

// 加载.env文件
function loadEnvFile() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const [key, ...valueParts] = trimmedLine.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').trim();
                        process.env[key.trim()] = value;
                    }
                }
            });
            console.log('✅ 已加载.env配置文件');
        }
    } catch (error) {
        console.log('⚠️  未找到.env文件或加载失败:', error.message);
    }
}

// 加载环境变量
loadEnvFile();

/** 环境变量或默认配置 */
const SIYUAN_HOST = process.env.SIYUAN_HOST || 'localhost';
const SIYUAN_PORT = process.env.SIYUAN_PORT || '';
const SIYUAN_API_TOKEN = process.env.SIYUAN_API_TOKEN || '';
const SIYUAN_USE_HTTPS = process.env.SIYUAN_USE_HTTPS === 'true';
const SIYUAN_BASIC_AUTH_USER = process.env.SIYUAN_BASIC_AUTH_USER || '';
const SIYUAN_BASIC_AUTH_PASS = process.env.SIYUAN_BASIC_AUTH_PASS || '';

/** API端点配置 */
const API_BASE_URL = `${SIYUAN_USE_HTTPS ? 'https' : 'http'}://${SIYUAN_HOST}${SIYUAN_PORT ? ':' + SIYU_PORT : ''}`;
// 测试不同的可能端点
const POSSIBLE_ENDPOINTS = [
    '/api/query/sql',
    '/api/query/sql/',
    '/api/sql/query',
    '/api/sql/query/',
    '/api/filetree/listDocsByPath' // 从你的正确请求中找到的端点
];
const SQL_QUERY_ENDPOINT = `${API_BASE_URL}/api/query/sql`;

// 调试信息
console.log(`📡 服务器地址: ${API_BASE_URL}/api/query/sql`);
console.log(`🔑 API Token: ${SIYUAN_API_TOKEN ? '已配置' : '未配置'}`);
console.log(`🔐 Basic Auth: ${SIYUAN_BASIC_AUTH_USER ? `用户: ${SIYUAN_BASIC_AUTH_USER}` : '未配置'}`);

/** HTTP Basic Auth编码 */
function getBasicAuthHeader() {
    if (!SIYUAN_BASIC_AUTH_USER || !SIYUAN_BASIC_AUTH_PASS) {
        return {};
    }
    const credentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
    return { 'Authorization': `Basic ${credentials}` };
}

/**
 * 检查环境配置是否完整
 * @returns {boolean} 配置是否完整
 */
function checkEnvironmentConfig() {
    if (!SIYUAN_API_TOKEN || SIYUAN_API_TOKEN.trim() === '') {
        console.error(`
❌ 错误: 未配置思源笔记API Token

请按以下步骤配置:

1. 打开思源笔记
2. 进入 设置 → 关于
3. 复制 API Token
4. 创建 .env 文件并填入配置:

cp .env.example .env

然后编辑 .env 文件，填入你的配置:

# 基础配置
SIYUAN_HOST=你的服务器地址
SIYUAN_PORT=端口号 (HTTPS且无特殊端口可留空)
SIYUAN_USE_HTTPS=true (如果使用HTTPS)
SIYUAN_API_TOKEN=你的实际API_TOKEN

# 可选：HTTP Basic Auth (如果启用了Basic Auth)
SIYUAN_BASIC_AUTH_USER=用户名
SIYUAN_BASIC_AUTH_PASS=密码

# 示例配置 (本地)
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_USE_HTTPS=false
SIYUAN_API_TOKEN=your_api_token_here

# 示例配置 (远程服务器+HTTPS+Basic Auth)
SIYUAN_HOST=note.example.com
SIYUAN_PORT=
SIYUAN_USE_HTTPS=true
SIYUAN_API_TOKEN=your_api_token
SIYUAN_BASIC_AUTH_USER=username
SIYUAN_BASIC_AUTH_PASS=password

配置完成后重新运行命令。
        `);
        return false;
    }
    return true;
}

/**
 * 执行思源笔记SQL查询
 * @param {string} sqlQuery - SQL查询语句
 * @returns {Promise<Object>} 查询结果
 */
async function executeSiyuanQuery(sqlQuery) {
    // 检查环境配置
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    try {
        // 处理认证：区分Basic Auth中间件和思源Token认证
        const headers = {
            'Content-Type': 'application/json'
        };

        let requestBody = {
            stmt: sqlQuery
        };

        // 根据是否配置Basic Auth来决定认证方式
        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            // 场景1：有Basic Auth中间件 + 思源Token
            // Basic Auth使用Authorization头，思源Token作为URL参数避免冲突
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;

            // Token通过URL参数传递，避免与Basic Auth的Authorization头冲突
            const urlWithToken = `${SQL_QUERY_ENDPOINT}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

            console.log('🔐 使用双重认证：Basic Auth (Authorization头) + Token (URL参数)');

            const response = await fetch(urlWithToken, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.code !== 0) {
                throw new Error(`思源API错误: ${result.msg}`);
            }

            return result.data;
        } else {
            // 场景2：只有思源Token认证
            // 使用思源官方推荐的方式：Authorization: Token <token>
            headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

            console.log('🔑 使用思源Token认证：Authorization头');

            const response = await fetch(SQL_QUERY_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.code !== 0) {
                throw new Error(`思源API错误: ${result.msg}`);
            }

            return result.data;
        }
    } catch (error) {
        console.error('思源笔记查询失败:', error.message);
        throw error;
    }
}

/**
 * 搜索包含关键词的笔记内容 (基于思源SQL规范)
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @param {string} blockType - 块类型过滤
 * @returns {Promise<Array>} 查询结果
 */
async function searchNotes(keyword, limit = 20, blockType = null) {
    let sql = `
        SELECT id, content, type, subtype, created, updated, root_id, parent_id, box, path, hpath
        FROM blocks
        WHERE markdown LIKE '%${keyword}%'
    `;

    if (blockType) {
        sql += ` AND type = '${blockType}'`;
    }

    sql += `
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询所有文档块
 * @param {string} notebookId - 笔记本ID过滤
 * @returns {Promise<Array>} 文档列表
 */
async function listDocuments(notebookId = null) {
    let sql = `
        SELECT id, content, created, updated, box, path, hpath
        FROM blocks
        WHERE type = 'd'
    `;

    if (notebookId) {
        sql += ` AND box = '${notebookId}'`;
    }

    sql += ' ORDER BY updated DESC';

    return await executeSiyuanQuery(sql);
}

/**
 * 查询指定文档下的标题块
 * @param {string} rootId - 根文档ID
 * @param {string} headingType - 标题类型 (h1, h2等)
 * @returns {Promise<Array>} 标题列表
 */
async function getDocumentHeadings(rootId, headingType = null) {
    let sql = `
        SELECT id, content, subtype, created, updated, parent_id
        FROM blocks
        WHERE root_id = '${rootId}'
        AND type = 'h'
    `;

    if (headingType) {
        sql += ` AND subtype = '${headingType}'`;
    }

    sql += ' ORDER BY created ASC';

    return await executeSiyuanQuery(sql);
}

/**
 * 查询指定文档的所有子块
 * @param {string} rootId - 根文档ID
 * @param {string} blockType - 块类型过滤
 * @returns {Promise<Array>} 子块列表
 */
async function getDocumentBlocks(rootId, blockType = null) {
    let sql = `
        SELECT id, content, type, subtype, created, updated, parent_id, ial
        FROM blocks
        WHERE root_id = '${rootId}'
    `;

    if (blockType) {
        sql += ` AND type = '${blockType}'`;
    }

    sql += ' ORDER BY created ASC';

    return await executeSiyuanQuery(sql);
}

/**
 * 查询包含特定标签的笔记
 * @param {string} tag - 标签名 (不需要包含#)
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 包含标签的笔记列表
 */
async function searchByTag(tag, limit = 20) {
    const sql = `
        SELECT id, content, type, subtype, created, updated, root_id, parent_id
        FROM blocks
        WHERE content LIKE '%#${tag}%'
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询块的反向链接 (引用了这个块的所有块)
 * @param {string} defBlockId - 被引用的块ID
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 反向链接列表
 */
async function getBacklinks(defBlockId, limit = 999) {
    const sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM refs WHERE def_block_id = '${defBlockId}'
        )
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询任务列表
 * @param {string} status - 任务状态 ('[ ]'未完成, '[x]'已完成, '[-]'进行中)
 * @param {number} days - 查询最近N天的任务
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 任务列表
 */
async function searchTasks(status = '[ ]', days = 7, limit = 50) {
    const sql = `
        SELECT * FROM blocks
        WHERE type = 'l' AND subtype = 't'
        AND created > strftime('%Y%m%d%H%M%S', datetime('now', '-${days} day'))
        AND markdown LIKE '* ${status} %'
        AND parent_id NOT IN (
            SELECT id FROM blocks WHERE subtype = 't'
        )
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询Daily Note (日记)
 * @param {string} startDate - 开始日期 (格式: YYYYMMDD)
 * @param {string} endDate - 结束日期 (格式: YYYYMMDD)
 * @returns {Promise<Array>} Daily Note列表
 */
async function getDailyNotes(startDate, endDate) {
    const sql = `
        SELECT DISTINCT B.* FROM blocks AS B
        JOIN attributes AS A ON B.id = A.block_id
        WHERE A.name LIKE 'custom-dailynote-%'
        AND B.type = 'd'
        AND A.value >= '${startDate}'
        AND A.value <= '${endDate}'
        ORDER BY A.value DESC
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询包含特定属性的块
 * @param {string} attrName - 属性名称
 * @param {string} attrValue - 属性值 (可选)
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 包含属性的块列表
 */
async function searchByAttribute(attrName, attrValue = null, limit = 20) {
    let sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM attributes
            WHERE name = '${attrName}'
    `;

    if (attrValue) {
        sql += ` AND value = '${attrValue}'`;
    }

    sql += `
        )
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询书签
 * @param {string} bookmarkName - 书签名 (可选)
 * @returns {Promise<Array>} 书签列表
 */
async function getBookmarks(bookmarkName = null) {
    let sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM attributes
            WHERE name = 'bookmark'
    `;

    if (bookmarkName) {
        sql += ` AND value = '${bookmarkName}'`;
    }

    sql += ') ORDER BY updated DESC';

    return await executeSiyuanQuery(sql);
}

/**
 * 随机漫游某个文档内的标题块
 * @param {string} rootId - 文档ID
 * @returns {Promise<Array>} 随机标题块
 */
async function getRandomHeading(rootId) {
    const sql = `
        SELECT * FROM blocks
        WHERE root_id = '${rootId}' AND type = 'h'
        ORDER BY random() LIMIT 1
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询最近创建或修改的块
 * @param {number} days - 天数
 * @param {string} orderBy - 排序方式 (created/updated)
 * @param {string} blockType - 块类型过滤
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 最近块列表
 */
async function getRecentBlocks(days = 7, orderBy = 'updated', blockType = null, limit = 50) {
    const dateThreshold = strftime('%Y%m%d%H%M%S', Date.now() - (days * 24 * 60 * 60 * 1000));

    let sql = `
        SELECT id, content, type, subtype, created, updated, root_id, box, hpath
        FROM blocks
        WHERE ${orderBy} > '${dateThreshold}'
    `;

    if (blockType) {
        sql += ` AND type = '${blockType}'`;
    }

    sql += `
        ORDER BY ${orderBy} DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询笔记本下未被引用的文档
 * @param {string} notebookId - 笔记本ID
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 未被引用的文档列表
 */
async function getUnreferencedDocuments(notebookId, limit = 128) {
    const sql = `
        SELECT * FROM blocks AS B
        WHERE B.type = 'd'
        AND box = '${notebookId}'
        AND B.id NOT IN (
            SELECT DISTINCT R.def_block_id FROM refs AS R
        )
        ORDER BY updated DESC
        LIMIT ${limit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 检查思源笔记连接状态
 * @returns {Promise<boolean>} 连接是否正常
 */
async function checkConnection() {
    // 先检查环境配置
    if (!checkEnvironmentConfig()) {
        return false;
    }

    try {
        const result = await executeSiyuanQuery('SELECT 1 as test');
        return result && result.length > 0;
    } catch (error) {
        console.error('思源笔记连接检查失败:', error.message);
        console.log('\n请检查:');
        console.log('1. 思源笔记是否正在运行');
        console.log('2. API端口是否为6806 (可在设置中修改)');
        console.log('3. API Token是否正确');
        return false;
    }
}

/**
 * 格式化思源时间戳为可读字符串
 * @param {string} timeStr - 思源时间戳 (YYYYMMDDHHMMSS)
 * @returns {string} 格式化后的时间字符串
 */
function formatSiyuanTime(timeStr) {
    if (!timeStr || timeStr.length !== 14) {
        return '未知时间';
    }

    const year = timeStr.substring(0, 4);
    const month = timeStr.substring(4, 6);
    const day = timeStr.substring(6, 8);
    const hour = timeStr.substring(8, 10);
    const minute = timeStr.substring(10, 12);
    const second = timeStr.substring(12, 14);

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 格式化查询结果为可读字符串
 * @param {Array} results - 查询结果数组
 * @returns {string} 格式化后的字符串
 */
function formatResults(results) {
    if (!results || results.length === 0) {
        return '查询结果为空';
    }

    return results.map((item, index) => {
        const time = formatSiyuanTime(item.updated || item.created);
        const type = item.subtype || item.type || 'unknown';
        const content = item.content?.length > 100
            ? item.content.substring(0, 100) + '...'
            : item.content || '(无内容)';

        return `${index + 1}. [${time}] ${type}: ${content}`;
    }).join('\n');
}

/**
 * 生成思源嵌入块格式的SQL查询
 * @param {string} sqlQuery - SQL查询语句
 * @returns {string} 嵌入块格式的SQL
 */
function generateEmbedBlock(sqlQuery) {
    return `{{{{select * from blocks WHERE ${sqlQuery}}}}}`;
}

/**
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);

    // 除了check命令，其他命令都需要检查环境配置
    if (args.length > 0 && args[0] !== 'check' && !checkEnvironmentConfig()) {
        return;
    }

    if (args.length === 0) {
        console.log(`
思源笔记查询工具使用说明 (基于思源SQL规范):

用法:
  node index.js <命令> [参数]

命令:
  search <关键词> [类型]     - 搜索包含关键词的笔记 (类型: p段落, h标题, l列表等)
  docs [笔记本ID]           - 列出所有文档或指定笔记本的文档
  headings <文档ID> [级别]   - 查询文档标题 (级别: h1, h2等)
  blocks <文档ID> [类型]     - 查询文档子块
  tag <标签名>              - 搜索包含标签的笔记
  backlinks <块ID>          - 查询块的反向链接
  tasks [状态] [天数]        - 查询任务列表 (状态: [ ]未完成, [x]已完成, [-]进行中)
  daily <开始日期> <结束日期> - 查询Daily Note (日期格式: YYYYMMDD)
  attr <属性名> [属性值]     - 查询包含属性的块
  bookmarks [书签名]         - 查询书签
  random <文档ID>           - 随机漫游文档标题
  recent [天数] [类型]       - 查询最近修改的块
  unreferenced <笔记本ID>    - 查询未被引用的文档
  check                    - 检查连接状态

示例:
  node index.js search "人工智能" p
  node index.js docs
  node index.js headings "20211231120000-d0rzbmm" h2
  node index.js tasks "[ ]" 7
  node index.js daily 20231010 20231013
  node index.js attr "custom-priority" "high"
        `);
        return;
    }

    const command = args[0];

    try {
        switch (command) {
            case 'search':
                if (args.length < 2) {
                    console.error('请提供搜索关键词');
                    return;
                }
                const keyword = args[1];
                const blockType = args[2] || null;
                const searchResults = await searchNotes(keyword, 20, blockType);
                console.log(formatResults(searchResults));
                break;

            case 'docs':
                const notebookId = args[1] || null;
                const docs = await listDocuments(notebookId);
                console.log(formatResults(docs));
                break;

            case 'headings':
                if (args.length < 2) {
                    console.error('请提供文档ID');
                    return;
                }
                const rootId = args[1];
                const headingType = args[2] || null;
                const headings = await getDocumentHeadings(rootId, headingType);
                console.log(formatResults(headings));
                break;

            case 'blocks':
                if (args.length < 2) {
                    console.error('请提供文档ID');
                    return;
                }
                const docRootId = args[1];
                const blocksType = args[2] || null;
                const blocks = await getDocumentBlocks(docRootId, blocksType);
                console.log(formatResults(blocks));
                break;

            case 'tag':
                if (args.length < 2) {
                    console.error('请提供标签名');
                    return;
                }
                const tagResults = await searchByTag(args[1]);
                console.log(formatResults(tagResults));
                break;

            case 'backlinks':
                if (args.length < 2) {
                    console.error('请提供被引用的块ID');
                    return;
                }
                const backlinks = await getBacklinks(args[1]);
                console.log(formatResults(backlinks));
                break;

            case 'tasks':
                const taskStatus = args[1] || '[ ]';
                const taskDays = parseInt(args[2]) || 7;
                const tasks = await searchTasks(taskStatus, taskDays);
                console.log(formatResults(tasks));
                break;

            case 'daily':
                if (args.length < 3) {
                    console.error('请提供开始日期和结束日期 (格式: YYYYMMDD)');
                    return;
                }
                const dailyNotes = await getDailyNotes(args[1], args[2]);
                console.log(formatResults(dailyNotes));
                break;

            case 'attr':
                if (args.length < 2) {
                    console.error('请提供属性名称');
                    return;
                }
                const attrValue = args[2] || null;
                const attrResults = await searchByAttribute(args[1], attrValue);
                console.log(formatResults(attrResults));
                break;

            case 'bookmarks':
                const bookmarkName = args[1] || null;
                const bookmarks = await getBookmarks(bookmarkName);
                console.log(formatResults(bookmarks));
                break;

            case 'random':
                if (args.length < 2) {
                    console.error('请提供文档ID');
                    return;
                }
                const randomHeading = await getRandomHeading(args[1]);
                console.log(formatResults(randomHeading));
                break;

            case 'recent':
                const recentDays = parseInt(args[1]) || 7;
                const recentType = args[2] || null;
                const recentBlocks = await getRecentBlocks(recentDays, 'updated', recentType);
                console.log(formatResults(recentBlocks));
                break;

            case 'unreferenced':
                if (args.length < 2) {
                    console.error('请提供笔记本ID');
                    return;
                }
                const unreferenced = await getUnreferencedDocuments(args[1]);
                console.log(formatResults(unreferenced));
                break;

            case 'check':
                const isConnected = await checkConnection();
                console.log(isConnected ? '✅ 思源笔记连接正常' : '❌ 思源笔记连接失败');
                break;

            default:
                console.error(`未知命令: ${command}`);
        }
    } catch (error) {
        console.error('执行失败:', error.message);
    }
}

// 导出函数供其他模块使用
module.exports = {
    executeSiyuanQuery,
    searchNotes,
    listDocuments,
    getDocumentHeadings,
    getDocumentBlocks,
    searchByTag,
    getBacklinks,
    searchTasks,
    getDailyNotes,
    searchByAttribute,
    getBookmarks,
    getRandomHeading,
    getRecentBlocks,
    getUnreferencedDocuments,
    checkConnection,
    formatSiyuanTime,
    formatResults,
    generateEmbedBlock
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}

/**
 * 辅助函数：格式化日期为思源时间戳格式
 * @param {Date} date - Date对象
 * @returns {string} 思源时间戳 (YYYYMMDDHHMMSS)
 */
function strftime(format, date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    if (format === '%Y%m%d%H%M%S') {
        return `${year}${month}${day}${hour}${minute}${second}`;
    }

    return format;
}