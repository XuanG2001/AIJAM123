// === netlify/functions/get-generation.js ===
// 代理 Suno “record-info” 接口，返回生成进度或最终 audio_url
// 依赖环境变量 SUNO_API_KEY (Netlify → Site settings → Env vars)

// 1. 常量与工具 --------------------------------------------------
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

const TIMEOUT_MS = 10_000; // 10 s 超时
const MAX_RETRY  = 2;      // 最多重试 2 次（共 3 次请求）

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

/** fetch with timeout helper */
const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((res, rej) => {
    const ctl = new AbortController();
    const id  = setTimeout(() => ctl.abort(), ms);
    fetch(url, { ...opt, signal: ctl.signal })
      .then((r) => { clearTimeout(id); res(r); })
      .catch((e) => { clearTimeout(id); rej(e); });
  });

/** basic exponential‑backoff retry */
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

exports.handler = async function (event) {
  const { httpMethod, queryStringParameters } = event;

  // CORS 预检
  if (httpMethod === 'OPTIONS')
    return { statusCode: 204, headers: corsHeaders };

  // 仅支持 GET
  if (httpMethod !== 'GET')
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  console.log('[get-generation] query =', queryStringParameters);

  const id = queryStringParameters?.id;
  if (!id)
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ code: 400, msg: '缺少 id 参数' })
    };

  const api = `${SUNO_RECORD_INFO_URL}?id=${encodeURIComponent(id)}`;
  console.log('[get-generation] =>', api);
  console.log('[get-generation] key head =', (process.env.SUNO_API_KEY || '').slice(0, 8));

  try {
    const resp = await fetchRetry(api, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`
      }
    });
    const body = await resp.text();
    console.log('[resp]', body.slice(0, 300)); // 打印前 300 字方便排查
    return { statusCode: resp.status, headers: corsHeaders, body };
  } catch (err) {
    console.error('[get-generation] error:', err.message);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ code: 502, msg: err.message })
    };
  }
};


// === netlify/functions/suno-callback.js ===
// 轻量回调：仅记录日志并返回 200，实际状态由前端轮询 get-generation 获取

const cbCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

exports.handler = async function (event) {
  // CORS 预检
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 204, headers: cbCors };

  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: cbCors, body: 'Method Not Allowed' };

  try {
    console.log('[Suno callback] raw body:', event.body?.slice(0, 1000)); // 截断日志防止爆量
  } catch (_) {}

  return {
    statusCode: 200,
    headers: cbCors,
    body: JSON.stringify({ success: true, mode: 'direct_api_query' })
  };
};
