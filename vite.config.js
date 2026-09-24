import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    // Proxy CORS agar aplikasi bisa menarik daftar harga BBM terbaru dari
    // situs berita publik langsung dari browser (tanpa server sendiri).
    proxy: {
      '/api/harga': {
        target: 'https://www.metrotvnews.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/api\/harga/, '/read/kpLCQnpJ-rincian-harga-bbm-nonsubsidi-terbaru-di-pertamina-shell-bp-dan-vivo'),
      }
    }
  }
})
