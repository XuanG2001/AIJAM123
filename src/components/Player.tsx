import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { formatTime, downloadAudio } from '@/lib/utils';
import { Download, Play } from 'lucide-react';

interface PlayerProps {
  audioUrl: string | null;
  isGenerating: boolean;
}

const Player = ({ audioUrl, isGenerating }: PlayerProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 初始化 WaveSurfer
  useEffect(() => {
    if (waveformRef.current) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#a855f7',
        progressColor: '#d8b4fe',
        cursorColor: '#d8b4fe',
        cursorWidth: 2,
        barWidth: 2,
        barGap: 2,
        height: 60,
        barRadius: 2,
        normalize: true,
        fillParent: true,
      });
      
      wavesurfer.on('ready', () => {
        wavesurferRef.current = wavesurfer;
        setDuration(wavesurfer.getDuration());
        setLoadError(null);
      });
      
      wavesurfer.on('play', () => {
        setIsPlaying(true);
      });
      
      wavesurfer.on('pause', () => {
        setIsPlaying(false);
      });
      
      wavesurfer.on('timeupdate', (time) => {
        setCurrentTime(time);
      });
      
      wavesurfer.on('finish', () => {
        setIsPlaying(false);
      });
      
      wavesurfer.on('error', (error) => {
        console.error('WaveSurfer错误:', error);
        setLoadError('加载音频时出错，请重试');
      });
      
      return () => {
        wavesurfer.destroy();
        wavesurferRef.current = null;
      };
    }
  }, []);
  
  // 加载音频文件
  useEffect(() => {
    if (audioUrl && wavesurferRef.current) {
      setLoadError(null);
      
      console.log('尝试加载音频URL:', audioUrl);
      
      try {
        // 检查URL是否有效
        const isValidUrl = (url: string) => {
          try {
            new URL(url);
            return true;
          } catch (e) {
            return false;
          }
        };

        // 确保URL是完整的绝对URL
        let urlToLoad = audioUrl;
        if (!isValidUrl(audioUrl)) {
          if (audioUrl.startsWith('/')) {
            // 相对于网站根目录的URL
            urlToLoad = window.location.origin + audioUrl;
          } else {
            // 其他不完整URL，可能需要添加协议
            urlToLoad = 'https://' + audioUrl;
          }
          console.log('转换后的URL:', urlToLoad);
        }
        
        // 添加CORS代理，如果是跨域请求
        if (!urlToLoad.includes(window.location.hostname) && !urlToLoad.includes('localhost')) {
          // 可以选择使用CORS代理
          console.log('使用代理URL加载跨域资源');
        }
        
        // 先执行预检
        fetch(urlToLoad, { method: 'HEAD', mode: 'no-cors' })
          .then(() => {
            console.log('音频资源预检成功');
            wavesurferRef.current?.load(urlToLoad);
          })
          .catch(err => {
            console.error('音频资源预检失败:', err);
            setLoadError('无法访问音频URL，可能存在跨域限制');
          });
        
        // 监听加载事件，处理可能的加载失败
        const loadHandler = () => {
          console.log('音频加载成功');
        };
        
        const errorHandler = (error: Error) => {
          console.error('加载音频出错:', error);
          setLoadError('无法加载音频文件，可能是URL无效或跨域限制');
        };
        
        wavesurferRef.current.on('ready', loadHandler);
        wavesurferRef.current.on('error', errorHandler);
        
        return () => {
          wavesurferRef.current?.un('ready', loadHandler);
          wavesurferRef.current?.un('error', errorHandler);
        };
      } catch (error) {
        console.error('加载音频出错:', error);
        setLoadError('无法加载音频文件');
      }
    }
  }, [audioUrl]);
  
  // 在新窗口打开音频
  const openAudioInNewWindow = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank');
    }
  };
  
  // 下载音频
  const handleDownload = () => {
    if (audioUrl) {
      downloadAudio(audioUrl);
    }
  };

  // 重试加载音频
  const handleRetry = () => {
    if (audioUrl && wavesurferRef.current) {
      setLoadError(null);
      console.log('重试加载音频:', audioUrl);
      wavesurferRef.current.load(audioUrl);
    }
  };
  
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-medium">音频播放器</h3>
        <div className="text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      
      <div className="flex flex-col space-y-4">
        <div ref={waveformRef} className="w-full">
          {!audioUrl && !isGenerating && (
            <div className="h-[60px] bg-muted rounded-md flex items-center justify-center text-muted-foreground">
              演奏并生成音乐后将在此显示
            </div>
          )}
          
          {isGenerating && (
            <div className="h-[60px] bg-muted rounded-md flex items-center justify-center text-muted-foreground animate-pulse">
              生成音乐中...
            </div>
          )}
          
          {loadError && (
            <div className="h-[60px] bg-red-50 border border-red-200 rounded-md flex items-center justify-center text-red-500 px-2 text-center">
              <div className="flex flex-col items-center">
                <p>{loadError}</p>
                <button 
                  onClick={handleRetry}
                  className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-md text-sm"
                >
                  重试加载
                </button>
              </div>
            </div>
          )}
        </div>
        
        {audioUrl && (
          <div className="flex justify-center space-x-4">
            <button
              onClick={openAudioInNewWindow}
              className="p-2 rounded-full bg-jam-primary text-white hover:bg-purple-600 transition-colors"
              aria-label="在新窗口播放"
              title="在新窗口播放"
            >
              <Play size={16} />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-muted text-foreground hover:bg-accent transition-colors"
              aria-label="下载"
              title="下载MP3"
            >
              <Download size={16} />
            </button>
          </div>
        )}
      </div>
      
      {/* 调试入口 */}
      <div className="text-xs text-center mt-4">
        <a href="/debug" className="text-jam-primary hover:underline">
          遇到问题？点击这里进行系统诊断
        </a>
      </div>
      
      {/* 音频URL调试信息 */}
      {process.env.NODE_ENV === 'development' && audioUrl && (
        <div className="text-xs mt-2 text-muted-foreground break-all border-t pt-2">
          <p>音频URL: {audioUrl}</p>
        </div>
      )}
    </div>
  );
};

export default Player; 
