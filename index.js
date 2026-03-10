/**
 * 思源笔记查询工具
 * 提供全文搜索和SQL查询功能
 */

const fs = require('fs');
const path = require('path');

/** 加载.env文件 */
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
            if (DEBUG_MODE) console.log('✅ 已加载.env配置文件:', envPath);
        } else {
            if (DEBUG_MODE) console.log('⚠️  未找到.env文件:', envPath);
        }
    } catch (error) {
        if (DEBUG_MODE) console.log('⚠️  .env文件加载失败:', error.message);
    }
}

/** 调试模式开关 */
const DEBUG_MODE = process.env.DEBUG === 'true' || process.argv.includes('--debug');

/** 加载环境变量 */
loadEnvFile();

/** 环境变量或默认配置 */
const SIYUAN_HOST = process.env.SIYUAN_HOST || 'localhost';
const SIYUAN_PORT = process.env.SIYUAN_PORT || '';
const SIYUAN_API_TOKEN = process.env.SIYUAN_API_TOKEN || '';
const SIYUAN_USE_HTTPS = process.env.SIYUAN_USE_HTTPS === 'true';
const SIYUAN_BASIC_AUTH_USER = process.env.SIYUAN_BASIC_AUTH_USER || '';
const SIYUAN_BASIC_AUTH_PASS = process.env.SIYUAN_BASIC_AUTH_PASS || '';

/** 排除的笔记本ID列表（API层面过滤） */
const SIYUAN_EXCLUDE_BOXES = (process.env.SIYUAN_EXCLUDE_BOXES || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

/** 排除的笔记路径列表（API层面过滤，包含子笔记） */
const SIYUAN_EXCLUDE_PATHS = (process.env.SIYUAN_EXCLUDE_PATHS || '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

/** API端点配置 */
const API_BASE_URL = `${SIYUAN_USE_HTTPS ? 'https' : 'http'}://${SIYUAN_HOST}${SIYUAN_PORT ? ':' + SIYUAN_PORT : ''}`;
const SQL_QUERY_ENDPOINT = `${API_BASE_URL}/api/query/sql`;
const BLOCK_KRAMDOWN_ENDPOINT = `${API_BASE_URL}/api/block/getBlockKramdown`;
const ASSET_ENDPOINT = `${API_BASE_URL}/api/asset/get`;

if (DEBUG_MODE) {
    console.log(`📡 服务器地址: ${API_BASE_URL}/api/query/sql`);
    console.log(`🔑 API Token: ${SIYUAN_API_TOKEN ? '已配置' : '未配置'}`);
    console.log(`🔐 Basic Auth: ${SIYUAN_BASIC_AUTH_USER ? `用户: ${SIYUAN_BASIC_AUTH_USER}` : '未配置'}`);
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
        `);
        return false;
    }
    return true;
}

/**
 * 调用思源笔记API的通用函数
 * @param {string} endpoint - API端点路径
 * @param {Object} requestBody - 请求体
 * @returns {Promise<Object>} API响应数据
 */
async function callSiyuanAPI(endpoint, requestBody) {
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    const apiUrl = `${API_BASE_URL}${endpoint}`;

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;
            const urlWithToken = `${apiUrl}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

            if (DEBUG_MODE) console.log(`🔐 调用API: ${endpoint}`);

            response = await fetch(urlWithToken, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        } else {
            headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

            if (DEBUG_MODE) console.log(`🔑 调用API: ${endpoint}`);

            response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(`思源API错误: ${result.msg || '未知错误'}`);
        }

        return result.data;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 全文搜索笔记块
 * @param {string} query - 搜索查询词
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} 搜索结果
 */
async function fullTextSearch(query, options = {}) {
    const {
        method = 0,
        types = {},
        paths = [],
        groupBy = 0,
        orderBy = 0,
        page = 1
    } = options;

    const defaultTypes = {
        audioBlock: true,
        blockquote: true,
        codeBlock: true,
        databaseBlock: true,
        document: true,
        embedBlock: true,
        heading: true,
        htmlBlock: true,
        iframeBlock: true,
        list: false,
        listItem: false,
        mathBlock: true,
        paragraph: true,
        superBlock: true,
        table: false,
        videoBlock: true,
        widgetBlock: true
    };

    const requestBody = {
        query,
        method,
        types: { ...defaultTypes, ...types },
        paths,
        groupBy,
        orderBy,
        page,
        reqId: Date.now()
    };

    if (DEBUG_MODE) {
        console.log('🔍 全文搜索参数:', JSON.stringify(requestBody, null, 2));
    }

    return await callSiyuanAPI('/api/search/fullTextSearchBlock', requestBody);
}

/**
 * 搜索包含关键词的笔记内容 (返回格式化字符串)
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @param {string} blockType - 块类型过滤 (可选)
 * @param {number} page - 页码 (可选，默认第1页)
 * @returns {Promise<string>} 格式化后的结果
 */
async function searchNotes(keyword, limit = 20, blockType = null, page = 1) {
    const options = { page };

    if (blockType) {
        const typeMap = {
            'd': { document: true },
            'h': { heading: true },
            'p': { paragraph: true },
            'l': { list: true, listItem: true },
            'c': { codeBlock: true },
            't': { table: true },
            'b': { blockquote: true }
        };

        if (typeMap[blockType]) {
            options.types = {
                audioBlock: false,
                blockquote: false,
                codeBlock: false,
                databaseBlock: false,
                document: false,
                embedBlock: false,
                heading: false,
                htmlBlock: false,
                iframeBlock: false,
                list: false,
                listItem: false,
                mathBlock: false,
                paragraph: false,
                superBlock: false,
                table: false,
                videoBlock: false,
                widgetBlock: false,
                ...typeMap[blockType]
            };
        }
    }

    const results = await fullTextSearch(keyword, options);

    if (results && results.blocks && Array.isArray(results.blocks)) {
        if (DEBUG_MODE) {
            console.log(`🎯 搜索完成: 找到 ${results.matchedBlockCount} 个匹配块，${results.matchedRootCount} 个文档`);
        }

        // 🔴 排除指定的笔记本（API层面过滤）
        let blocks = results.blocks;
        if (SIYUAN_EXCLUDE_BOXES.length > 0) {
            const beforeCount = blocks.length;
            blocks = blocks.filter(block => {
                const boxId = block.box || '';
                return !SIYUAN_EXCLUDE_BOXES.includes(boxId);
            });
            const afterCount = blocks.length;
            if (DEBUG_MODE && beforeCount !== afterCount) {
                console.log(`🚫 排除笔记本: 过滤掉 ${beforeCount - afterCount} 条结果（笔记本ID: ${SIYUAN_EXCLUDE_BOXES.join(', ')}）`);
            }
        }
        
        // 🔴 排除指定的笔记路径（API层面过滤，包含子笔记）
        if (SIYUAN_EXCLUDE_PATHS.length > 0) {
            const beforeCount = blocks.length;
            blocks = blocks.filter(block => {
                const hpath = block.hPath || '';
                // 检查是否匹配任何一个排除路径（包含子笔记）
                return !SIYUAN_EXCLUDE_PATHS.some(excludePath => {
                    const normalizedPath = excludePath.startsWith('/') ? excludePath : '/' + excludePath;
                    return hpath.startsWith(normalizedPath);
                });
            });
            const afterCount = blocks.length;
            if (DEBUG_MODE && beforeCount !== afterCount) {
                console.log(`🚫 排除路径: 过滤掉 ${beforeCount - afterCount} 条结果（路径: ${SIYUAN_EXCLUDE_PATHS.join(', ')}）`);
            }
        }

        blocks = blocks.slice(0, limit);

        /** 按文档分组，减少重复路径显示 */
        const groupedByDoc = {};
        const typeMap = {
            'NodeDocument': '文档',
            'NodeHeading': '标题',
            'NodeParagraph': '段落',
            'NodeCodeBlock': '代码',
            'NodeTable': '表格',
            'NodeList': '列表',
            'NodeBlockquote': '引用',
            'NodeSuperBlock': '超级块'
        };

        blocks.forEach((item) => {
            const path = item.hPath || '未知文档';
            const rootID = item.rootID || '';
            const docKey = rootID ? `${path}|${rootID}` : path;
            if (!groupedByDoc[docKey]) {
                groupedByDoc[docKey] = { path, rootID, items: [] };
            }
            const type = typeMap[item.type] || '块';
            // 优先使用 markdown（包含 [x]/[ ] 等格式标记），回退到 content
            const content = (item.markdown || item.content || '').replace(/<[^>]+>/g, '');
            groupedByDoc[docKey].items.push({ type, content, id: item.id });
        });

        let output = `找到 ${results.matchedBlockCount} 条结果，第 ${page}/${results.pageCount} 页\n\n`;
        let globalIndex = 1;

        for (const docKey of Object.keys(groupedByDoc)) {
            const doc = groupedByDoc[docKey];
            const rootIdPart = doc.rootID ? ` [${doc.rootID}]` : '';

            /** 如果文档只有一条结果，不显示文档标题行，直接显示结果 */
            if (doc.items.length === 1) {
                const item = doc.items[0];
                const content = item.content.substring(0, 150);
                const truncated = item.content.length > 150 ? '...' : '';
                output += `  ${globalIndex}. 📄${rootIdPart} ${doc.path} > [${item.type} ${item.id}] ${content}${truncated}\n\n`;
                globalIndex++;
            } else {
                /** 文档有多条结果，显示文档标题行 */
                output += `📄${rootIdPart} ${doc.path}\n`;
                doc.items.forEach((item) => {
                    const content = item.content.substring(0, 150);
                    const truncated = item.content.length > 150 ? '...' : '';
                    output += `  ${globalIndex}. [${item.type} ${item.id}] ${content}${truncated}\n`;
                    globalIndex++;
                });
                output += '\n';
            }
        }

        return output.trim();
    }

    return `未找到包含"${keyword}"的结果`;
}

/**
 * 执行思源笔记SQL查询 (返回精简后的原始数据)
 * @param {string} sqlQuery - SQL查询语句
 * @returns {Promise<Array>} 查询结果数组
 */
async function executeSiyuanQuery(sqlQuery) {
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 添加排除笔记本的条件（API层面过滤）
        let finalQuery = sqlQuery;
        
        // 1. 排除笔记本
        if (SIYUAN_EXCLUDE_BOXES.length > 0) {
            const excludeCondition = SIYUAN_EXCLUDE_BOXES.map(id => `'${id}'`).join(', ');
            
            // 如果查询中已经有 WHERE，添加 AND box NOT IN
            if (sqlQuery.toUpperCase().includes(' WHERE ')) {
                finalQuery = finalQuery.replace(/ WHERE /i, ` WHERE box NOT IN (${excludeCondition}) AND `);
            } 
            // 如果没有 WHERE 但有 FROM blocks，添加 WHERE box NOT IN
            else if (sqlQuery.toUpperCase().includes(' FROM blocks')) {
                finalQuery = finalQuery.replace(/ FROM blocks/i, ` FROM blocks WHERE box NOT IN (${excludeCondition})`);
            }
        }
        
        // 2. 排除笔记路径（包含子笔记）
        if (SIYUAN_EXCLUDE_PATHS.length > 0) {
            SIYUAN_EXCLUDE_PATHS.forEach(excludePath => {
                const normalizedPath = excludePath.startsWith('/') ? excludePath : '/' + excludePath;
                const pathCondition = `hpath NOT LIKE '${normalizedPath}%'`;
                
                // 如果已经有 WHERE，添加 AND hpath NOT LIKE
                if (finalQuery.toUpperCase().includes(' WHERE ')) {
                    finalQuery = finalQuery.replace(/ WHERE /i, ` WHERE ${pathCondition} AND `);
                } 
                // 如果没有 WHERE 但有 FROM blocks，添加 WHERE hpath NOT LIKE
                else if (finalQuery.toUpperCase().includes(' FROM blocks')) {
                    finalQuery = finalQuery.replace(/ FROM blocks/i, ` FROM blocks WHERE ${pathCondition}`);
                }
            });
        }
        
        if (DEBUG_MODE && (SIYUAN_EXCLUDE_BOXES.length > 0 || SIYUAN_EXCLUDE_PATHS.length > 0)) {
            console.log('🚫 排除笔记本:', SIYUAN_EXCLUDE_BOXES);
            console.log('🚫 排除路径:', SIYUAN_EXCLUDE_PATHS);
            console.log('📝 修改后的查询:', finalQuery);
        }

        let requestBody = {
            stmt: finalQuery
        };

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;
            const urlWithToken = `${SQL_QUERY_ENDPOINT}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

            if (DEBUG_MODE) console.log('🔐 使用双重认证：Basic Auth (Authorization头) + Token (URL参数)');

            response = await fetch(urlWithToken, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        } else {
            headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

            if (DEBUG_MODE) console.log('🔑 使用思源Token认证：Authorization头');

            response = await fetch(SQL_QUERY_ENDPOINT, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            switch (response.status) {
                case 401:
                    errorMessage = '认证失败，请检查API Token或Basic Auth配置';
                    break;
                case 403:
                    errorMessage = '权限不足，请检查API权限设置';
                    break;
                case 404:
                    errorMessage = 'API端点未找到，请检查思源笔记是否运行';
                    break;
                case 500:
                    errorMessage = '服务器内部错误，请检查思源笔记状态';
                    break;
                case 503:
                    errorMessage = '服务不可用，请确认思源笔记正在运行';
                    break;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (result.code !== 0) {
            let errorMessage = `思源API错误: ${result.msg || '未知错误'}`;

            if (result.msg?.includes('token')) {
                errorMessage += ' (请检查API Token是否正确)';
            }
            if (result.msg?.includes('permission')) {
                errorMessage += ' (请检查API权限设置)';
            }

            throw new Error(errorMessage);
        }

        const data = result.data || [];

        if (Array.isArray(data) && data.length > 0) {
            return data.map(item => ({
                id: item.id,
                type: item.type,
                subtype: item.subtype,
                content: item.content,
                markdown: item.markdown || item.content, // 优先使用 markdown，回退到 content
                hpath: item.hPath,
                created: item.created,
                updated: item.updated,
                root_id: item.root_id,
                parent_id: item.parent_id,
                box: item.box
            }));
        }

        return [];
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}. 请确认思源笔记正在运行且端口配置正确`);
        }

        if (error.message.includes('401') || error.message.includes('token')) {
            throw new Error(`认证失败: ${error.message}. 请检查API Token配置`);
        }

        if (error.message.includes('思源API错误') || error.message.includes('HTTP')) {
            throw error;
        }

        throw new Error(`查询失败: ${error.message}`);
    }
}

/**
 * 获取指定块的内容
 * 自动使用 kramdown 接口获取完整内容，文档块会包含反向链接
 * @param {string} blockId - 块ID
 * @returns {Promise<string>} kramdown 内容 + 反向链接的文本
 */
async function getBlockByID(blockId) {
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    if (!blockId) {
        throw new Error('块ID不能为空');
    }

    /** 调用 getBlockKramdown 接口获取块内容 */
    const kramdown = await getBlockKramdown(blockId);

    /** 查询块的基本信息（判断是否为文档块） */
    const blocks = await executeSiyuanQuery(
        `SELECT id, type FROM blocks WHERE id = '${blockId}'`
    );

    if (blocks.length === 0) {
        return kramdown;
    }

    const block = blocks[0];
    let output = kramdown;

    /** 如果是文档块，查询并追加反向链接 */
    if (block.type === 'd') {
        const backlinks = await executeSiyuanQuery(
            `SELECT id, content FROM blocks WHERE id IN (
                SELECT block_id FROM refs WHERE def_block_id = '${blockId}'
            ) LIMIT 50`
        );

        if (backlinks.length > 0) {
            output += '\n\n---\n\n## 反向链接\n\n';
            backlinks.forEach((bl) => {
                output += `- {${bl.id}} ${bl.content || '(无内容)'}\n`;
            });
        }
    }

    return output;
}

/**
 * 调用思源 getBlockKramdown API 获取块的 kramdown
 * @param {string} blockId - 块ID
 * @returns {Promise<string>} kramdown 内容
 */
async function getBlockKramdown(blockId) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const requestBody = { id: blockId };

    let response;

    if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
        const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
        headers.Authorization = `Basic ${basicAuthCredentials}`;
        const urlWithToken = `${BLOCK_KRAMDOWN_ENDPOINT}?token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;

        if (DEBUG_MODE) console.log('🔐 使用双重认证获取 kramdown');

        response = await fetch(urlWithToken, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
    } else {
        headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;

        if (DEBUG_MODE) console.log('🔑 使用思源Token认证获取 kramdown');

        response = await fetch(BLOCK_KRAMDOWN_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
    }

    if (!response.ok) {
        throw new Error(`获取 kramdown 失败: HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
        throw new Error(`获取 kramdown 失败: ${result.msg || '未知错误'}`);
    }

    return result.data?.kramdown || '';
}

/**
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
思源笔记查询工具使用说明:

用法:
  node index.js <命令> [参数]

命令:
  search <关键词> [类型] [页码]  - 搜索包含关键词的笔记
  sql <SQL语句>                  - 执行SQL查询

块类型:
  d - 文档, h - 标题, p - 段落, l - 列表
  c - 代码块, t - 表格, b - 引用

示例:
  node index.js search "人工智能"
  node index.js search "前端" h 1
  node index.js sql "SELECT * FROM blocks WHERE type='d' LIMIT 10"
        `);
        return;
    }

    if (!checkEnvironmentConfig()) {
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
                const pageNum = parseInt(args[3]) || 1;
                const searchResults = await searchNotes(keyword, 20, blockType, pageNum);
                console.log(searchResults);
                break;

            case 'sql':
                if (args.length < 2) {
                    console.error('请提供SQL语句');
                    return;
                }
                const sqlQuery = args.slice(1).join(' ');
                const sqlResults = await executeSiyuanQuery(sqlQuery);
                console.log(JSON.stringify(sqlResults, null, 2));
                break;

            default:
                console.error(`未知命令: ${command}`);
        }
    } catch (error) {
        console.error('执行失败:', error.message);
    }
}

/**
 * 获取资源文件的完整URL
 * @param {string} blockId - 包含资源的块ID (可选，仅用于兼容性)
 * @param {string} assetPath - 资源相对路径 (如 "assets/image-xxx.webp")
 * @returns {Promise<string>} 资源文件的完整URL
 *
 * 注意: blockId 参数保留是为了兼容性，实际不参与URL构建
 * 思源笔记的资源URL格式: {baseUrl}/assets/{filename}
 */
async function getAssetURL(blockId, assetPath) {
    if (!checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    if (!assetPath) {
        throw new Error('资源路径不能为空');
    }

    /** 去掉assetPath中的assets/前缀（如果有的话） */
    const cleanPath = assetPath.replace(/^assets\//, '');

    /** 构建资源URL - 思源笔记的资源URL格式: /assets/{文件名} */
    const assetURL = `${API_BASE_URL}/assets/${cleanPath}`;

    return assetURL;
}

/**
 * 获取资源文件并返回base64编码的数据
 * @param {string} blockId - 包含资源的块ID
 * @param {string} assetPath - 资源相对路径 (如 "assets/image-xxx.webp")
 * @returns {Promise<string>} base64编码的资源数据
 */
async function getAssetAsBase64(blockId, assetPath) {
    const assetURL = await getAssetURL(blockId, assetPath);

    try {
        const headers = {};

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;

            if (DEBUG_MODE) console.log('🔐 使用Basic Auth获取资源文件');

            response = await fetch(assetURL, {
                method: 'GET',
                headers: headers
            });
        } else {
            if (DEBUG_MODE) console.log('🌐 获取资源文件 (无认证)');

            response = await fetch(assetURL, {
                method: 'GET',
                headers: headers
            });
        }

        if (!response.ok) {
            throw new Error(`获取资源失败: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        return base64;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 提取块内容中的所有资源路径
 * @param {string} blockId - 块ID
 * @returns {Promise<Array>} 资源路径列表
 */
async function extractAssetsFromBlock(blockId) {
    if (!blockId) {
        throw new Error('块ID不能为空');
    }

    const blocks = await executeSiyuanQuery(
        `SELECT content, markdown FROM blocks WHERE id = '${blockId}'`
    );

    if (blocks.length === 0) {
        throw new Error(`未找到块ID: ${blockId}`);
    }

    const block = blocks[0];
    const assets = [];

    /** 从content字段提取资源路径 (格式: "image assets/xxx.webp") */
    const contentMatches = block.content?.matchAll(/image\s+(assets\/[^\s]+)/g) || [];
    for (const match of contentMatches) {
        assets.push({
            path: match[1],
            type: 'image'
        });
    }

    /** 从markdown字段提取资源路径 (格式: "![alt](assets/xxx.webp)") */
    const markdownMatches = block.markdown?.matchAll(/!\[.*?\]\((assets\/[^\)]+)\)/g) || [];
    for (const match of markdownMatches) {
        const path = match[1];
        /** 避免重复添加 */
        if (!assets.find(a => a.path === path)) {
            assets.push({
                path: path,
                type: 'image'
            });
        }
    }

    return assets;
}

// 导出函数供其他模块使用
// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}

/**
 * 下载资源文件到本地临时目录
 * @param {string} blockId - 包含资源的块ID
 * @param {string} assetPath - 资源相对路径 (如 "assets/image-xxx.webp")
 * @returns {Promise<string>} 本地文件路径
 * 
 * 使用场景：当思源笔记部署在本地时，其他技能无法直接访问资源URL
 * 解决方案：将资源下载到本地临时目录，返回本地文件路径供其他技能使用
 */
async function getLocalAssetPath(blockId, assetPath) {
    const assetURL = await getAssetURL(blockId, assetPath);

    /** 清理超过1小时的临时文件 */
    clearExpiredTempAssets();

    try {
        const headers = {};

        let response;

        if (SIYUAN_BASIC_AUTH_USER && SIYUAN_BASIC_AUTH_PASS) {
            const basicAuthCredentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
            headers.Authorization = `Basic ${basicAuthCredentials}`;

            if (DEBUG_MODE) console.log('🔐 使用Basic Auth下载资源文件');

            response = await fetch(assetURL, {
                method: 'GET',
                headers: headers
            });
        } else {
            if (DEBUG_MODE) console.log('🌐 下载资源文件 (无认证)');

            response = await fetch(assetURL, {
                method: 'GET',
                headers: headers
            });
        }

        if (!response.ok) {
            throw new Error(`下载资源失败: HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();

        /** 创建临时目录 - 使用项目根目录下的.tmp/assets */
        const tmpDir = path.join(__dirname, '.tmp', 'assets');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        /** 提取文件名 */
        const cleanPath = assetPath.replace(/^assets\//, '');
        const localPath = path.join(tmpDir, cleanPath);

        /** 确保目标目录存在 */
        const localDir = path.dirname(localPath);
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        /** 写入文件 */
        fs.writeFileSync(localPath, Buffer.from(buffer));

        if (DEBUG_MODE) console.log(`✅ 资源已下载到: ${localPath}`);

        return localPath;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
            throw new Error(`无法连接到思源笔记: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 清理过期的临时文件（超过1小时）
 * @param {number} maxAge - 最大文件年龄（毫秒），默认1小时
 */
function clearExpiredTempAssets(maxAge = 60 * 60 * 1000) {
    const tmpDir = path.join(__dirname, '.tmp', 'assets');
    
    if (!fs.existsSync(tmpDir)) {
        return;
    }

    const now = Date.now();
    let clearedCount = 0;

    /** 递归删除过期文件 */
    function clearDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                clearDirectory(itemPath);
                
                /** 如果目录为空，删除目录 */
                try {
                    const remaining = fs.readdirSync(itemPath);
                    if (remaining.length === 0) {
                        fs.rmdirSync(itemPath);
                    }
                } catch (error) {
                    // 目录可能已被删除，忽略错误
                }
            } else if (stats.isFile()) {
                /** 检查文件年龄 */
                const age = now - stats.mtimeMs;
                if (age > maxAge) {
                    try {
                        fs.unlinkSync(itemPath);
                        clearedCount++;
                        if (DEBUG_MODE) console.log(`🗑️  清理过期文件: ${itemPath}`);
                    } catch (error) {
                        if (DEBUG_MODE) console.warn(`⚠️  清理文件失败: ${itemPath}`, error.message);
                    }
                }
            }
        }
    }

    try {
        clearDirectory(tmpDir);
        if (DEBUG_MODE && clearedCount > 0) {
            console.log(`✅ 清理了 ${clearedCount} 个过期临时文件`);
        }
    } catch (error) {
        if (DEBUG_MODE) console.warn('⚠️  清理临时文件失败:', error.message);
    }
}

/**
 * 清理指定的临时文件
 * @param {string} localPath - 本地文件路径
 */
function clearTempAsset(localPath) {
    try {
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            if (DEBUG_MODE) console.log(`🗑️  已清理临时文件: ${localPath}`);
        }
    } catch (error) {
        console.warn(`⚠️  清理临时文件失败: ${error.message}`);
    }
}

// 更新导出模块
module.exports = {
    executeSiyuanQuery,
    searchNotes,
    getBlockByID,
    getAssetURL,
    getAssetAsBase64,
    extractAssetsFromBlock,
    getLocalAssetPath,
    clearTempAsset,
    clearExpiredTempAssets
};
