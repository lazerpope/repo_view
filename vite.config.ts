import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const backendEnv = loadEnv(mode, 'backend', '')
    const backend = `http://127.0.0.1:${process.env.PORT || backendEnv.PORT || 3000}`
    const proxy = { '/data': backend, '/user': backend }

    return {
        plugins: [vue()],
        server: { host: '127.0.0.1', proxy },
        preview: { host: '127.0.0.1', proxy },
    }
})
