// === netlify/functions/generate.js ===
// 1. 配置 & 工具 --------------------------------------------------
const SUNO_API_URL       = 'https://apibox.erweima.ai/api/v1/generate';
const DEFAULT_CALLBACK_URL = 'https://aijam123.netlify.app/.netlify/functions/suno-callback';
const REQUEST_TIMEOUT    = 120_000; // 120秒
const MAX_RETRIES        = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

// fetch + 超时
const fetchTimeout = (url, opts = {}, ms = REQUEST_TIMEOUT) =>
  new Promise((res, rej) => {
    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), ms);
    fetch(url, { ...opts, signal: ctl.signal })
      .then(r => { clearTimeout(tid); res(r); })
      .catch(e => { clearTimeout(tid); rej(e); });
  });

// 指数退避重试
const fetchRetry = async (url, opts) => {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      if (i) console.log(`[retry ${i}] ${url}`);
      return await fetchTimeout(url, opts);
    } catch (e) {
      if (i === MAX_RETRIES) throw e;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

// 2. 主 handler ---------------------------------------------------
export async function handler(event, context) {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }
  
  if (event.httpMethod !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  // 解析请求体
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return new Response(
      JSON.stringify({ message: 'Invalid JSON body' }), 
      { 
        status: 400, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  // 验证必需参数
  const { prompt, instrumental, customMode, callBackUrl, style, model, title, tags, instrument, tempo, test } = body;
  if (!prompt && !test) {
    return new Response(
      JSON.stringify({ message: '缺少必要参数 prompt 或 test' }), 
      { 
        status: 400, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  // 测试模式，返回固定 ID
  if (test === true) {
    return new Response(
      JSON.stringify({
        id: 'test-request',
        status: 'IN_PROGRESS',
        progress: 0,
        message: '测试请求已接收'
      }), 
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  // 构建 Suno 请求体
  const reqBody = {
    prompt,
    instrumental,
    customMode,
    callBackUrl: callBackUrl || DEFAULT_CALLBACK_URL
  };
  if (style)      reqBody.style = style;
  if (model)      reqBody.model = model;
  if (title)      reqBody.title = title;
  if (tags)       reqBody.tags  = tags;
  if (instrument) reqBody.instrument = instrument;
  if (tempo)      reqBody.tempo = tempo;

  // 发送到 Suno
  console.log('[generate] 请求体:', JSON.stringify(reqBody, null, 2));
  let resp;
  try {
    resp = await fetchRetry(
      SUNO_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(reqBody)
      }
    );
  } catch (err) {
    console.error('[generate] 请求失败:', err.message);
    return new Response(
      JSON.stringify({ message: '请求 Suno API 失败', error: err.message }), 
      { 
        status: 502, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  const text = await resp.text();
  console.log('[generate] 原始响应:', text.substring(0, 300));

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error('[generate] 响应非 JSON:', err.message);
    return new Response(
      JSON.stringify({ message: 'Suno 返回非 JSON', error: err.message }), 
      { 
        status: 502, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  // 处理 Suno 自身错误
  if (data.code && data.code !== 200) {
    console.error('[generate] API 错误:', data.msg);
    return new Response(
      JSON.stringify({ message: `API 错误(${data.code}): ${data.msg}`, error: data }), 
      { 
        status: resp.status, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  }

  // 尝试提取 ID
  let pendingId = null;
  if (data.data?.id) {
    pendingId = data.data.id;
  } else if (data.data?.task_id) {
    pendingId = data.data.task_id;
  } else if (data.data?.taskId) {
    pendingId = data.data.taskId;
  }

  // 如果没有拿到 ID，说明要走回调模式，用临时 ID
  if (!pendingId) {
    pendingId = `pending-${Date.now()}`;
    console.log('[generate] 未提取到 Suno ID，使用临时 ID:', pendingId);
    data.id      = pendingId;
    data.status  = 'PENDING';
    data.progress= 0;
    data.message = '已接受请求，稍后回调';
  } else {
    console.log('[generate] 提取到 ID:', pendingId);
    data.id = pendingId;
  }

  // 最终返回给前端
  return new Response(
    JSON.stringify(data), 
    { 
      status: 200, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      } 
    }
  );
}

export default handler;
