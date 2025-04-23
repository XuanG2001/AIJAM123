// Suno API回调处理
exports.handler = async function(event, context) {
  console.log('收到Suno回调请求');
  
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
    // 记录完整回调数据
    console.log('收到Suno API回调，原始数据:', event.body);
    
    // 解析请求体
    let bodyData;
    try {
      bodyData = JSON.parse(event.body);
      console.log('回调数据解析成功');
      
      // 记录完整的数据结构
      console.log('回调数据结构:', JSON.stringify(bodyData, null, 2));
      
      // 分析回调数据结构
      if (bodyData.code === 200) {
        console.log('回调状态码: 200 (成功)');
        
        // 提取关键信息
        if (bodyData.data) {
          if (bodyData.data.task_id) {
            console.log('任务ID:', bodyData.data.task_id);
          }
          
          if (bodyData.data.callbackType) {
            console.log('回调类型:', bodyData.data.callbackType);
          }
          
          if (bodyData.data.data && Array.isArray(bodyData.data.data)) {
            console.log('生成的音频数量:', bodyData.data.data.length);
            
            // 记录每个音频的信息
            bodyData.data.data.forEach((item, index) => {
              console.log(`音频 #${index+1} ID:`, item.id);
              console.log(`音频 #${index+1} URL:`, item.audio_url);
              console.log(`音频 #${index+1} 时长:`, item.duration);
            });
          }
        }
      } else {
        console.log('回调状态码:', bodyData.code, '消息:', bodyData.msg);
      }
    } catch (e) {
      console.log('回调内容非JSON格式:', event.body);
    }
    
    // 这里可以实现回调逻辑，例如更新数据库、发送通知等
    // 目前简单返回成功
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        message: '回调已接收并处理'
      })
    };
  } catch (error) {
    console.error('处理回调出错:', error.message, error.stack);
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
