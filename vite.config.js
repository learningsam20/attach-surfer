import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cors-proxy-middleware',
      configureServer(server) {
        // Prevent SPA fallback for /models/ so missing model weights/config return 404 instead of index.html
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/models/')) {
            const cleanUrl = req.url.replace(/^\/models\//, '').split('?')[0];
            const targetFile = path.resolve(process.cwd(), 'public/models', cleanUrl);
            if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Model file not found');
              return;
            }
          }
          next();
        });

        server.middlewares.use('/api/proxy', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.end();
            return;
          }

          const parsed = new URL(req.url, 'http://localhost:5289');
          const targetUrl = parsed.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end('Missing url query parameter');
            return;
          }

          try {
            const upstream = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
              }
            });

            res.statusCode = upstream.status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

            const contentType = upstream.headers.get('content-type');
            if (contentType) res.setHeader('Content-Type', contentType);

            const buffer = await upstream.arrayBuffer();
            res.end(Buffer.from(buffer));
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(`Proxy error: ${err.message}`);
          }
        });
      }
    }
  ],
  server: {
    port: 5289
  }
})
