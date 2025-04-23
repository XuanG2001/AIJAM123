// SUNO API回调处理函数
// 只提供基本的响应，不再存储回调数据
// 我们现在直接查询SUNO API获取任务状态

console.log('初始化简化版SUNO回调处理函数');

exports.handler = async function(event, context) {
  try {
    console.log('收到回调请求，HTTP方法:', event.httpMethod, '路径:', event.path);
    
    // 预检请求处理
    if (event.httpMethod === 'OPTIONS') {
      console.log('处理OPTIONS预检请求');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: ''
      };
    }
    
    // 处理POST请求 - 仅返回成功响应，不再存储数据
    if (event.httpMethod === 'POST') {
      console.log('处理POST回调请求 (简化版)');
      
      try {
        // 解析请求体，仅用于日志记录
        let payload;
        try {
          payload = JSON.parse(event.body);
          console.log('收到回调数据，类型:', payload.callbackType || '未知', 
                      '任务ID:', payload.task_id || payload.id || '未知');
        } catch (parseError) {
          console.log('回调数据非JSON格式');
        }
        
        // 直接返回成功响应
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: '回调已接收 (使用API查询模式，不保存回调数据)'
          })
        };
      } catch (error) {
        console.log('处理回调请求时出错:', error.message);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: '内部服务器错误'
          })
        };
      }
    }
    
    // GET请求 - 返回说明信息
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: '此端点仅用于接收Suno API回调，不存储数据。使用get-generation接口查询任务状态。',
          mode: 'direct_api_query'
        })
      };
    }
    
    // 处理其他HTTP方法
    console.log('不支持的HTTP方法:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Allow': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: '不支持的HTTP方法'
      })
    };
    
  } catch (error) {
    console.log('回调处理异常:', error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: '内部服务器错误'
      })
    };
  }
}; 
