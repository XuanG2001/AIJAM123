import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { NOTES, KEYBOARD_MAPPING } from '@/lib/utils';
import useJamStore from '@/store/useJamStore';

const Piano = () => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const { isRecording, addNote, startRecording, stopRecording } = useJamStore();
  
  const synth = useRef<Tone.PolySynth | null>(null);
  const startTime = useRef<number | null>(null);
  
  // 初始化合成器
  useEffect(() => {
    synth.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    return () => {
      synth.current?.disconnect();
      synth.current = null;
    };
  }, []);
  
  // 键盘监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (key in KEYBOARD_MAPPING && !activeKeys.has(key)) {
        playNote(key);
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
      const key = e.key.toLowerCase();
      
      if (key in KEYBOARD_MAPPING) {
        stopNote(key);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeKeys, isRecording, startRecording, stopRecording]);
  
  const playNote = (key: string) => {
    const noteName = KEYBOARD_MAPPING[key as keyof typeof KEYBOARD_MAPPING];
    
    synth.current?.triggerAttack(noteName);
    
    setActiveKeys(prev => new Set(prev).add(key));
    
    // 录制音符
    if (isRecording && startTime.current) {
      const now = Date.now();
      const timeSinceStart = (now - startTime.current) / 1000;
      
      addNote({
        note: noteName,
        velocity: 0.8,
        time: timeSinceStart
      });
    }
  };
  
  const stopNote = (key: string) => {
    const noteName = KEYBOARD_MAPPING[key as keyof typeof KEYBOARD_MAPPING];
    
    synth.current?.triggerRelease(noteName);
    
    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  };

  // 直接点击钢琴按键
  const handlePianoKeyClick = (noteName: string) => {
    synth.current?.triggerAttackRelease(noteName, "8n");
    
    // 录制音符
    if (isRecording && startTime.current) {
      const now = Date.now();
      const timeSinceStart = (now - startTime.current) / 1000;
      
      addNote({
        note: noteName,
        velocity: 0.8,
        time: timeSinceStart,
        duration: 0.25 // 约 "8n" 时值
      });
    }
  };
  
  const isBlackKey = (note: string) => note.includes('#');
  
  const isNoteActive = (note: string) => {
    for (const key of activeKeys) {
      if (KEYBOARD_MAPPING[key as keyof typeof KEYBOARD_MAPPING] === note) {
        return true;
      }
    }
    return false;
  };
  
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">钢琴键盘</h3>
          <p className="text-sm text-muted-foreground">
            使用键盘按键 (A-S-D-F-G-H-J / W-E-T-Y-U) 或点击下方演奏
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
      
      <div className="flex h-48 relative">
        {Object.keys(NOTES).map((note) => {
          const black = isBlackKey(note);
          const active = isNoteActive(note);
          
          return (
            <div
              key={note}
              className={`piano-key ${black ? 'black' : ''} ${active ? 'active' : ''}`}
              style={{
                height: black ? '60%' : '100%',
                width: black ? '8%' : `${100 / 7.5}%`,
                position: black ? 'absolute' : 'relative',
                left: black
                  ? `${
                      (Object.keys(NOTES).indexOf(note) - 0.5) *
                      (100 / 7.5)
                    }%`
                  : undefined,
                zIndex: black ? 2 : 1,
              }}
              onMouseDown={() => handlePianoKeyClick(note)}
              onTouchStart={() => handlePianoKeyClick(note)}
            >
              <div className="flex flex-col justify-end items-center h-full pb-2">
                <span className="text-xs text-gray-500">
                  {note}
                </span>
                <span className="text-xs mt-1 text-gray-400">
                  {Object.keys(KEYBOARD_MAPPING).find(
                    (key) => KEYBOARD_MAPPING[key as keyof typeof KEYBOARD_MAPPING] === note
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Piano; 