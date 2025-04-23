// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// Suno API配置
const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate';
const SUNO_API_KEY = process.env.SUNO_API_KEY || '54eb13895a8bd99af384da696d9f6419';

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
    
    // 发送请求到Suno API
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // 获取原始响应文本，用于调试
    const responseText = await response.text();
    console.log('API响应(原始):', responseText);
    
    // 尝试解析JSON响应
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('无法解析API响应JSON:', parseError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: '无法解析API响应',
          responseText: responseText.substring(0, 200) + '...'
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
