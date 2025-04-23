// === netlify/functions/get-generation.js ===
// 代理 Suno “record-info” 接口，返回生成进度或最终 audio_url
// 依赖环境变量 SUNO_API_KEY (Netlify → Site settings → Env vars)

// 1. 常量与工具 --------------------------------------------------
const SUNO_RECORD_INFO_URL =
  'https://apibox.erweima.ai/api/v1/generate/record-info';

// 请求 10 s 超时
const TIMEOUT_MS = 10_000;
// 最多重试 3 次（含首次）
const MAX_RETRY = 2;

/**
 * fetch with timeout (AbortController)
 */
const fetchTimeout = (url, opt = {}, ms = TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), ms);
    fetch(url, { ...opt, signal: ctl.signal })
      .then((r) => {
        clearTimeout(id);
        resolve(r);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });

/**
 * 简单指数退避重试
 */
const fetchRetry = async (url, opt) => {
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      if (i) console.log(`[retry ${i}] ${url}`);
      return await fetchTimeout(url, opt);
    } catch (e) {
      if (i === MAX_RETRY) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

// 2. 处理函数 ----------------------------------------------------
export const handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;

  // CORS 预检
  if (httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders };

  // 仅支持 GET
  if (httpMethod !== 'GET')
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  const id = queryStringParameters?.id;
  if (!id)
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ code: 400, msg: '缺少 id 参数' })
    };

  // Suno 需要完整 pending- 前缀，故 **不再剥离**
  const api = `${SUNO_RECORD_INFO_URL}?id=${encodeURIComponent(id)}`;
  console.log('[get-generation] =>', api);

  try {
    const raw = await fetchRetry(api, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.SUNO_API_KEY}`
      }
    });

    const text = await raw.text(); // 直接转发文本，保留 Suno 原始格式
    return { statusCode: raw.status, headers: corsHeaders, body: text };
  } catch (err) {
    console.error('[get-generation] error:', err.message);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ code: 502, msg: err.message })
    };
  }
};
