import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { DRUM_MAPPING } from '@/lib/utils';
import useJamStore from '@/store/useJamStore';
import { DrumSound } from '@/types';

const DrumPad = () => {
  const [activePads, setActivePads] = useState<Set<string>>(new Set());
  const { isRecording, addNote, startRecording, stopRecording } = useJamStore();
  
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const startTime = useRef<number | null>(null);
  
  const drumSounds: Record<DrumSound, string> = {
    'kick': 'C1',
    'snare': 'D1',
    'hihat': 'E1',
    'tom1': 'F1',
    'tom2': 'G1',
    'crash': 'A1',
    'ride': 'B1',
    'clap': 'C2',
    'rim': 'D2'
  };
  
  // 鼓点名称和展示信息
  const drumInfo: Record<DrumSound, { name: string, keyTrigger: string }> = {
    'kick': { name: '底鼓', keyTrigger: '1' },
    'snare': { name: '军鼓', keyTrigger: '2' },
    'hihat': { name: '踩镲', keyTrigger: '3' },
    'tom1': { name: '中音鼓1', keyTrigger: '4' },
    'tom2': { name: '中音鼓2', keyTrigger: '5' },
    'crash': { name: '碎音镲', keyTrigger: '6' },
    'ride': { name: '骑镲', keyTrigger: '7' },
    'clap': { name: '拍手', keyTrigger: '8' },
    'rim': { name: '边框', keyTrigger: '9' }
  };
  
  // 初始化采样器
  useEffect(() => {
    const urls: Record<string, string> = {
      'C1': '/sounds/kick.mp3',
      'D1': '/sounds/snare.mp3',
      'E1': '/sounds/hihat.mp3',
      'F1': '/sounds/tom1.mp3',
      'G1': '/sounds/tom2.mp3',
      'A1': '/sounds/crash.mp3',
      'B1': '/sounds/ride.mp3',
      'C2': '/sounds/clap.mp3',
      'D2': '/sounds/rim.mp3'
    };
    
    const sampler = new Tone.Sampler({
      urls,
      onload: () => {
        console.log('Drum sampler loaded');
      }
    }).toDestination();
    
    samplerRef.current = sampler;
    
    return () => {
      samplerRef.current?.disconnect();
      samplerRef.current = null;
    };
  }, []);
  
  // 键盘监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      
      if (key in DRUM_MAPPING && !activePads.has(key)) {
        playDrum(DRUM_MAPPING[key as keyof typeof DRUM_MAPPING] as DrumSound);
        setActivePads(prev => new Set(prev).add(key));
      }
      
      // 录制控制
      if (key === 'r' && !isRecording) {
        startRecording();
        startTime.current = Date.now();
      } else if (key === 's' && isRecording) {
        stopRecording();
        startTime.current = null;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      
      if (key in DRUM_MAPPING) {
        setActivePads(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activePads, isRecording, startRecording, stopRecording]);
  
  const playDrum = (drumType: DrumSound) => {
    if (!samplerRef.current) return;
    
    const note = drumSounds[drumType];
    samplerRef.current.triggerAttackRelease(note, 0.1);
    
    // 录制音符
    if (isRecording && startTime.current) {
      const now = Date.now();
      const timeSinceStart = (now - startTime.current) / 1000;
      
      addNote({
        note: drumType,
        velocity: 0.8,
        time: timeSinceStart
      });
    }
  };
  
  const isPadActive = (drumType: DrumSound) => {
    for (const key of activePads) {
      if (DRUM_MAPPING[key as keyof typeof DRUM_MAPPING] === drumType) {
        return true;
      }
    }
    return false;
  };
  
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">架子鼓</h3>
          <p className="text-sm text-muted-foreground">
            使用键盘数字键 (1-9) 或点击下方的鼓垫演奏
          </p>
        </div>
        <div>
          {!isRecording ? (
            <button
              onClick={() => {
                startRecording();
                startTime.current = Date.now();
              }}
              className="px-2 py-1 bg-jam-primary rounded-md text-sm"
            >
              开始录制 (R)
            </button>
          ) : (
            <button
              onClick={() => {
                stopRecording();
                startTime.current = null;
              }}
              className="px-2 py-1 bg-red-500 rounded-md text-sm animate-pulse"
            >
              停止录制 (S)
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(drumSounds) as DrumSound[]).map((drumType) => {
          const active = isPadActive(drumType);
          const info = drumInfo[drumType];
          
          return (
            <div
              key={drumType}
              className={`drum-pad h-24 flex flex-col items-center justify-center ${active ? 'active' : ''}`}
              onMouseDown={() => playDrum(drumType)}
              onTouchStart={() => playDrum(drumType)}
            >
              <div className="text-lg">{info.name}</div>
              <div className="text-xs mt-1 text-muted-foreground">按键 {info.keyTrigger}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DrumPad; 