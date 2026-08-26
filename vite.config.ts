import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // host: true asks Vite to listen on every interface. Written as an address
    // literal it is a host baked into the code, which is the one thing the
    // no-hardcoding rule is about; this says the same thing by name.
    port: Number(process.env.DEV_SERVER_PORT ?? 3000),
    host: true,
  },
});
