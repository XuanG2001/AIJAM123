import { useState, useCallback, useEffect } from 'react';
import type { GenerateParams, GenerateResponse } from '../types';

/**
 * Suno Hook
 * --------------------------------------------
 * 1. generate()  : 发送生成请求，得到任务 ID
 * 2. 自动轮询    : 根据 ID 查询进度，直到拿到 audio_url
 * 3. reset()     : 清空本地状态
 *
 * ⚠️ 关键点
 *   - 后端只接受“裸 id”，不要给它加任何前缀
 *   - GET 用查询参数 ?id=xxx
 *   - POST 把 { id: xxx } 放到 JSON body
 */

// ---------------- 常量 ----------------
const NETLIFY_GENERATE_PATH       = '/.netlify/functions/generate';
const NETLIFY_GET_GENERATION_PATH = '/.netlify/functions/get-generation';

const DEBUG = true;
const log = (...args: unknown[]) => DEBUG && console.log('[Suno]', ...args);

// ---------------- 小工具 ----------------
// 去掉 pending- 前缀（如果有）
const stripPendingPrefix = (id: string) =>
  id && id.startsWith('pending-') ? id.slice(8) : id;

// ---------------- React Hook ----------------
export const useSuno = () => {
  /* ---------- 状态 ---------- */
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState<boolean>(false);
  const [progress,     setProgress]     = useState<number>(0);

  const [generationId, setGenerationId] = useState<string | null>(() => {
    const saved = localStorage.getItem('generationId');
    log('恢复 generationId:', saved);
    return saved;
  });

  const [audioUrl,     setAudioUrl]     = useState<string | null>(() => {
    const saved = localStorage.getItem('audioUrl');
    log('恢复 audioUrl:', saved);
    return saved;
  });

  const [statusDetails, setStatusDetails] = useState<any>(null);

  /* ---------- 1. 生成音乐 ---------- */
  const generate = useCallback(
    async (params: GenerateParams): Promise<GenerateResponse> => {
      // 初始化
      setError(null);
      setLoading(true);
      setProgress(0);
      setAudioUrl(null);
      setStatusDetails(null);
      localStorage.removeItem('audioUrl');

      log('generate 参数:', params);

      // 发送 POST 请求
      const res  = await fetch(NETLIFY_GENERATE_PATH, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(params),
      });
      const data = await res.json();
      log('generate 响应:', data);

      if (!res.ok) {
        const msg = data.message || `Generate API 错误 (${res.status})`;
        setError(msg);
        setLoading(false);
        throw new Error(msg);
      }
      if (!data.id) {
        setError('Generate 接口未返回 id');
        setLoading(false);
        throw new Error('缺少 id');
      }

      // 直接保存 **裸 id**
      setGenerationId(data.id);
      localStorage.setItem('generationId', data.id);

      // 如果后端立即返回 audio_url
      if (data.status === 'COMPLETE' && data.audio_url) {
        setAudioUrl(data.audio_url);
        localStorage.setItem('audioUrl', data.audio_url);
        setProgress(100);
        setLoading(false);
      }

      return data as GenerateResponse;
    },
    [],
  );

  /* ---------- 2. 单次查询 ---------- */
  const checkGenerationStatus = useCallback(
    async (id: string): Promise<GenerateResponse> => {
      if (!id) throw new Error('缺少 generationId');

      const realId = stripPendingPrefix(id); // <-- 关键
      const url =
        `${NETLIFY_GET_GENERATION_PATH}?id=${encodeURIComponent(realId)}&_t=${Date.now()}`;
      log('checkGenerationStatus GET:', url);

      const res  = await fetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
      const text = await res.text();
      log('响应:', text.slice(0, 200));

      if (!res.ok) throw new Error(`状态码 ${res.status}: ${text}`);

      const data = JSON.parse(text);
      setStatusDetails(data);
      return data as GenerateResponse;
    },
    [],
  );

  /* ---------- 3. 轮询进度 ---------- */
  useEffect(() => {
    if (!generationId) {
      log('未找到 generationId，不启动轮询');
      return;
    }

    log('开始轮询, generationId =', generationId);
    let timer: number;
    let retry = 0;
    const MAX_RETRY = 10;

    const poll = async () => {
      try {
        // 每次用 POST + body 方式
        const realId = stripPendingPrefix(generationId); // <-- 关键
        const res    = await fetch(NETLIFY_GET_GENERATION_PATH, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body   : JSON.stringify({ id: realId }),
        });

        const text = await res.text();
        log('轮询响应:', text.slice(0, 300));

        if (!res.ok) throw new Error(`POST 失败: ${res.status} - ${text}`);

        const data = JSON.parse(text) as GenerateResponse;
        setStatusDetails(data);

        // 更新进度
        if (data.progress !== undefined) setProgress(data.progress * 100);

        // 完成
        if (data.status === 'COMPLETE' && data.audio_url) {
          setAudioUrl(data.audio_url);
          localStorage.setItem('audioUrl', data.audio_url);
          setProgress(100);
          setLoading(false);
          return;
        }

        // 继续轮询
        retry = 0;
        timer = window.setTimeout(poll, 3000);
      } catch (e) {
        log('轮询出错:', e);
        retry += 1;
        if (retry >= MAX_RETRY) {
          setError(`多次请求失败: ${e instanceof Error ? e.message : String(e)}`);
          setLoading(false);
          return;
        }
        timer = window.setTimeout(poll, 3000);
      }
    };

    poll();
    return () => window.clearTimeout(timer);
  }, [generationId]);

  /* ---------- 4. 重置 ---------- */
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

  /* ---------- 返回 API ---------- */
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
