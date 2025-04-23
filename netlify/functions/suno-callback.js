// === netlify/functions/suno-callback.js ===
// 轻量回调：仅记录日志并返回 200，真实进度由前端轮询 get-generation 获取

const cbCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

export const handler = async (event) => {
  /* ---------- CORS 预检 ---------- */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cbCors };
  }

  /* ---------- 仅接受 POST ---------- */
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cbCors, body: 'Method Not Allowed' };
  }

  /* ---------- 记录回调体（可在 Netlify Logs 查看） ---------- */
  try {
    const logSnippet = event.body?.slice(0, 1000); // 截断防止日志过大
    console.log('[Suno callback] body:', logSnippet);
  } catch (_) {
    console.log('[Suno callback] body: <non-string>');
  }

  /* ---------- 回 200 告知 Suno 收到 ---------- */
  return {
    statusCode: 200,
    headers: cbCors,
    body: JSON.stringify({ success: true, mode: 'direct_api_query' })
  };
};
