import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Improve chunking for better caching and faster loads
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-clerk': ['@clerk/clerk-react'],
        },
      },
    },
    // Increase chunk warning limit slightly since we have good splitting
    chunkSizeWarningLimit: 600,
  },
})
