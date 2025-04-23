// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// 使用正确的API基础URL
const SUNO_API_BASE_URL = 'https://apibox.erweima.ai/api/v1/generate/';
const SUNO_RECORD_INFO_URL = 'https://apibox.erweima.ai/api/v1/generate/record-info';
// API密钥 
const SUNO_API_KEY = process.env.SUNO_API_KEY || '54eb13895a8bd99af384da696d9f6419';
// 移除Netlify Blobs导入和内存存储相关代码

// 请求超时设置 (30秒)
const REQUEST_TIMEOUT = 30000;

// 最大重试次数
const MAX_RETRIES = 1;

// 创建带超时的fetch
const fetchWithTimeout = async (url, options, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout/1000}秒)`);
    }
    throw error;
  }
};

// 创建带重试的fetch
const fetchWithRetry = async (url, options, maxRetries = MAX_RETRIES) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      if (i > 0) {
        console.log(`第${i}次重试请求...`);
      }
      
      // 使用带超时的fetch
      return await fetchWithTimeout(url, options);
    } catch (error) {
      console.error(`请求失败 (尝试 ${i+1}/${maxRetries+1}):`, error.message);
      lastError = error;
      
      // 如果不是最后一次尝试，等待一段时间再重试
      if (i < maxRetries) {
        const delay = 1000 * Math.pow(2, i); // 指数退避: 1s, 2s, 4s, ...
        console.log(`等待${delay/1000}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // 所有重试都失败了
  throw lastError;
};

// 直接代理Suno API的record-info接口
// 轻量级实现，专注于获取音频URL

// 简单的超时设置
const TIMEOUT = 10000; // 10秒

exports.handler = async function(event, context) {
  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // 只处理GET请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '仅支持GET请求' })
    };
  }

  // 获取任务ID
  const { id } = event.queryStringParameters || {};
  if (!id) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '缺少必要参数: id' })
    };
  }

  console.log('查询音乐生成状态, ID:', id);
  
  // 处理测试ID
  if (id === 'test-request') {
    console.log('返回测试响应');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 200,
        msg: "获取成功",
        data: {
          status: "SUCCESS",
          progress: 1,
          data: [
            {
              id: "test-song-1",
              audio_url: "https://example.com/test-song.mp3",
              duration: 180
            }
          ]
        }
      })
    };
  }
  
  // 移除pending-前缀（如果有）获取真实任务ID
  const taskId = id.startsWith('pending-') ? id.replace('pending-', '') : id;
  
  // 构建API请求
  const apiUrl = `${SUNO_RECORD_INFO_URL}?id=${taskId}`;
  console.log(`请求Suno API:`, apiUrl);
  
  try {
    // 设置请求参数
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    
    // 发送请求到Suno API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // 解析响应
    const data = await response.json();
    console.log('Suno API响应:', response.status);
    
    // 直接返回API响应给前端
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('获取音乐状态出错:', error);
    
    // 返回错误信息
    return {
      statusCode: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: 502,
        msg: `获取音乐状态失败: ${error.message}`,
        error: error.message
      })
    };
  }
}; 
