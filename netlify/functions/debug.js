// 调试辅助函数
exports.handler = async function(event, context) {
  // 处理 OPTIONS 请求
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
  
  try {
    // 获取环境变量信息 - 仅显示是否设置，不泄露实际值
    const envInfo = {
      VITE_SUNO_API_KEY: process.env.VITE_SUNO_API_KEY ? '已设置' : '未设置',
      VITE_SUNO_CALLBACK: process.env.VITE_SUNO_CALLBACK,
      NODE_VERSION: process.version,
      NETLIFY_ENV_VARS: Object.keys(process.env).filter(key => key.startsWith('NETLIFY_')),
      IS_LOCAL: Boolean(process.env.NETLIFY_LOCAL),
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL || '未设置'
    };
    
    // 输出请求信息
    const requestInfo = {
      method: event.httpMethod,
      path: event.path,
      headers: event.headers,
      functionDir: __dirname,
      runtimeEnv: process.env.NODE_ENV
    };
    
    console.log('调试信息：', { envInfo, requestInfo });
    
    // 测试与Suno API的连接 - 不发送实际请求，只验证能否建立连接
    let connStatus = '未测试';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const testResponse = await fetch('https://apibox.erweima.ai/api', {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      connStatus = testResponse.ok ? '连接成功' : `连接失败: ${testResponse.status}`;
    } catch (e) {
      connStatus = `连接错误: ${e.message}`;
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
        environment: envInfo,
        connection: connStatus,
        request: requestInfo
      })
    };
  } catch (error) {
    console.error('调试函数错误:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '获取调试信息时出错: ' + error.message })
    };
  }
}; 