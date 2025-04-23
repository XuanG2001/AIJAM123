// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// Suno API配置
const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate';
const SUNO_API_KEY = process.env.SUNO_API_KEY || '54eb13895a8bd99af384da696d9f6419';

// 请求超时设置 (120秒)
const REQUEST_TIMEOUT = 120000;

// 最大重试次数
const MAX_RETRIES = 2;

// 默认回调URL (必需参数)
const DEFAULT_CALLBACK_URL = 'https://aijam123.netlify.app/.netlify/functions/suno-callback';

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
      customMode: customMode, // 显式设置customMode参数
      callBackUrl: callBackUrl || DEFAULT_CALLBACK_URL // 确保callBackUrl参数存在
    };
    
    // 添加其他可选参数
    if (style) requestBody.style = style;
    if (model) requestBody.model = model;
    if (title) requestBody.title = title;
    if (tags) requestBody.tags = tags;
    if (instrument) requestBody.instrument = instrument;
    if (tempo) requestBody.tempo = tempo;
    
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

    // 记录完整响应用于调试
    console.log('API响应详情:', JSON.stringify(data, null, 2));
    
    // 用统一的方法获取ID
    function extractIdFromResponse(responseData) {
      console.log('尝试从响应中提取ID...');
      
      // 创建调试信息对象
      const debugInfo = {
        original_structure: JSON.stringify(responseData)
      };
      
      // 检查各种可能的ID位置
      // 1. 直接检查顶层id
      if (responseData.id) {
        console.log('响应直接包含id字段:', responseData.id);
        debugInfo.id_source = 'direct id';
        return { success: true, id: responseData.id, debugInfo };
      }
      
      // 2. 检查code和data结构
      if (responseData.code !== undefined) {
        if (responseData.data) {
          // 2.1 检查data.task_id
          if (responseData.data.task_id) {
            console.log('从data.task_id提取ID:', responseData.data.task_id);
            debugInfo.id_source = 'data.task_id';
            return { success: true, id: responseData.data.task_id, debugInfo };
          }
          
          // 2.2 检查data.id
          if (responseData.data.id) {
            console.log('从data.id提取ID:', responseData.data.id);
            debugInfo.id_source = 'data.id';
            return { success: true, id: responseData.data.id, debugInfo };
          }
          
          // 2.3 检查data.data数组
          if (responseData.data.data && Array.isArray(responseData.data.data) && responseData.data.data.length > 0) {
            if (responseData.data.data[0].id) {
              console.log('从data.data[0].id提取ID:', responseData.data.data[0].id);
              debugInfo.id_source = 'data.data[0].id';
              
              // 如果有音频URL，也提取出来
              if (responseData.data.data[0].audio_url) {
                responseData.audio_url = responseData.data.data[0].audio_url;
                debugInfo.audio_url_source = 'data.data[0].audio_url';
              }
              
              return { success: true, id: responseData.data.data[0].id, debugInfo };
            }
          }
          
          // 2.4 data字段是字符串，可能直接是ID
          if (typeof responseData.data === 'string') {
            console.log('data是字符串，可能是ID:', responseData.data);
            debugInfo.id_source = 'data (string)';
            return { success: true, id: responseData.data, debugInfo };
          }
        }
      }
      
      console.log('无法从响应中提取ID');
      return { success: false, debugInfo };
    }
    
    // 使用提取方法
    const extractResult = extractIdFromResponse(data);
    
    // 如果API不返回ID或找不到ID，但返回了成功状态码，创建一个临时ID
    if (!extractResult.success && data.code === 200) {
      console.log('API返回成功但无ID - 这是正常的！API使用回调机制');
      
      // 创建临时ID用于前端跟踪
      const tempId = `pending-${Date.now()}`;
      console.log('创建用于前端跟踪的临时ID:', tempId);
      
      // 返回包含临时ID的成功响应
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: tempId,
          status: 'PENDING',
          progress: 0,
          message: 'API请求已接受，请等待回调',
          api_note: '该API使用异步处理，真实ID和结果将通过回调URL返回',
          _debug_info: {
            original_response: data,
            note: '按照API文档，结果将通过回调URL返回',
            callback_url: callBackUrl || DEFAULT_CALLBACK_URL
          }
        })
      };
    }
    
    // 提取成功，使用找到的ID
    if (extractResult.success) {
      console.log('成功提取ID:', extractResult.id);
      data.id = extractResult.id;
      data._debug_info = extractResult.debugInfo;
      
      // 返回API响应
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };
    }

    // 如果执行到这里，说明API返回了非200状态或找不到ID
    console.error('API响应缺少ID字段:', JSON.stringify(data));
    
    let errorDetail = '';
    if (data.code && data.msg) {
      errorDetail = `错误代码: ${data.code}, 错误信息: ${data.msg}`;
    } else if (data.error) {
      errorDetail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    } else if (data.message) {
      errorDetail = data.message;
    }
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: '无法从API响应中提取ID',
        error: errorDetail,
        note: '请检查回调URL设置，根据API文档，结果应通过回调获取',
        response: data,
        debug_info: {
          request_url: requestUrl,
          response_status: response.status,
          callback_url: callBackUrl || DEFAULT_CALLBACK_URL
        }
      })
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
