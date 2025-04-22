import { useState, useCallback } from 'react';
import { GenerateParams, GenerateResponse } from '../types';

// 检查是否为生产环境，根据环境选择API基础路径
const API_BASE_URL = '/api';

// 设置Netlify特定的API端点
const NETLIFY_GENERATE_PATH = '/.netlify/functions/generate';
const NETLIFY_GET_GENERATION_PATH = '/.netlify/functions/get-generation';
const NETLIFY_EXTEND_PATH = '/.netlify/functions/extend';

// 根据环境选择合适的API路径
const getApiPath = (path: string) => {
  // 判断是否在Netlify环境中
  const isNetlify = window.location.host.includes('netlify.app') || 
                  process.env.NODE_ENV === 'production';
  
  if (isNetlify) {
    switch (path) {
      case '/v1/generate':
        return NETLIFY_GENERATE_PATH;
      case `/v1/generate/${localStorage.getItem('generationId')}`:
        return `${NETLIFY_GET_GENERATION_PATH}/${localStorage.getItem('generationId')}`;
      case '/v1/generate/extend':
        return NETLIFY_EXTEND_PATH;
      default:
        return path;
    }
  }
  
  return `${API_BASE_URL}${path}`;
};

export const useSuno = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const generate = useCallback(async (params: GenerateParams) => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      setAudioUrl(null);

      const callBackUrl = import.meta.env.VITE_SUNO_CALLBACK || null;
      
      const response = await fetch(getApiPath('/v1/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          callBackUrl
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '生成音乐时出错');
      }

      const data: GenerateResponse = await response.json();
      setGenerationId(data.id);
      localStorage.setItem('generationId', data.id);

      if (data.status === 'COMPLETE' && data.audio_url) {
        setAudioUrl(data.audio_url);
        setProgress(100);
      } else {
        // Start polling if not immediately complete
        await pollGenerationStatus(data.id);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pollGenerationStatus = useCallback(async (id: string) => {
    let retries = 0;
    const maxRetries = 120; // 10 minutes (5s interval)
    
    const poll = async () => {
      if (retries >= maxRetries) {
        setError('生成超时');
        setLoading(false);
        return;
      }
      
      try {
        localStorage.setItem('generationId', id);
        const apiPath = getApiPath(`/v1/generate/${id}`);
        const response = await fetch(apiPath);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '检查生成状态时出错');
        }
        
        const data: GenerateResponse = await response.json();
        setProgress(data.progress || 0);
        
        if (data.status === 'COMPLETE' && data.audio_url) {
          setAudioUrl(data.audio_url);
          setLoading(false);
          return;
        } else if (data.status === 'FAILED') {
          setError(data.error || '生成失败');
          setLoading(false);
          return;
        }
        
        // Continue polling
        retries++;
        setTimeout(poll, 5000);
      } catch (err) {
        setError(err instanceof Error ? err.message : '检查状态时出错');
        setLoading(false);
      }
    };
    
    await poll();
  }, []);

  const extendTrack = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getApiPath('/v1/generate/extend'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '延长音乐时出错');
      }
      
      const data: GenerateResponse = await response.json();
      setGenerationId(data.id);
      localStorage.setItem('generationId', data.id);
      
      if (data.status === 'COMPLETE' && data.audio_url) {
        setAudioUrl(data.audio_url);
      } else {
        // Start polling if not immediately complete
        await pollGenerationStatus(data.id);
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pollGenerationStatus]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    setProgress(0);
    setGenerationId(null);
    setAudioUrl(null);
    localStorage.removeItem('generationId');
  }, []);

  return {
    generate,
    extendTrack,
    reset,
    error,
    loading,
    progress,
    generationId,
    audioUrl,
    setAudioUrl
  };
};

export default useSuno; 