import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/elevenlabs-api': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/elevenlabs-api/, ''),
      },
    },
  },
});
