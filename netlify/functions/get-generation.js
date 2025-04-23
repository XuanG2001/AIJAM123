// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// 使用正确的API基础URL
const SUNO_API_BASE_URL = 'https://apibox.erweima.ai/api/v1/generate/';
// API密钥 
const SUNO_API_KEY = process.env.SUNO_API_KEY || '54eb13895a8bd99af384da696d9f6419';

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

exports.handler = async function(event, context) {
  try {
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

    console.log('查询参数:', event.queryStringParameters);

    // 获取生成ID
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

    console.log(`查询生成状态, ID: ${id}`);

    // 如果ID是测试ID，返回测试响应
    if (id === 'test-request') {
      console.log('测试请求响应');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: id,
          status: 'COMPLETE',
          progress: 1.0,
          message: '测试请求完成'
        })
      };
    }

    // 构建API请求URL
    const apiUrl = `${SUNO_API_BASE_URL}${id}`;
    console.log(`请求API状态: ${apiUrl}`);
    
    // 尝试从API获取状态
    try {
      console.log(`开始请求API状态，超时时间: ${REQUEST_TIMEOUT/1000}秒，最大重试次数: ${MAX_RETRIES}次`);
      
      // 使用带重试机制的fetch发送请求
      const response = await fetchWithRetry(
        apiUrl, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${SUNO_API_KEY}`
          }
        }
      );
      
      console.log('API状态请求成功，状态码:', response.status);

      // 获取原始响应
      let responseText;
      try {
        responseText = await response.text();
        console.log('API原始响应长度:', responseText.length);
        console.log('API原始响应前100字符:', responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
      } catch (textError) {
        console.error('读取响应文本失败:', textError);
        return {
          statusCode: 502,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: '读取API响应失败',
            id: id,
            error: { code: 'RESPONSE_READ_ERROR', msg: textError.message }
          })
        };
      }
      
      // 检查响应是否为HTML
      if (responseText.trim().startsWith('<')) {
        console.error('API返回了HTML而不是JSON:', responseText.substring(0, 200));
        return {
          statusCode: 502,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'API返回了非JSON格式响应，可能是网关超时',
            id: id,
            status: 'PROCESSING', // 假定仍在处理中
            progress: 0.5, // 假定进度
            error: {
              code: 'INVALID_RESPONSE_FORMAT',
              msg: '服务器返回了HTML而不是JSON'
            }
          })
        };
      }

      // 尝试解析JSON响应
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('无法解析API响应JSON:', e);
        return {
          statusCode: 200, // 返回200以避免前端轮询中断
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: '无法解析API响应JSON',
            id: id,
            status: 'PROCESSING', // 假定仍在处理中
            progress: 0.5, // 假定进度
            error: {
              code: 'PARSE_ERROR',
              msg: '无法解析响应为JSON'
            }
          })
        };
      }

      if (!response.ok) {
        console.error(`API响应状态码: ${response.status}`);
        
        // 处理apibox.erweima.ai特定的错误格式
        if (data.code !== undefined && data.msg) {
          return {
            statusCode: 200, // 返回200以避免前端轮询中断
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              message: `API错误(${data.code}): ${data.msg}`,
              id: id,
              status: 'PROCESSING', // 假定仍在处理中
              progress: 0.5, // 假定进度
              error: data
            })
          };
        }
        
        return {
          statusCode: 200, // 返回200以避免前端轮询中断
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            message: `API请求失败: ${response.status}`,
            id: id,
            status: 'PROCESSING', // 假定仍在处理中
            progress: 0.5, // 假定进度
            error: data
          })
        };
      }

      console.log('API响应:', JSON.stringify(data, null, 2));
      
      // 检查响应数据
      if (!data || !data.id) {
        console.error('API响应缺少必要字段:', data);
        return {
          statusCode: 200,  // 返回200而不是500，避免前端轮询中断
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'API响应缺少必要字段',
            id: id,  // 使用请求中的ID
            status: 'PROCESSING',  // 假设处理中
            progress: 0.5,  // 假设进度
            response: data
          })
        };
      }

      // 返回API响应
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };
    } catch (error) {
      console.error('获取生成状态时出错:', error);
      
      return {
        statusCode: 200, // 返回200以避免前端轮询中断
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `错误: ${error.message}`,
          id: id,
          status: 'PROCESSING', // 假定仍在处理中
          progress: 0.3, // 假定进度
          error: {
            code: 'REQUEST_ERROR',
            msg: error.message
          }
        })
      };
    }
  } catch (error) {
    console.error('处理请求时出错:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `服务器错误: ${error.message}` })
    };
  }
}; 
