import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 必须显式绑定 IPv4 回环。
    // Vite 默认只监听 localhost，在 Windows + Node 较新版本上会解析到 ::1（仅 IPv6），
    // 于是手册和 .env 里写的 http://127.0.0.1:5173/ 会连接被拒，
    // GitHub OAuth 回调重定向到 APP_URL 时也会失败。
    // API 那边是 app.listen(port, '127.0.0.1')，这里保持一致。
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
