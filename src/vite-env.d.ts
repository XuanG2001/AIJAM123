/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUNO_API_KEY: string;
  readonly VITE_SUNO_CALLBACK: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 