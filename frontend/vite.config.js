import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Risolve l'errore "process is not defined" del pacchetto @excalidraw/excalidraw
    'process.env': {},
    'process.env.IS_PREACT': JSON.stringify('false')
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Necessario per l'hot-reload corretto all'interno dei volumi Docker su Windows/WSL
      usePolling: true,
      interval: 100
    }
  }
});
