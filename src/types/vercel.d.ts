// 创建自定义的Vercel API类型定义
// 这是一个临时解决方案，如果可能，最好安装@vercel/node包

// 定义VercelRequest类型
declare namespace NodeJS {
  interface ProcessEnv {
    VITE_SUNO_API_KEY: string;
    VITE_SUNO_CALLBACK: string;
  }
}

declare module '@vercel/node' {
  import { IncomingMessage, ServerResponse } from 'http';
  
  export interface VercelRequest extends IncomingMessage {
    query: {
      [key: string]: string | string[];
    };
    cookies: {
      [key: string]: string;
    };
    body: any;
  }
  
  export interface VercelResponse extends ServerResponse {
    status(statusCode: number): VercelResponse;
    send(body: any): VercelResponse;
    json(jsonBody: any): VercelResponse;
  }
  
  export type VercelApiHandler = (
    req: VercelRequest,
    res: VercelResponse
  ) => void | Promise<void>;
} 