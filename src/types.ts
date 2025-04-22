export type InstrumentType = 'piano' | 'drum' | 'hum';

export type SunoModel = 'V3_5' | 'V4';

export type NoteEvent = {
  note: string;
  velocity: number;
  time: number;
  duration?: number;
};

export type GenerateParams = {
  customMode: boolean;
  instrumental: boolean;
  model: SunoModel;
  prompt: string;
  style?: string;
  title?: string;
  tags?: string;
  instrument: InstrumentType;
  tempo?: number;
  callBackUrl?: string;
};

export type GenerateResponse = {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED';
  progress: number;
  audio_url?: string;
  error?: string;
};

export type DrumSound = 'kick' | 'snare' | 'hihat' | 'tom1' | 'tom2' | 'crash' | 'ride' | 'clap' | 'rim'; 