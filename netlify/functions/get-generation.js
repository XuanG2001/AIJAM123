/* ──────────────────────────────────────────────────────────────
 *  netlify/functions/get-generation.js
 *  根据 taskId 查询 Suno 生成进度 / audio_url
 *  兼容 Netlify Functions v1 (Node) 与 v2 / Edge Runtime
 *  依赖环境变量：SUNO_API_KEY
 * ────────────────────────────────────────────────────────────── */

/* ───────── 1. 常量与小工具 ───────── */
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000;
const MAX_RETRY  = 2;

const cors = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const t   = setTimeout(() => ctl.abort(), ms);
    fetch(url, { ...opt, signal: ctl.signal })
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

/* ───────── 2. 解析请求：兼容 v1 & v2 ───────── */
async function parseIncoming(arg) {
  if (typeof arg?.method === 'string' && typeof arg?.headers?.get === 'function') {
    /* v2 / Edge */
    const req    = arg;
    const qs     = Object.fromEntries(new URL(req.url).searchParams.entries());
    const raw    = req.method === 'POST' ? await req.text() : '';
    return { method: req.method.toUpperCase(), query: qs, body: raw ? JSON.parse(raw) : null, isEdge:true };
  }
  /* v1 / Node */
  const { httpMethod, queryStringParameters, body } = arg;
  return { method: httpMethod.toUpperCase(), query: queryStringParameters || {}, body: body ? JSON.parse(body) : null, isEdge:false };
}

function buildRes({ status = 200, headers = {}, body = '' }, isEdge) {
  if (isEdge) return new Response(body, { status, headers });
  return { statusCode: status, headers, body };
}

/* ───────── 3. 主 handler ───────── */
export const handler = async (arg) => {
  const { method, query, body, isEdge } = await parseIncoming(arg);

  /* ---- 预检 ---- */
  if (method === 'OPTIONS') {
    return buildRes({ status: 204, headers: cors }, isEdge);
  }

  /* ---- 拿 taskId ---- */
  let taskId = query.id || query.taskId || (body ? body.id || body.taskId : null);
  if (!taskId && (isEdge ? arg.url : arg.event?.path)) {
    const p = (isEdge ? new URL(arg.url).pathname : arg.event.path).split('/');
    if (p[3] === 'get-generation' && p[4]) taskId = p[4];
  }
  if (!taskId) {
    return buildRes({
      status : 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ code: 400, msg: '缺少 id / taskId 参数' }),
    }, isEdge);
  }
  if (taskId.startsWith('pending-')) taskId = taskId.slice(8);

  console.log('[get-generation] 查询 taskId =', taskId);

  /* ---- 调 Suno record-info：GET + ?taskId= ---- */
  const api = `${SUNO_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`;

  try {
    const r   = await fetchRetry(api, {
      headers: {
        Accept        : 'application/json',
        Authorization : `Bearer ${process.env.SUNO_API_KEY}`,
      },
    });
    const raw = await r.text();
    console.log('[get-generation] Suno 返回 (前 150):', raw.slice(0, 150));

    /* ──── 关键：扁平化给前端 ──── */
    let j;
    try { j = JSON.parse(raw); } catch { j = {}; }

    const audioUrl = j?.data?.response?.sunoData?.[0]?.audioUrl || null;
    const status   = j?.data?.status === 'SUCCESS' ? 'COMPLETE' : j?.data?.status || 'PROCESSING';
    const progress = status === 'COMPLETE' ? 1 : 0; // Suno 未给百分比

    const front = {
      id       : taskId,
      status,                    // "COMPLETE" 或 "PROCESSING"
      progress,                  // 0/1
      audio_url: audioUrl,       // 前端 useSuno 正在找的字段
      raw      : j               // 调试用，前端可忽略
    };

    return buildRes({
      status : 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body   : JSON.stringify(front),
    }, isEdge);

  } catch (e) {
    console.error('[get-generation] 调 Suno 失败:', e.message);
    return buildRes({
      status : 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body   : JSON.stringify({ code: 502, msg: e.message }),
    }, isEdge);
  }
};

export default handler;
