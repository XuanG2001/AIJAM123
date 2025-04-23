import { useState, useCallback, useEffect } from 'react';
import { GenerateParams, GenerateResponse } from '../types';

// Netlify 函数端点
const NETLIFY_GENERATE_PATH       = '/.netlify/functions/generate';
const NETLIFY_GET_GENERATION_PATH = '/.netlify/functions/get-generation';

const DEBUG = true;
const debugLog = (...args: any[]) => { if (DEBUG) console.log('[Suno]', ...args); };

export const useSuno = () => {
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState<boolean>(false);
  const [progress, setProgress]         = useState<number>(0);
  const [generationId, setGenerationId] = useState<string | null>(() => {
    const saved = localStorage.getItem('generationId');
    debugLog('恢复 generationId:', saved);
    return saved;
  });
  const [audioUrl, setAudioUrl]         = useState<string | null>(() => {
    const saved = localStorage.getItem('audioUrl');
    debugLog('恢复 audioUrl:', saved);
    return saved;
  });
  const [statusDetails, setStatusDetails] = useState<any>(null);

  // 1. 生成音乐
  const generate = useCallback(async (params: GenerateParams) => {
    setError(null);
    setLoading(true);
    setProgress(0);
    setAudioUrl(null);
    setStatusDetails(null);
    localStorage.removeItem('audioUrl');

    debugLog('generate 参数:', params);

    const res = await fetch(NETLIFY_GENERATE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    debugLog('generate 响应:', data);

    if (!res.ok) { setError(data.message || `Generate API 错误 (${res.status})`); setLoading(false); throw new Error(data.message); }
    if (!data.id) { setError('Generate 接口未返回 id'); setLoading(false); throw new Error('缺少 id'); }

    // 处理前缀：确保以 pending- 开头
let pendingId = data.id;
if (!pendingId.startsWith('pending-')) {
  pendingId = `pending-${pendingId}`;
  debugLog('自动添加 pending- 前缀, new pendingId =', pendingId);
} else {
  debugLog('pendingId 已包含前缀');
}
setGenerationId(pendingId);
localStorage.setItem('generationId', pendingId);

    if (data.status === 'COMPLETE' && data.audio_url) {
      setAudioUrl(data.audio_url);
      localStorage.setItem('audioUrl', data.audio_url);
      setProgress(100);
      setLoading(false);
    }

    return data as GenerateResponse;
  }, []);

  // 2. 单次查询状态
  const checkGenerationStatus = useCallback(async (id: string): Promise<GenerateResponse> => {
    if (!id) throw new Error('缺少 generationId');
    debugLog('checkGenerationStatus, id=', id);

    // 确保使用正确的端点
    const url = `${NETLIFY_GET_GENERATION_PATH}?id=${encodeURIComponent(id)}`;
    debugLog('Polling URL:', url);

    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    debugLog('原始响应文本:', text.substr(0, 200));

    // 405 或其他非 JSON 响应需先处理
    if (!res.ok) {
      // 服务器返回 Method Not Allowed 或自定义错误
      const msg = text.startsWith('{')
        ? JSON.parse(text).message || `状态查询错误(${res.status})`
        : `请求失败: ${text}`;
      throw new Error(msg);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('状态查询返回非法JSON');
    }
    debugLog('状态响应:', json);
    setStatusDetails(json);

    return json as GenerateResponse;
  }, []);

  // 3. 仅在有 generationId 时启动轮询
  useEffect(() => {
    if (!generationId) return;
    let timer: number;

    const loop = async () => {
      try {
        const result = await checkGenerationStatus(generationId);
        if (result.progress !== undefined) setProgress(result.progress * 100);
        if (result.status === 'COMPLETE' && result.audio_url) {
          debugLog('生成完成:', result.audio_url);
          setAudioUrl(result.audio_url);
          localStorage.setItem('audioUrl', result.audio_url);
          setProgress(100);
          setLoading(false);
          return;
        }
        timer = window.setTimeout(loop, 3000);
      } catch (e: any) {
        debugLog('轮询出错:', e.message);
        setError(e.message);
        setLoading(false);
      }
    };

    loop();
    return () => window.clearTimeout(timer);
  }, [generationId, checkGenerationStatus]);

  // 4. 重置
  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    setProgress(0);
    setGenerationId(null);
    setAudioUrl(null);
    setStatusDetails(null);
    localStorage.removeItem('generationId');
    localStorage.removeItem('audioUrl');
  }, []);

  return {
    generate,
    checkGenerationStatus,
    reset,
    error,
    loading,
    progress,
    generationId,
    audioUrl,
    statusDetails,
  };
};

export default useSuno;
