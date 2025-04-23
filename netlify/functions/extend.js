// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate/extend';
const SUNO_API_KEY = process.env.VITE_SUNO_API_KEY;

exports.handler = async function(event, context) {
  console.log('延长音乐函数触发');
  
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
    console.log('非POST请求被拒绝');
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '方法不允许' })
    };
  }
  
  try {
    if (!SUNO_API_KEY) {
      console.error('未设置SUNO_API_KEY环境变量');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '未设置 SUNO_API_KEY 环境变量' })
      };
    }
    
    // 解析请求体
    const requestBody = JSON.parse(event.body);
    
    // 确保请求体包含id字段
    const { id } = requestBody;
    if (!id) {
      console.error('缺少ID字段');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '请求中缺少id字段' })
      };
    }
    
    console.log('正在延长音乐，ID:', id);
    const response = await fetch(SUNO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      },
      body: JSON.stringify({ id })
    });
    
    if (!response.ok) {
      const statusCode = response.status;
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: `状态码 ${statusCode}: ${response.statusText}` };
      }
      console.error('Suno API返回错误:', statusCode, errorData);
      return {
        statusCode: statusCode,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: errorData.message || '请求 Suno API 失败' })
      };
    }
    
    const data = await response.json();
    console.log('延长成功，返回ID:', data.id);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('延长音乐出错:', error.message, error.stack);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '内部服务器错误: ' + error.message })
    };
  }
}; 