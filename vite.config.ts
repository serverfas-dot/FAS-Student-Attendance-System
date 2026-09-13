import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/FAS-Student-Attendance-System/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
