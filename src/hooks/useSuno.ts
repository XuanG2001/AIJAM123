import { useState, useCallback, useEffect } from 'react';
import { GenerateParams, GenerateResponse } from '../types';

// 检查是否为生产环境，根据环境选择API基础路径
const API_BASE_URL = '/api';

// 设置Netlify特定的API端点
const NETLIFY_GENERATE_PATH = '/.netlify/functions/generate';
const NETLIFY_GET_GENERATION_PATH = '/.netlify/functions/get-generation';
const NETLIFY_EXTEND_PATH = '/.netlify/functions/extend';

// 调试模式
const DEBUG = true;

// 调试日志
const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[Suno]', ...args);
  }
};

// 检查环境变量
const checkEnvVariables = () => {
  const sunoApiKey = import.meta.env.VITE_SUNO_API_KEY;
  if (!sunoApiKey || sunoApiKey === 'your_suno_api_key_here') {
    console.warn('警告: 未设置有效的SUNO_API_KEY环境变量');
    return false;
  }
  return true;
};

// 根据环境选择合适的API路径
const getApiPath = (path: string, id?: string) => {
  // 判断是否在Netlify环境中
  const isNetlify = window.location.host.includes('netlify.app') || 
                  process.env.NODE_ENV === 'production';
  
  debugLog('当前环境:', isNetlify ? 'Netlify' : '开发');
  
  if (isNetlify) {
    switch (path) {
      case '/v1/generate':
        return NETLIFY_GENERATE_PATH;
      case `/v1/generate/${id}`:
        if (!id) {
          console.error('错误: 尝试获取生成状态时ID未定义');
          return ''; // 返回空字符串，调用处需要检查
        }
        return `${NETLIFY_GET_GENERATION_PATH}?id=${id}`;
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
  const [generationId, setGenerationId] = useState<string | null>(() => {
    // 尝试从localStorage恢复之前的生成ID
    const savedId = localStorage.getItem('generationId');
    debugLog('从localStorage获取的生成ID:', savedId);
    return savedId;
  });
  const [audioUrl, setAudioUrl] = useState<string | null>(() => {
    // 尝试从localStorage恢复之前的音频URL
    const savedUrl = localStorage.getItem('audioUrl');
    debugLog('从localStorage获取的音频URL:', savedUrl);
    return savedUrl;
  });
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [statusDetails, setStatusDetails] = useState<any>(null); // 存储详细状态信息，用于调试

  // 在组件卸载时清除轮询
  useEffect(() => {
    return () => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    };
  }, [pollIntervalId]);

  // 恢复之前的生成状态
  useEffect(() => {
    const savedId = localStorage.getItem('generationId');
    const savedUrl = localStorage.getItem('audioUrl');
    
    if (savedId && !audioUrl && !loading) {
      debugLog('尝试恢复之前的生成状态, ID:', savedId);
      
      // 如果已有音频URL，直接使用
      if (savedUrl) {
        debugLog('已找到保存的音频URL:', savedUrl);
        setAudioUrl(savedUrl);
        setProgress(100);
      } 
      // 否则尝试查询最新状态
      else {
        debugLog('查询之前生成的状态...');
        checkGenerationStatus(savedId)
          .catch(err => {
            console.error('恢复生成状态出错:', err);
            setError(`无法恢复之前的音乐生成状态: ${err.message}`);
          });
      }
    }
  }, []);

  const generate = useCallback(async (params: GenerateParams) => {
    try {
      // 重置状态
      setLoading(true);
      setError(null);
      setProgress(0);
      setAudioUrl(null);
      setStatusDetails(null);
      localStorage.removeItem('audioUrl');
      
      debugLog('开始生成音乐，参数:', params);
      
      // 确保必要参数存在
      if (params.instrumental === undefined || params.instrumental === null) {
        params.instrumental = false; // 设置默认值
        debugLog('设置instrumental默认值为false');
      }
      
      // 确保customMode参数存在
      if (params.customMode === undefined || params.customMode === null) {
        params.customMode = false; // 设置默认值
        debugLog('设置customMode默认值为false');
      }
      
      // 检查Netlify函数是否可访问
      if (typeof window !== 'undefined') {
        debugLog('生成API地址:', '/.netlify/functions/generate');
      }
      
      // 调用Netlify函数生成音乐
      debugLog('开始请求...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒客户端超时 (比服务端更长)
      
      try {
        const response = await fetch('/.netlify/functions/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // 获取原始响应文本
        let responseText: string;
        try {
          responseText = await response.text();
          debugLog('原始响应长度:', responseText.length);
          debugLog('响应状态:', response.status);
        } catch (error: any) {
          debugLog('读取响应文本失败:', error);
          throw new Error(`读取响应失败: ${error.message}`);
        }
        
        if (responseText.startsWith('<')) {
          // 响应是HTML，可能是超时错误
          debugLog('收到HTML响应而非JSON:', responseText.substring(0, 100));
          throw new Error('API请求超时或返回非法格式');
        }
        
        // 尝试解析JSON响应
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          debugLog('解析响应失败, 原始内容:', responseText.substring(0, 200));
          throw new Error(`解析API响应失败: ${responseText.substring(0, 100)}...`);
        }
        
        // 保存响应详情，用于调试
        setStatusDetails(data);
        
        // 检查API响应状态
        if (!response.ok) {
          const statusCode = response.status;
          debugLog('API响应错误:', statusCode, data);
          
          // 显示具体的API错误信息
          let errorMsg = data.message || `API请求失败(${statusCode})`;
          
          // 处理apibox.erweima.ai的特定错误格式
          if (data.error) {
            if (data.error.code !== undefined && data.error.msg) {
              errorMsg = `API错误(${data.error.code}): ${data.error.msg}`;
            } else if (typeof data.error === 'string') {
              errorMsg = `API错误: ${data.error}`;
            }
          } else if (data.response && data.response.code !== undefined && data.response.msg) {
            errorMsg = `API错误(${data.response.code}): ${data.response.msg}`;
          }
          
          // 对于网关超时错误 (504)，提供更友好的错误消息
          if (statusCode === 504 || errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
            errorMsg = '请求超时，请稍后再试。可能的原因：网络连接不稳定或服务器响应时间过长';
          }
          
          setError(errorMsg);
          throw new Error(errorMsg);
        }
        
        debugLog('生成初始响应:', data);
        
        // 检查ID字段
        if (!data.id) {
          const errorMsg = '返回数据缺少ID字段，无法继续处理';
          debugLog('错误:', errorMsg, data);
          setError(errorMsg);
          throw new Error(errorMsg);
        }
        
        setGenerationId(data.id);
        localStorage.setItem('generationId', data.id);
        
        // 如果有音频URL，直接使用
        if (data.status === 'COMPLETE' && data.audio_url) {
          debugLog('音频已就绪:', data.audio_url);
          setAudioUrl(data.audio_url);
          localStorage.setItem('audioUrl', data.audio_url);
          setProgress(100);
        } else {
          // 正常轮询状态
          debugLog('开始轮询生成状态, ID:', data.id);
          await pollGenerationStatus(data.id);
        }

        return data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('前端请求超时，请稍后重试。可能的原因：网络连接不稳定或服务器暂时不可用');
        }
        throw error;
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      console.error('生成失败:', errorMsg);
      
      // 记录详细错误信息
      if (err instanceof Error && err.stack) {
        console.error('错误堆栈:', err.stack);
      }
      
      setError(`生成音乐失败: ${errorMsg}`);
      throw err;
    } finally {
      // 注意：当使用轮询时，loading状态会在轮询结束后设置
      if (audioUrl) {
        setLoading(false);
      }
    }
  }, []);

  // 单次检查生成状态
  const checkGenerationStatus = useCallback(async (id: string): Promise<GenerateResponse> => {
    if (!id) {
      throw new Error('生成ID为空');
    }
    
    debugLog('检查生成状态, ID:', id);
    const apiPath = getApiPath(`/v1/generate/${id}`, id);
    
    if (!apiPath) {
      throw new Error('无效的API路径');
    }
    
    debugLog('请求API路径:', apiPath);
    const response = await fetch(apiPath);
    
    if (!response.ok) {
      // 尝试解析响应以获取具体错误
      let errorMessage = '检查生成状态时出错';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        debugLog('API错误详情:', errorData);
      } catch (e) {
        errorMessage += ` (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const data: GenerateResponse = await response.json();
    debugLog('生成状态:', data);
    
    // 记录响应详情，用于调试
    setStatusDetails(data);
    
    // 如果API返回的数据缺少id，但有audio_url，添加一个临时id
    if (!data.id && data.audio_url) {
      debugLog('API返回数据缺少ID但有音频URL，添加临时ID');
      data.id = `temp-id-${Date.now()}`;
      data.status = 'COMPLETE';
      data.progress = 1;
    }
    
    return data;
  }, []);

  // 轮询生成状态
  const pollGenerationStatus = useCallback(async (id: string) => {
    // 先清除可能存在的轮询定时器
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }

    try {
      debugLog('开始轮询状态, ID:', id);
      
      // 最大轮询次数，防止无限循环
      let attempts = 0;
      const maxAttempts = 60; // 最多尝试60次，约10分钟
      
      // 先立即检查一次状态
      try {
        const initialStatus = await checkGenerationStatus(id);
        
        // 更新进度
        if (initialStatus.progress) {
          setProgress(initialStatus.progress * 100);
        }
        
        // 如果已经完成，直接设置结果
        if (initialStatus.status === 'COMPLETE' && initialStatus.audio_url) {
          debugLog('初次检查状态已完成，音频URL:', initialStatus.audio_url);
          setAudioUrl(initialStatus.audio_url);
          localStorage.setItem('audioUrl', initialStatus.audio_url);
          setProgress(100);
          setLoading(false);
          return;
        }
      } catch (err) {
        debugLog('初次检查状态出错:', err);
        // 继续到下面的轮询
      }
      
      // 设置轮询间隔
      const intervalId = setInterval(async () => {
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          setError('生成超时，请重试');
          setLoading(false);
          return;
        }
        
        attempts++;
        debugLog(`轮询第${attempts}次，ID: ${id}`);
        
        try {
          const data = await checkGenerationStatus(id);
          
          // 更新进度
          if (data.progress) {
            setProgress(data.progress * 100);
          }
          
          // 检查是否完成
          if (data.status === 'COMPLETE' && data.audio_url) {
            clearInterval(intervalId);
            debugLog('生成完成，音频URL:', data.audio_url);
            setAudioUrl(data.audio_url);
            localStorage.setItem('audioUrl', data.audio_url);
            setProgress(100);
            setLoading(false);
          } else if (data.status === 'FAILED') {
            clearInterval(intervalId);
            const errorDetails = data.error || '未知错误';
            debugLog('生成失败:', errorDetails);
            setError(`生成失败: ${errorDetails}`);
            setLoading(false);
          }
        } catch (err) {
          console.error('轮询请求错误:', err);
          // 添加错误计数
          attempts++;
          // 如果连续出错超过3次，则停止轮询
          if (attempts > 3) {
            clearInterval(intervalId);
            setError(`检查生成状态失败: ${err instanceof Error ? err.message : '未知错误'}`);
            setLoading(false);
          }
        }
      }, 10000); // 每10秒检查一次
      
      setPollIntervalId(intervalId);
      
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    } catch (err) {
      console.error('设置轮询时出错:', err);
      setError(`轮询设置失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setLoading(false);
    }
  }, [checkGenerationStatus, pollIntervalId]);

  const extendTrack = useCallback(async (id: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      setStatusDetails(null);
      
      debugLog('尝试延长音乐, ID:', id);
      const apiPath = getApiPath('/v1/generate/extend');
      debugLog('延长API路径:', apiPath);
      
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      // 尝试获取原始响应文本
      const responseText = await response.text();
      debugLog('延长API原始响应:', responseText);
      
      // 尝试解析JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`解析延长API响应失败: ${responseText.substring(0, 100)}...`);
      }
      
      if (!response.ok) {
        throw new Error(data.message || `延长音乐时出错 (${response.status})`);
      }
      
      // 记录响应详情，用于调试
      setStatusDetails(data);
      
      setGenerationId(data.id);
      localStorage.setItem('generationId', data.id);
      
      if (data.status === 'COMPLETE' && data.audio_url) {
        setAudioUrl(data.audio_url);
        localStorage.setItem('audioUrl', data.audio_url);
      } else {
        // Start polling if not immediately complete
        await pollGenerationStatus(data.id);
      }
      
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      console.error('延长音乐失败:', errorMsg);
      
      // 记录详细错误信息
      if (err instanceof Error && err.stack) {
        console.error('错误堆栈:', err.stack);
      }
      
      setError(`延长音乐失败: ${errorMsg}`);
      throw err;
    } finally {
      if (!pollIntervalId) {
        setLoading(false);
      }
    }
  }, [pollGenerationStatus]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    setProgress(0);
    setGenerationId(null);
    setAudioUrl(null);
    setStatusDetails(null);
    localStorage.removeItem('generationId');
    localStorage.removeItem('audioUrl');
    
    // 清除可能存在的轮询定时器
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }
  }, [pollIntervalId]);

  return {
    generate,
    extendTrack,
    reset,
    error,
    loading,
    progress,
    generationId,
    audioUrl,
    setAudioUrl,
    statusDetails, // 添加状态详情用于调试
    checkGenerationStatus
  };
};

export default useSuno; 
