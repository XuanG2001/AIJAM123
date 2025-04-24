// === netlify/functions/get-generation.js ===
// 查询 Suno 任务进度或最终 audio_url
// 兼容 Netlify Functions v1 / v2 运行时
// 依赖环境变量 SUNO_API_KEY

/******************************************************************************/
// 1. 常量 & 工具
/******************************************************************************/
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info'; // 不含尾斜杠

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
      await sleep(1000 * 2 ** i);
    }
  }
};

/******************************************************************************/
// 2. 通用解析：兼容 v1(event) & v2/Edge(request)
/******************************************************************************/
async function parseIncoming(arg) {
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
    /* -------- v2 / Edge -------- */
    const request = arg;
    const url     = new URL(request.url);
    const query   = Object.fromEntries(url.searchParams.entries());
    const method  = request.method.toUpperCase();

    let rawBody = '';
    if (method === 'POST' || method === 'PUT') {
      try { rawBody = await request.text(); } catch {}
    }
    let bodyData = null;
    if (rawBody) { try { bodyData = JSON.parse(rawBody); } catch {} }

    return { method, query, bodyData, isEdge: true, request };
  }

  /* -------- v1 -------- */
  const event = arg;
  const { httpMethod: method, queryStringParameters: query } = event;
  let bodyData = null;
  if (event.body) { try { bodyData = JSON.parse(event.body); } catch {} }

  return { method, query: query || {}, bodyData, isEdge: false, event };
}

/******************************************************************************/
// 3. 构造符合运行时的 Response
/******************************************************************************/
function buildResponse({ status = 200, headers = {}, body = '' }, isEdge) {
  if (isEdge) return new Response(body, { status, headers });
  return { statusCode: status, headers, body };
}

/******************************************************************************/
// 4. 主入口
/******************************************************************************/
export const handler = async (arg) => {
  const { method, query, bodyData, isEdge } = await parseIncoming(arg);

  /* ---------- CORS ---------- */
  if (method === 'OPTIONS') {
    return buildResponse({ status: 204, headers: corsHeaders }, isEdge);
  }

  /* ---------- 取 id ---------- */
  let id =
    query.id ||
    query.generationId ||
    query.generation_id ||
    query.ID;

  if (!id && bodyData) {
    for (const k of ['id', 'generationId', 'generation_id', 'ID', 'Id']) {
      if (bodyData[k]) { id = bodyData[k]; break; }
    }
  }

  // 支持 /get-generation/:id
  if (!id && (isEdge ? arg.url : arg.event?.path)) {
    const pathname = isEdge ? new URL(arg.url).pathname : arg.event.path;
    const parts = pathname.split('/');
    if (parts[3] === 'get-generation' && parts[4]) id = parts[4];
  }

  if (!id) {
    return buildResponse({
      status : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ code: 400, msg: '缺少 id 参数' }),
    }, isEdge);
  }

  // 去掉 pending- 前缀
  const taskId = id.startsWith('pending-') ? id.slice(8) : id;
  console.log('[debug] 查询 taskId =', taskId);

  /**************************************************************************/
  /*  调 Suno record-info                                                   */
  /*  规则：GET /record-info/{id}                                           */
  /**************************************************************************/
  try {
    const apiURL = `${SUNO_RECORD_INFO_URL}/${encodeURIComponent(taskId)}`;
    const resp   = await fetchRetry(apiURL, {
      method : 'GET',
      headers: {
        Accept       : 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
      },
    });

    const text = await resp.text();
    console.log('[get-generation] Suno 返回 (前 300):', text.slice(0, 300));

    return buildResponse({
      status : resp.status,
      headers: {
        ...corsHeaders,
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      },
      body   : text,
    }, isEdge);

  } catch (err) {
    console.error('[get-generation] 调 Suno 失败:', err.message);
    return buildResponse({
      status : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ code: 502, msg: err.message }),
    }, isEdge);
  }
};

/* ---------- default 导出 ---------- */
export default handler;
