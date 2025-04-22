import { create } from 'zustand';
import { NoteEvent, GenerateParams, SunoModel, InstrumentType } from '../types';

interface JamState {
  // Recording state
  recordedNotes: NoteEvent[];
  isRecording: boolean;
  startRecordingTime: number | null;
  
  // Generation parameters
  customMode: boolean;
  instrumental: boolean;
  model: SunoModel;
  prompt: string;
  style: string;
  title: string;
  tags: string;
  tempo: number;
  
  // Actions
  setRecordedNotes: (notes: NoteEvent[]) => void;
  addNote: (note: NoteEvent) => void;
  clearNotes: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  setCustomMode: (value: boolean) => void;
  setInstrumental: (value: boolean) => void;
  setModel: (value: SunoModel) => void;
  setPrompt: (value: string) => void;
  setStyle: (value: string) => void;
  setTitle: (value: string) => void;
  setTags: (value: string) => void;
  setTempo: (value: number) => void;
  getGenerateParams: (instrument: InstrumentType) => GenerateParams;
}

const useJamStore = create<JamState>((set, get) => ({
  // Initial recording state
  recordedNotes: [],
  isRecording: false,
  startRecordingTime: null,
  
  // Initial generation parameters
  customMode: false,
  instrumental: false,
  model: 'V3_5',
  prompt: '',
  style: '',
  title: '',
  tags: '',
  tempo: 120,
  
  // Actions
  setRecordedNotes: (notes) => set({ recordedNotes: notes }),
  
  addNote: (note) => set((state) => ({
    recordedNotes: [...state.recordedNotes, note]
  })),
  
  clearNotes: () => set({ recordedNotes: [] }),
  
  startRecording: () => set({
    isRecording: true,
    startRecordingTime: Date.now(),
    recordedNotes: []
  }),
  
  stopRecording: () => set({ isRecording: false }),
  
  setCustomMode: (value) => set({ customMode: value }),
  
  setInstrumental: (value) => set({ instrumental: value }),
  
  setModel: (value) => set({ model: value }),
  
  setPrompt: (value) => set({ prompt: value }),
  
  setStyle: (value) => set({ style: value }),
  
  setTitle: (value) => set({ title: value }),
  
  setTags: (value) => set({ tags: value }),
  
  setTempo: (value) => set({ tempo: value }),
  
  getGenerateParams: (instrument) => {
    const state = get();
    
    // Format recorded notes as part of the prompt if using piano or drum
    let formattedPrompt = state.prompt;
    
    if (instrument === 'piano' || instrument === 'drum') {
      const notesDescription = state.recordedNotes
        .map(n => `${n.note} (time: ${n.time.toFixed(2)}s)`)
        .join(', ');
        
      formattedPrompt = state.customMode 
        ? state.prompt 
        : `${state.prompt}\n\nNotes played: ${notesDescription}\nTempo: ${state.tempo} BPM`;
    }
    
    return {
      customMode: state.customMode,
      instrumental: state.instrumental,
      model: state.model,
      prompt: formattedPrompt,
      style: state.customMode ? state.style : undefined,
      title: state.customMode ? state.title : undefined,
      tags: state.tags || undefined,
      instrument,
      tempo: state.tempo
    };
  }
}));

export default useJamStore; 