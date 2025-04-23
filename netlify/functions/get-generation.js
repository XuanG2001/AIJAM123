// 注意Node.js 18+已经内置了fetch API
// const fetch = require('node-fetch');

// 使用正确的API基础URL
const SUNO_API_BASE_URL = 'https://apibox.erweima.ai/api/v1/generate/';
// API密钥 
const SUNO_API_KEY = '54eb13895a8bd99af384da696d9f6419';

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

    // 尝试从API获取状态
    console.log(`请求API状态: ${SUNO_API_BASE_URL}${id}`);
    try {
      const response = await fetch(`${SUNO_API_BASE_URL}${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${SUNO_API_KEY}`
        }
      });

      if (!response.ok) {
        console.error(`API响应状态码: ${response.status}`);
        return {
          statusCode: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            message: `API请求失败: ${response.status}`,
            id: id
          })
        };
      }

      const data = await response.json();
      console.log('API响应:', JSON.stringify(data, null, 2));
      
      // 检查响应数据
      if (!data || !data.id) {
        console.error('API响应缺少必要字段:', data);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'API响应缺少必要字段',
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
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `错误: ${error.message}`,
          id: id
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