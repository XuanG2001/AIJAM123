// === netlify/functions/get-generation.js ===
// 代理 Suno “record-info” 接口，返回进度或 audio_url
// 依赖环境变量：SUNO_API_KEY

/* -------------------------------------------------------------------------- */
/*  1. 工具 & 常量                                                             */
/* -------------------------------------------------------------------------- */
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000;
const MAX_RETRY  = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), ms);
    fetch(url, { ...opt, signal: ctrl.signal })
      .then((r) => { clearTimeout(t); resolve(r); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });

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

/* -------------------------------------------------------------------------- */
/*  2. 通用解析函数：同时兼容 Functions v1 (event) 和 v2/Edge (Request)         */
/* -------------------------------------------------------------------------- */
async function parseIncoming(arg) {
  // ---------- Functions v2 / Edge ----------
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
    const request = arg;
    const url     = new URL(request.url);
    const method  = request.method.toUpperCase();
    const query   = Object.fromEntries(url.searchParams.entries());

    let rawBody = '';
    if (method === 'POST' || method === 'PUT') {
      try { rawBody = await request.text(); } catch {}
    }
    let bodyData = null;
    if (rawBody) {
      try { bodyData = JSON.parse(rawBody); } catch {}
    }

    return { method, query, bodyData, request };
  }

  // ---------- Functions v1 (Node event) ----------
  const event = arg;
  const { httpMethod: method, queryStringParameters: query } = event;
  let bodyData = null;
  if (event.body) {
    try { bodyData = JSON.parse(event.body); } catch {}
  }
  return { method, query: query || {}, bodyData, event };
}

/* -------------------------------------------------------------------------- */
/*  3. 主入口                                                                  */
/* -------------------------------------------------------------------------- */
export const handler = async (arg) => {
  const { method, query, bodyData, request } = await parseIncoming(arg);

  // OPTIONS 预检
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  /* ------------------------ 取 id （三种来源） ------------------------ */
  let id =
    query.id ||
    query.generationId ||
    query.generation_id ||
    query.ID;

  if (!id && bodyData) {
    const keys = ['id', 'generationId', 'generation_id', 'ID', 'Id'];
    for (const k of keys) if (bodyData[k]) { id = bodyData[k]; break; }
  }

  if (!id && request?.url) {
    const parts = new URL(request.url).pathname.split('/');
    if (parts[3] === 'get-generation' && parts[4]) id = parts[4];
  }

  // 特殊测试
  if (query.test === 'true') {
    return new Response(
      JSON.stringify({ code: 200, msg: '测试成功' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!id) {
    return new Response(
      JSON.stringify({ code: 400, msg: '缺少 id 参数' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 去掉 pending- 前缀
  const taskId = id.startsWith('pending-') ? id.slice(8) : id;
  const api    = `${SUNO_RECORD_INFO_URL}?id=${encodeURIComponent(taskId)}`;

  /* ------------------------ 调 Suno API ------------------------ */
  try {
    const resp = await fetchRetry(api, {
      headers: {
        Accept       : 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
      },
    });
    const text = await resp.text();
    return new Response(text, {
      status : resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ code: 502, msg: e.message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
};

/* -------------------------------------------------------------------------- */
/*  4. default 导出（给老版 bundler 用）                                       */
/* -------------------------------------------------------------------------- */
export default handler;
