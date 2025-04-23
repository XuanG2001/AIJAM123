// === netlify/functions/suno-callback.js ===
// 轻量回调：仅记录日志并返回 200，实际状态由前端轮询 get-generation 获取

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,HEAD,OPTIONS'
};

export default async function handler(event) {
  const { httpMethod } = event;
  
  // CORS 预检
  if (httpMethod === 'OPTIONS')
    return { statusCode: 204, headers: corsHeaders };

  // 支持 POST 和 HEAD 请求
  if (httpMethod !== 'POST' && httpMethod !== 'HEAD')
    return { 
      statusCode: 405, 
      headers: corsHeaders, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };

  console.log('[suno-callback] 请求方法:', httpMethod);

  // 对于 HEAD 请求，只返回头部信息，不返回body
  if (httpMethod === 'HEAD') {
    console.log('[suno-callback] 处理HEAD请求');
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  // 处理POST请求
  try {
    // 记录回调数据（前1000个字符）用于调试
    console.log('[suno-callback] 收到回调数据:', event.body?.slice(0, 1000));
    
    // 尝试解析JSON并记录结构
    try {
      const data = JSON.parse(event.body || '{}');
      console.log('[suno-callback] 回调数据结构:', 
        JSON.stringify({
          code: data.code,
          msg: data.msg,
          task_id: data.data?.task_id,
          callback_type: data.data?.callbackType,
          audio_count: Array.isArray(data.data?.data) ? data.data.data.length : 0
        })
      );
    } catch (parseError) {
      console.log('[suno-callback] 无法解析回调数据为JSON');
    }
  } catch (error) {
    console.error('[suno-callback] 处理回调数据出错:', error);
  }

  // 简单返回成功响应
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true, 
      mode: 'direct_api_query',
      message: '回调已记录，请使用get-generation接口获取音乐状态'
    })
  };
}
