const fetch = require('node-fetch');

const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate';
const SUNO_API_KEY = process.env.VITE_SUNO_API_KEY;

exports.handler = async function(event, context) {
  // 处理 OPTIONS 请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // 只接受 POST 方法
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: '方法不允许' })
    };
  }
  
  try {
    if (!SUNO_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: '未设置 SUNO_API_KEY 环境变量' })
      };
    }
    
    // 解析请求体
    const requestBody = JSON.parse(event.body);
    
    const response = await fetch(SUNO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        statusCode: response.status,
        body: JSON.stringify({ message: errorData.message || '请求 Suno API 失败' })
      };
    }
    
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('生成音乐出错:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '内部服务器错误' })
    };
  }
}; 