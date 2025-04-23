// 调试辅助函数
export async function handler(event) {
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  const envVars = {};
  for (const key in process.env) {
    if (key.startsWith('VITE_') || key.startsWith('NETLIFY_')) {
      envVars[key] = key.includes('KEY') ? '***' : (process.env[key] || '未设置');
    }
  }

  // 获取 SUNO 配置信息
  const sunoApiKey = process.env.VITE_SUNO_API_KEY;
  const sunoApiConnectible = !!sunoApiKey;

  // 记录请求信息
  console.log('调试请求:', {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
    queryStringParameters: event.queryStringParameters
  });

  // 模拟连接测试，不实际发送请求
  let sunoConnectionTest = '未测试';
  if (sunoApiConnectible) {
    try {
      // 仅测试能否创建请求，不实际发送
      new Request('https://api.suno.ai/api/v1/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sunoApiKey}`
        }
      });
      sunoConnectionTest = '可以创建请求（未发送）';
    } catch (error) {
      sunoConnectionTest = `创建请求失败：${error.message}`;
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: '调试信息',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || '未知',
      netlifyEnv: process.env.NETLIFY_ENV || '未知',
      netlifyContext: process.env.NETLIFY_CONTEXT || '未知',
      nodePath: process.env.NODE_PATH || '未设置',
      nodeVersion: process.version,
      envVars,
      sunoApi: {
        keyConfigured: sunoApiConnectible,
        connectionTest: sunoConnectionTest
      }
    })
  };
}

export default handler; 
