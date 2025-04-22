import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { formatTime, downloadAudio } from '@/lib/utils';
import { Play, Pause, Download, RefreshCw } from 'lucide-react';

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
      
      return () => {
        wavesurfer.destroy();
        wavesurferRef.current = null;
      };
    }
  }, []);
  
  // 加载音频文件
  useEffect(() => {
    if (audioUrl && wavesurferRef.current) {
      wavesurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);
  
  // 播放/暂停控制
  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };
  
  // 下载音频
  const handleDownload = () => {
    if (audioUrl) {
      downloadAudio(audioUrl);
    }
  };
  
  // 重置播放器
  const handleReset = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop();
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
        </div>
        
        {audioUrl && (
          <div className="flex justify-center space-x-4">
            <button
              onClick={togglePlayPause}
              className="p-2 rounded-full bg-jam-primary text-white hover:bg-purple-600 transition-colors"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            
            <button
              onClick={handleReset}
              className="p-2 rounded-full bg-muted text-foreground hover:bg-accent transition-colors"
              aria-label="重置"
            >
              <RefreshCw size={16} />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 rounded-full bg-muted text-foreground hover:bg-accent transition-colors"
              aria-label="下载"
            >
              <Download size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player; 