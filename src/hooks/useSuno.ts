import { useState, useCallback, useEffect } from 'react';
import { GenerateParams, GenerateResponse } from '../types';

// Netlify 函数路径
const NETLIFY_GENERATE_PATH       = '/.netlify/functions/generate';
const NETLIFY_GET_GENERATION_PATH = '/.netlify/functions/get-generation';
const NETLIFY_EXTEND_PATH         = '/.netlify/functions/extend';

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

  // 1. 发起生成请求
  const generate = useCallback(async (params: GenerateParams) => {
    setError(null);
    setLoading(true);
    setProgress(0);
    setAudioUrl(null);
    setStatusDetails(null);
    localStorage.removeItem('audioUrl');

    // 默认值处理
    params.instrumental = params.instrumental ?? false;
    params.customMode   = params.customMode ?? false;
    params.callBackUrl  = params.callBackUrl || `${window.location.origin}${NETLIFY_EXTEND_PATH.replace('extend', 'suno-callback')}`;

    debugLog('generate 参数:', params);

    const res = await fetch(NETLIFY_GENERATE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    debugLog('generate 响应:', data);

    if (!res.ok) {
      const msg = data.message || `Generate API 错误 (${res.status})`;
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    if (!data.id) {
      const msg = 'Generate 接口未返回 id';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    // 保存并设置 ID
    debugLog('pendingId =', data.id);
    setGenerationId(data.id);
    localStorage.setItem('generationId', data.id);

    // 若立即返回音频
    if (data.status === 'COMPLETE' && data.audio_url) {
      setAudioUrl(data.audio_url);
      localStorage.setItem('audioUrl', data.audio_url);
      setProgress(100);
      setLoading(false);
    }

    return data as GenerateResponse;
  }, []);

  // 2. 单次状态查询
  const checkGenerationStatus = useCallback(async (id: string): Promise<GenerateResponse> => {
    if (!id) throw new Error('缺少 generationId');
    debugLog('checkGenerationStatus, id=', id);

    const url = `${NETLIFY_GET_GENERATION_PATH}?id=${encodeURIComponent(id)}`;
    debugLog('Polling URL:', url);

    const res = await fetch(url);
    const json = await res.json();
    debugLog('状态响应:', json);
    setStatusDetails(json);

    if (!res.ok) {
      const msg = json.message || `状态查询错误 (${res.status})`;
      throw new Error(msg);
    }
    return json as GenerateResponse;
  }, []);

  // 3. 仅在有 generationId 时启动轮询
  useEffect(() => {
    if (!generationId) return;
    let timer: number;

    const loop = async () => {
      try {
        const result = await checkGenerationStatus(generationId);
        if (result.progress !== undefined) {
          setProgress(result.progress * 100);
        }
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
