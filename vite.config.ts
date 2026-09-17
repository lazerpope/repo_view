import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const proxy = { '/data': `http://127.0.0.1:${process.env.PORT || 3000}` }

export default defineConfig({
  plugins: [vue()],
  server: { host: '127.0.0.1', proxy },
  preview: { host: '127.0.0.1', proxy },
})
