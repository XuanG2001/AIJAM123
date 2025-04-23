// Suno API回调处理
// 使用内存存储回调数据（在生产环境应使用持久化存储）
const callbackResults = {};

exports.handler = async function(event, context) {
  console.log('收到Suno回调请求');
  console.log('请求头:', JSON.stringify(event.headers, null, 2));
  
  // 处理 OPTIONS 请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
      },
      body: ''
    };
  }
  
  // 处理GET请求 - 用于检索回调数据
  if (event.httpMethod === 'GET') {
    const { result_id } = event.queryStringParameters || {};
    
    if (!result_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false, 
          message: '缺少result_id参数' 
        })
      };
    }
    
    console.log('请求获取回调结果，ID:', result_id);
    
    if (callbackResults[result_id]) {
      console.log('找到回调结果:', result_id);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          has_data: true,
          callback_data: callbackResults[result_id]
        })
      };
    } else {
      console.log('未找到回调结果:', result_id);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          has_data: false,
          message: '未找到回调数据，可能尚未收到回调或已过期'
        })
      };
    }
  }
  
  // 接收POST回调
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
      
      // 提取任务ID和音频数据
      let taskId = null;
      let audioData = [];
      
      // 分析回调数据结构
      if (bodyData.code === 200) {
        console.log('回调状态码: 200 (成功)');
        
        // 提取关键信息
        if (bodyData.data) {
          if (bodyData.data.task_id) {
            taskId = bodyData.data.task_id;
            console.log('任务ID:', taskId);
          }
          
          if (bodyData.data.callbackType) {
            console.log('回调类型:', bodyData.data.callbackType);
          }
          
          if (bodyData.data.data && Array.isArray(bodyData.data.data)) {
            audioData = bodyData.data.data;
            console.log('生成的音频数量:', audioData.length);
            
            // 记录每个音频的信息
            audioData.forEach((item, index) => {
              console.log(`音频 #${index+1} ID:`, item.id);
              console.log(`音频 #${index+1} URL:`, item.audio_url);
              if (item.duration) console.log(`音频 #${index+1} 时长:`, item.duration);
            });
          }
        }
      } else {
        console.log('回调状态码:', bodyData.code, '消息:', bodyData.msg);
      }
      
      // 生成结果ID - 使用任务ID或生成一个唯一ID
      const resultId = taskId || `callback-${Date.now()}`;
      console.log('保存回调结果，ID:', resultId);
      
      // 保存回调结果
      callbackResults[resultId] = {
        timestamp: Date.now(),
        raw_callback: bodyData,
        task_id: taskId,
        audio_data: audioData,
        status: 'COMPLETE',
        progress: 1
      };
      
      // 定时清理数据（24小时后）
      setTimeout(() => {
        console.log('清理过期回调数据:', resultId);
        delete callbackResults[resultId];
      }, 24 * 60 * 60 * 1000);
      
      // 返回成功响应
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: true,
          message: '回调已接收并处理',
          result_id: resultId
        })
      };
    } catch (e) {
      console.log('回调内容非JSON格式:', event.body);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          message: '无效的JSON格式'
        })
      };
    }
  } catch (error) {
    console.error('处理回调出错:', error.message, error.stack);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false,
        message: '内部服务器错误: ' + error.message
      })
    };
  }
}; 
