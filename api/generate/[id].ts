// 使用自定义类型
import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] };
  cookies: { [key: string]: string };
  body: any;
}

interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  send(body: any): VercelResponse;
  json(jsonBody: any): VercelResponse;
}

const SUNO_API_BASE_URL = 'https://apibox.erweima.ai/api/v1/generate/';
const SUNO_API_KEY = process.env.VITE_SUNO_API_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 只接受 GET 方法
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '方法不允许' });
  }
  
  try {
    if (!SUNO_API_KEY) {
      return res.status(500).json({ message: '未设置 SUNO_API_KEY 环境变量' });
    }
    
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: '缺少任务ID' });
    }
    
    const response = await fetch(`${SUNO_API_BASE_URL}${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const statusCode = response.status;
      const message = errorData.message || '请求 Suno API 失败';
      return res.status(statusCode).json({ message });
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('查询生成状态出错:', error);
    return res.status(500).json({ message: '内部服务器错误' });
  }
} 