// SUNO API回调处理函数
// 处理从SUNO API发送回来的音乐生成结果
const crypto = require('crypto');
import { blobs } from '@netlify/blobs';

// 定义TTL为24小时 (毫秒)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

console.log('初始化SUNO回调处理函数');

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
    
    // 处理GET请求 - 检索回调数据
    if (event.httpMethod === 'GET') {
      const resultId = event.queryStringParameters?.result_id;
      console.log('GET请求检索回调结果，ID:', resultId);
      
      if (!resultId) {
        console.log('缺少必要的result_id参数');
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: '请提供result_id参数'
          })
        };
      }
      
      try {
        // 从Blobs存储获取回调数据
        const blobData = await blobs.get(resultId);
        
        if (blobData) {
          console.log('找到回调数据，ID:', resultId);
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              has_data: true,
              callback_data: JSON.parse(blobData),
              result_id: resultId
            })
          };
        } else {
          console.log('未找到回调数据，ID:', resultId);
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              has_data: false,
              message: '未找到回调数据'
            })
          };
        }
      } catch (error) {
        console.log('获取回调数据出错:', error.message);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: '检索回调数据时出错'
          })
        };
      }
    }
    
    // 处理POST请求 - 接收回调数据
    if (event.httpMethod === 'POST') {
      console.log('处理POST回调请求');
      
      try {
        const payload = JSON.parse(event.body);
        console.log('已解析回调数据，包含字段:', Object.keys(payload).join(', '));
        
        // 生成唯一ID作为存储键
        const resultId = payload.id || ('callback-' + crypto.randomBytes(8).toString('hex'));
        
        // 使用Netlify Blobs存储回调数据
        await blobs.set(
          resultId, 
          JSON.stringify(payload),
          { ttl: ONE_DAY_MS } // 设置24小时后过期
        );
        
        console.log('成功存储回调数据到Blobs，ID:', resultId);
        
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            message: '回调数据已保存',
            result_id: resultId
          })
        };
      } catch (error) {
        console.log('处理回调数据时出错:', error.message);
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
