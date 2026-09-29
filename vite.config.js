import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { executePaddleOcr } = require('./backend/runPaddleOcr.cjs')

function paddleOcrPlugin() {
  return {
    name: 'paddle-ocr-plugin',
    configureServer(server) {
      server.middlewares.use('/api/ocr-paddle', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const result = await executePaddleOcr(data.image || '');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [vue(), paddleOcrPlugin()],
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

