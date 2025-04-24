// === netlify/functions/get-generation.js ===
// 代理 Suno “record-info” 接口，返回生成进度或最终 audio_url
// 依赖环境变量：SUNO_API_KEY  (Netlify → Site settings → Env vars)

// -----------------------------------------------------------------------------
// 1. 常量与工具
// -----------------------------------------------------------------------------
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000; // 10 s 超时
const MAX_RETRY  = 2;      // 最多重试 2 次（共 3 次请求）

const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST',
};

// fetch 带超时
const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    fetch(url, { ...opt, signal: controller.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });

// 指数回退重试
const fetchRetry = async (url, opt) => {
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      if (i) console.log(`[retry ${i}]`, url);
      return await fetchTimeout(url, opt);
    } catch (e) {
      if (i === MAX_RETRY) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

// -----------------------------------------------------------------------------
// 2. 处理函数
// -----------------------------------------------------------------------------
export async function handler(event) {
  // —— 打印完整 event，方便远程调试 ——
  console.log('=== incoming event ===');
  console.log(JSON.stringify(event, null, 2));
  console.log('=== end event ===');

  const { httpMethod, queryStringParameters, path, body } = event;

  // ---------------- CORS 预检 ----------------
  if (httpMethod === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ---------------- 解析请求体 ----------------
  // 在 Netlify Functions v1，body 是字符串；
  // 在 v2 / Edge runtime，body 是 ReadableStream。
  let bodyData = null;
  if (body) {
    try {
      let rawBody;

      // 1) 字符串
      if (typeof body === 'string') {
        rawBody = body;
      }
      // 2) ReadableStream（支持 .text()）
      else if (typeof body === 'object' && typeof body.text === 'function') {
        rawBody = await body.text();
      }

      if (rawBody) {
        console.log('[get-generation] 原始请求体:', rawBody.slice(0, 200));
        bodyData = JSON.parse(rawBody);
        console.log('[get-generation] 解析后的 bodyData:', bodyData);
      } else {
        console.warn('[get-generation] body 既不是字符串也不支持 .text() —— 跳过解析');
      }
    } catch (e) {
      console.error('[get-generation] 请求体解析失败:', e.message);
    }
  }

  // ---------------- 获取 ID ----------------
  let id = null;

  // 1) 查询参数
  if (queryStringParameters) {
    id =
      queryStringParameters.id ||
      queryStringParameters.generationId ||
      queryStringParameters.generation_id ||
      queryStringParameters.ID;
    if (id) console.log('[get-generation] 从查询参数获取 ID:', id);
  }

  // 2) 请求体
  if (!id && bodyData) {
    const fields = ['id', 'generationId', 'generation_id', 'ID', 'Id'];
    for (const f of fields) {
      if (bodyData[f]) { id = bodyData[f]; break; }
    }
    if (id) console.log('[get-generation] 从请求体获取 ID:', id);
  }

  // 3) URL 路径
  if (!id && path) {
    const parts = path.split('/');
    if (parts.length > 4 && parts[3] === 'get-generation' && parts[4]) {
      id = parts[4];
      console.log('[get-generation] 从路径获取 ID:', id);
    }
  }

  // ---------------- 特殊测试 ----------------
  if (queryStringParameters?.test === 'true') {
    return new Response(
      JSON.stringify({ code: 200, msg: '测试成功', detail: '服务器正常运行' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ---------------- 校验 ----------------
  if (!id) {
    return new Response(
      JSON.stringify({ code: 400, msg: '缺少 id 参数' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 去掉 pending- 前缀
  const taskId = id.startsWith('pending-') ? id.slice(8) : id;
  const apiUrl = `${SUNO_RECORD_INFO_URL}?id=${encodeURIComponent(taskId)}`;

  console.log('[get-generation] 原始 ID:', id, '任务 ID:', taskId);
  console.log('[get-generation] API →', apiUrl);

  // ---------------- 调 Suno API ----------------
  try {
    const resp = await fetchRetry(apiUrl, {
      headers: {
        Accept       : 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
      },
    });
    const text = await resp.text();
    console.log('[get-generation] Suno 返回 (前 300):', text.slice(0, 300));

    return new Response(text, {
      status : resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (err) {
    console.error('[get-generation] 请求 Suno 失败:', err.message);
    return new Response(
      JSON.stringify({ code: 502, msg: err.message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

// Netlify 要求必须有默认导出
export default handler;
