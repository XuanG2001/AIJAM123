/* ──────────────────────────────────────────────────────────────
 *  netlify/functions/generate.js
 *  调用 Suno /generate 接口，返回任务 id
 *  兼容 Netlify Functions v1 (Node) 与 v2 / Edge Runtime
 *  依赖环境变量：SUNO_API_KEY
 * ────────────────────────────────────────────────────────────── */

/* ───────── 1. 常量与工具 ───────── */
const SUNO_API_URL =
  'https://apibox.erweima.ai/api/v1/generate'; // Suno 生成端点
const DEFAULT_CALLBACK_URL =
  'https://aijam123.netlify.app/.netlify/functions/suno-callback';

const TIMEOUT_MS = 120_000; // 单次请求超时
const MAX_RETRY  = 2;       // 失败重试次数

const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/* 超时包装 */
const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const t   = setTimeout(() => ctl.abort(), ms);
    fetch(url, { ...opt, signal: ctl.signal })
      .then((r) => { clearTimeout(t); resolve(r); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });

/* 指数退避重试 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchRetry = async (url, opt) => {
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      if (i) console.log(`[retry ${i}] ${url}`);
      return await fetchTimeout(url, opt);
    } catch (e) {
      if (i === MAX_RETRY) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
};

/* ───────── 2. 兼容两种运行时的解析 & 返回 ───────── */
async function parseIncoming(arg) {
  /* Edge / v2：参数是 Request */
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
    const req   = arg;
    const m     = req.method.toUpperCase();
    const raw   = m === 'POST' ? await req.text() : '';
    const body  = raw ? JSON.parse(raw) : null;
    return { method: m, body, isEdge: true };
  }
  /* Node / v1：参数是 event */
  const { httpMethod, body } = arg;
  return { method: httpMethod.toUpperCase(), body: body ? JSON.parse(body) : null, isEdge: false };
}

function buildRes({ status = 200, headers = {}, body = '' }, isEdge) {
  if (isEdge) return new Response(body, { status, headers });
  return { statusCode: status, headers, body };
}

/* ───────── 3. 主入口 ───────── */
export const handler = async (arg) => {
  const { method, body, isEdge } = await parseIncoming(arg);

  /* ---- 预检 ---- */
  if (method === 'OPTIONS')
    return buildRes({ status: 204, headers: corsHeaders }, isEdge);

  if (method !== 'POST')
    return buildRes({ status: 405, headers: corsHeaders, body: 'Method Not Allowed' }, isEdge);

  /* ---- 参数校验 ---- */
  if (!body?.prompt) {
    return buildRes({
      status : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '缺少 prompt' }),
    }, isEdge);
  }

  /* ---- 组装 Suno 请求体 ---- */
  const reqBody = {
    prompt      : body.prompt,
    instrumental: body.instrumental,
    customMode  : body.customMode,
    callBackUrl : body.callBackUrl || DEFAULT_CALLBACK_URL,
  };
  if (body.style)      reqBody.style      = body.style;
  if (body.model)      reqBody.model      = body.model;
  if (body.title)      reqBody.title      = body.title;
  if (body.tags)       reqBody.tags       = body.tags;
  if (body.instrument) reqBody.instrument = body.instrument;
  if (body.tempo)      reqBody.tempo      = body.tempo;

  console.log('[generate] 请求体:', JSON.stringify(reqBody));

  /* ---- 调用 Suno /generate ---- */
  let resp;
  try {
    resp = await fetchRetry(SUNO_API_URL, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept        : 'application/json',
        Authorization : `Bearer ${process.env.SUNO_API_KEY}`,
      },
      body: JSON.stringify(reqBody),
    });
  } catch (err) {
    console.error('[generate] 请求 Suno 失败:', err.message);
    return buildRes({
      status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '请求 Suno API 失败', error: err.message }),
    }, isEdge);
  }

  const text = await resp.text();
  console.log('[generate] Suno 原始响应:', text.slice(0, 300));

  /* ---- 解析响应并提取 taskId ---- */
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }

  // Suno 常见 id 字段：taskId / task_id / uuid / id
  const taskId =
    data?.data?.taskId  ||
    data?.data?.task_id ||
    data?.data?.uuid    ||
    data?.data?.id;

  if (!taskId) {
    return buildRes({
      status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: '未找到 taskId', raw: data }),
    }, isEdge);
  }

  console.log('[generate] 提取 taskId =', taskId);

  /* ---- 返回给前端：统一用字段 id ---- */
  return buildRes({
    status : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ id: taskId, raw: data }),
  }, isEdge);
};

export default handler;
