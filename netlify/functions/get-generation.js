// === netlify/functions/get-generation.js ===
// 代理 Suno “record-info” 接口，查询任务进度或最终 audio_url
// 运行于 Netlify Functions（兼容 v1 Node 与 v2 / Edge Runtime）
// 依赖环境变量：SUNO_API_KEY

/******************************************************************************/
// 1. 常量 & 工具
/******************************************************************************/
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000;   // 单次请求超时
const MAX_RETRY  = 2;        // 失败重试次数

const corsHeaders = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    fetch(url, { ...opt, signal: ctrl.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
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
// 2. 通用解析：同一份代码兼容  v1(event) & v2/Edge(request)
/******************************************************************************/
async function parseIncoming(arg) {
  /* ---------- v2 / Edge：参数是 Request ---------- */
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
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

  /* ---------- v1：参数是 event ---------- */
  const event = arg;
  const { httpMethod: method, queryStringParameters: query } = event;
  let bodyData = null;
  if (event.body) { try { bodyData = JSON.parse(event.body); } catch {} }

  return { method, query: query || {}, bodyData, isEdge: false, event };
}

/******************************************************************************/
// 3. 生成符合运行时的返回值
/******************************************************************************/
function buildResponse({ status = 200, headers = {}, body = '' }, isEdge) {
  if (isEdge) {
    return new Response(body, { status, headers });
  }
  return { statusCode: status, headers, body };
}

/******************************************************************************/
// 4. 主入口
/******************************************************************************/
export const handler = async (arg) => {
  const { method, query, bodyData, isEdge } = await parseIncoming(arg);

  /* ---------- CORS 预检 ---------- */
  if (method === 'OPTIONS') {
    return buildResponse({ status: 204, headers: corsHeaders }, isEdge);
  }

  /* ---------- 获取任务 id ---------- */
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

  // 兼容 /get-generation/:id 路径形式
  if (!id && (isEdge ? arg.url : arg.event?.path)) {
    const pathname = isEdge ? new URL(arg.url).pathname : arg.event.path;
    const parts = pathname.split('/');
    if (parts[3] === 'get-generation' && parts[4]) id = parts[4];
  }

  /* ---------- 快速健康检查 ---------- */
  if (query.test === 'true') {
    return buildResponse({
      status : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ code: 200, msg: '测试成功' }),
    }, isEdge);
  }

  /* ---------- id 必填 ---------- */
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
  /*  调 Suno record-info —— 必须 POST + JSON body { id: taskId }           */
  /**************************************************************************/
  try {
    const resp = await fetchRetry(SUNO_RECORD_INFO_URL, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept'      : 'application/json',
        'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
      },
      body: JSON.stringify({ id: taskId }),
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

/* ---------- default 导出（老版 bundler 需要） ---------- */
export default handler;
