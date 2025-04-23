// === netlify/functions/get-generation.js ===
// 代理 Suno "record-info" 接口，返回生成进度或最终 audio_url
// 依赖环境变量 SUNO_API_KEY (Netlify → Site settings → Env vars)

// 1. 常量与工具 --------------------------------------------------
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000; // 10 s 超时
const MAX_RETRY = 2; // 最多重试 2 次（共 3 次请求）

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST'
};

// Fetch with timeout helper
const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    fetch(url, { ...opt, signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

// Basic exponential‑backoff retry
const fetchRetry = async (url, opt) => {
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      if (i) console.log(`[retry ${i}]`, url);
      return await fetchTimeout(url, opt);
    } catch (err) {
      if (i === MAX_RETRY) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

// 2. 处理函数 ----------------------------------------------------
export async function handler(event) {
  // 增加详细日志，记录所有重要信息
  console.log('[get-generation] 收到请求：', {
    method: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
    headers: event.headers,
    body: event.body ? '有请求体' : '无请求体'
  });

  const { httpMethod, queryStringParameters, path, body } = event;

  // CORS 预检
  if (httpMethod === 'OPTIONS') {
    console.log('[get-generation] 处理OPTIONS请求');
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 无条件接受所有请求方法，绕过方法检查
  // 先记录请求方法但不拒绝处理
  console.log('[get-generation] 请求方法:', httpMethod);
  
  // 查询参数处理
  console.log('[get-generation] 查询参数 =', queryStringParameters);
  
  // 处理请求体 - 如果是 POST 请求，尝试从请求体获取ID
  let bodyData = null;
  if (body) {
    try {
      console.log('[get-generation] 正在解析请求体:', body);
      bodyData = JSON.parse(body);
      console.log('[get-generation] 请求体数据:', bodyData);
    } catch (e) {
      console.error('[get-generation] 请求体解析错误:', e.message);
    }
  }

  // 尝试从三个来源获取ID：查询参数、路径参数和请求体
  let id = queryStringParameters?.id;
  
  // 如果查询参数中没有ID，尝试从请求体中获取
  if (!id && bodyData?.id) {
    id = bodyData.id;
    console.log('[get-generation] 从请求体提取到ID:', id);
  }
  
  // 如果请求体中没有ID，尝试从路径中提取
  if (!id && path) {
    console.log('[get-generation] 从路径提取ID, path =', path);
    // 从路径中提取ID（形如 /.netlify/functions/get-generation/123456）
    const pathParts = path.split('/');
    if (pathParts.length > 0) {
      id = pathParts[pathParts.length - 1];
      console.log('[get-generation] 从路径提取到ID:', id);
    }
  }
  
  if (!id) {
    console.log('[get-generation] 未找到ID参数');
    return new Response(
      JSON.stringify({ code: 400, msg: '缺少 id 参数' }), 
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // 如果有pending-前缀，移除前缀获取真实任务ID
  const taskId = id.startsWith('pending-') ? id.substring(8) : id;
  
  // 构建API请求URL
  const api = `${SUNO_RECORD_INFO_URL}?id=${encodeURIComponent(taskId)}`;
  console.log('[get-generation] 原始ID:', id, '处理后ID:', taskId);
  console.log('[get-generation] API请求:', api);
  console.log('[get-generation] key head =', (process.env.SUNO_API_KEY || '').slice(0, 8));

  try {
    const response = await fetchRetry(api, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`
      }
    });
    const body = await response.text();
    console.log('[response]', body.slice(0, 300)); // 打印前 300 字方便排查
    
    // 返回Response对象
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    });
  } catch (err) {
    console.error('[get-generation] error:', err.message);
    return new Response(
      JSON.stringify({ code: 502, msg: err.message }), 
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// 添加默认导出以符合 Netlify Functions 的期望格式
export default handler;

