// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// Suno API配置
const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate';
const SUNO_API_KEY = process.env.SUNO_API_KEY || '54eb13895a8bd99af384da696d9f6419';

// 请求超时设置 (60秒)
const REQUEST_TIMEOUT = 60000;

// 最大重试次数
const MAX_RETRIES = 2;

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
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: ''
      };
    }

    // 仅处理POST请求
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '仅支持POST请求' })
      };
    }

    // 解析请求体
    const body = JSON.parse(event.body);
    const { prompt, style, test, instrumental, customMode, model, title, tags, instrument, tempo, callBackUrl } = body;
    
    console.log('请求正文:', JSON.stringify(body, null, 2));
    console.log('API密钥(前6位):', SUNO_API_KEY.substring(0, 6) + '...');

    // 验证必要参数
    if (!prompt && !test) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '缺少必要参数: prompt' })
      };
    }
    
    // 确保instrumental参数存在 - API要求此参数必须存在
    if (instrumental === undefined || instrumental === null) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '缺少必要参数: instrumental' })
      };
    }
    
    // 确保customMode参数存在 - API要求此参数必须存在
    if (customMode === undefined || customMode === null) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '缺少必要参数: customMode' })
      };
    }

    // 处理测试请求
    if (test === true) {
      console.log('测试模式请求');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: 'test-request',
          status: 'IN_PROGRESS',
          progress: 0,
          message: '测试请求已接收'
        })
      };
    }

    // 准备Suno API请求
    const requestUrl = SUNO_API_URL;
    console.log('发送请求到:', requestUrl);
    
    // 构建请求体 - 确保包含所有必要参数
    const requestBody = {
      prompt: prompt,
      instrumental: instrumental, // 显式设置instrumental参数
      customMode: customMode // 显式设置customMode参数
    };
    
    // 添加其他可选参数
    if (style) requestBody.style = style;
    if (model) requestBody.model = model;
    if (title) requestBody.title = title;
    if (tags) requestBody.tags = tags;
    if (instrument) requestBody.instrument = instrument;
    if (tempo) requestBody.tempo = tempo;
    if (callBackUrl) requestBody.callBackUrl = callBackUrl;
    
    console.log('请求体:', JSON.stringify(requestBody, null, 2));
    
    let response;
    try {
      // 使用带重试机制的fetch发送请求到Suno API
      console.log(`开始请求API，超时时间: ${REQUEST_TIMEOUT/1000}秒，最大重试次数: ${MAX_RETRIES}次`);
      
      response = await fetchWithRetry(
        requestUrl, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUNO_API_KEY}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      console.log('API请求成功，状态码:', response.status);
    } catch (fetchError) {
      console.error('API请求最终失败:', fetchError.message);
      return {
        statusCode: 502,  // 使用502表示网关错误
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `API请求失败: ${fetchError.message}`,
          error: { code: 'REQUEST_FAILED', msg: fetchError.message },
          debug_info: {
            api_url: requestUrl,
            api_key_length: SUNO_API_KEY.length,
            request_params: Object.keys(requestBody).join(', ')
          }
        })
      };
    }

    // 获取原始响应文本，用于调试
    let responseText;
    try {
      responseText = await response.text();
      console.log('API响应(原始)长度:', responseText.length);
      console.log('API响应(原始)前200字符:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
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
          error: { code: 'RESPONSE_READ_ERROR', msg: textError.message }
        })
      };
    }
    
    // 检查响应是否为HTML (可能是超时错误页面)
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
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            msg: '服务器返回了HTML而不是JSON',
            details: responseText.substring(0, 200) + '...'
          }
        })
      };
    }
    
    // 尝试解析JSON响应
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('无法解析API响应JSON:', parseError, '原始响应:', responseText.substring(0, 200));
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: '无法解析API响应',
          error: {
            code: 'PARSE_ERROR',
            msg: '无法解析响应为JSON',
            details: responseText.substring(0, 200) + '...'
          }
        })
      };
    }

    // 处理API错误响应
    if (!response.ok) {
      console.error('API返回错误:', response.status, data);
      
      // 如果API返回了code和msg字段（erweima.ai API的格式）
      if (data.code !== undefined && data.msg) {
        return {
          statusCode: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            message: `API错误(${data.code}): ${data.msg}`,
            error: data
          })
        };
      }
      
      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: data.message || '请求Suno API失败',
          error: data
        })
      };
    }

    // 检查响应是否包含ID
    if (!data.id) {
      console.error('API响应缺少ID字段:', data);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: 'API响应缺少ID字段',
          response: data
        })
      };
    }

    console.log('生成请求成功, 生成ID:', data.id);
    
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
    console.error('处理请求出错:', error.message, error.stack);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: '内部服务器错误: ' + error.message,
        stack: error.stack ? error.stack.split('\n')[0] : null
      })
    };
  }
}; 
