import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  server:{
    https: {
      key: "./webrtc-streaming-privateKey.key",
      cert:"./webrtc-streaming.crt"
    }
  },
  plugins: [react(),tailwindcss()],
})
