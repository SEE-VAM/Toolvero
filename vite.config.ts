import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function localApiPlugin() {
  return {
    name: 'local-api-handler',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost:3000');
        if (url.pathname === '/api/resolve' || url.pathname === '/api/stream') {
          try {
            const filePath = url.pathname === '/api/resolve' ? './api/resolve.js' : './api/stream.js';
            const mod = await server.ssrLoadModule(filePath);
            req.query = Object.fromEntries(url.searchParams.entries());
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data: any) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
            res.send = (text: string) => {
              res.end(text);
              return res;
            };
            return await mod.default(req, res);
          } catch (err: any) {
            console.error('Local API error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), localApiPlugin()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'lucide-icons': ['lucide-react'],
          'pdf-engine': ['jspdf'],
        },
      },
    },
  },
});
