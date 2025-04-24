// === netlify/functions/generate.js ===
// 调用 Suno /generate，返回任务 id
// 兼容 Netlify Functions v1 (Node) 与 v2 / Edge Runtime
// 依赖环境变量：SUNO_API_KEY

/******************************************************************************/
// 1. 常量 & 工具
/******************************************************************************/
const SUNO_API_URL = 'https://apibox.erweima.ai/api/v1/generate';
const DEFAULT_CALLBACK_URL =
  'https://aijam123.netlify.app/.netlify/functions/suno-callback';

const TIMEOUT_MS = 120_000;
const MAX_RETRY  = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), ms);
    fetch(url, { ...opt, signal: ctrl.signal })
      .then((res) => { clearTimeout(t); resolve(res); })
      .catch((err) => { clearTimeout(t); reject(err); });
  });

const fetchRetry = async (url, opt) => {
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      if (i) console.log(`[retry ${i}] ${url}`);
      return await fetchTimeout(url, opt);
    } catch (err) {
      if (i === MAX_RETRY) throw err;
      await sleep(1_000 * 2 ** i);
    }
  }
};

/******************************************************************************/
// 2. 解析入口参数：兼容 v1(event) & v2/Edge(request)
/******************************************************************************/
async function parseIncoming(arg) {
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
    // ----- v2 / Edge -----
    const request  = arg;
    const method   = request.method.toUpperCase();
    const rawBody  = method === 'POST' ? await request.text() : '';
    const bodyData = rawBody ? JSON.parse(rawBody) : null;
    return { method, bodyData, isEdge: true };
  }

  // ----- v1 -----
  const event     = arg;
  const method    = event.httpMethod.toUpperCase();
  const bodyData  = event.body ? JSON.parse(event.body) : null;
  return { method, bodyData, isEdge: false };
}

/******************************************************************************/
// 3. 统一返回格式
/******************************************************************************/
function buildResponse({ status = 200, headers = {}, body = '' }, isEdge) {
  if (isEdge) return new Response(body, { status, headers });
  return { statusCode: status, headers, body };
}

/******************************************************************************/
// 4. 主 handler
/******************************************************************************/
export const handler = async (arg) => {
  const { method, bodyData, isEdge } = await parseIncoming(arg);

  /* ---------- CORS ---------- */
  if (method === 'OPTIONS') {
    return buildResponse({ status: 204, headers: corsHeaders }, isEdge);
  }

  if (method !== 'POST') {
    return buildResponse({
      status : 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      body   : 'Method Not Allowed',
    }, isEdge);
  }

  /* ---------- 参数校验 ---------- */
  const {
    prompt, instrumental, customMode,
    callBackUrl, style, model, title,
    tags, instrument, tempo, test,
  } = bodyData || {};

  if (!prompt && !test) {
    return buildResponse({
      status : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '缺少必要参数 prompt 或 test' }),
    }, isEdge);
  }

  /* ---------- 测试模式 ---------- */
  if (test === true) {
    return buildResponse({
      status : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        code   : 200,
        data   : { id: 'test-request', status: 'IN_PROGRESS', progress: 0 },
        msg    : '测试请求已接收',
      }),
    }, isEdge);
  }

  /* ---------- 组装 Suno 请求 ---------- */
  const reqBody = {
    prompt,
    instrumental,
    customMode,
    callBackUrl: callBackUrl || DEFAULT_CALLBACK_URL,
  };
  if (style)      reqBody.style      = style;
  if (model)      reqBody.model      = model;
  if (title)      reqBody.title      = title;
  if (tags)       reqBody.tags       = tags;
  if (instrument) reqBody.instrument = instrument;
  if (tempo)      reqBody.tempo      = tempo;

  console.log('[generate] 请求体:', JSON.stringify(reqBody));

  let resp;
  try {
    resp = await fetchRetry(SUNO_API_URL, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept'      : 'application/json',
        'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });
  } catch (err) {
    return buildResponse({
      status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '请求 Suno API 失败', error: err.message }),
    }, isEdge);
  }

  const text = await resp.text();
  console.log('[generate] Suno 原始响应:', text.slice(0, 300));

  // Suno 成功时必有 data 字段
  let data;
  try { data = JSON.parse(text); } catch {}

  // 提取任务 id：常见字段 uuid / task_id / id
  const taskId =
    data?.data?.uuid     ||
    data?.data?.task_id  ||
    data?.data?.id       ||
    null;

  if (!taskId) {
    return buildResponse({
      status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '未在 Suno 响应中找到任务 id', raw: text }),
    }, isEdge);
  }

  // 返回给前端统一字段 id
  return buildResponse({
    status : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ id: taskId, raw: data }),
  }, isEdge);
};

/* ---------- default 导出 ---------- */
export default handler;
