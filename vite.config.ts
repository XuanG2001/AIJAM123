import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['music-note.svg'],
      manifest: {
        name: 'AI Jam Playground',
        short_name: 'AI Jam',
        description: '使用钢琴键盘、架子鼓即兴创作旋律，通过AI生成音乐',
        theme_color: '#a855f7',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/music-note.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        start_url: '/'
      },
      strategies: 'generateSW',
      disable: process.env.NODE_ENV === 'development'
    })
  ],
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://apibox.erweima.ai',
        changeOrigin: true,
        secure: false
      }
    }
  }
}) 